import io
import random
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
import models

def parse_and_process_real_csv_bulk(db: Session, filepath: str, filename: str, year_str: str, uploader_id: int = None) -> models.Upload:
    """
    High-Performance Bulk Importer for Real Cochin Port Authority CSV Files (approx. 50,000 rows per file).
    Automatically skips metadata rows, cleans currency characters, converts invoice credits/charges,
    and performs bulk insert mapping for maximum scalability.
    """
    # 1. Create upload entry
    upload_record = models.Upload(
        filename=filename,
        year=year_str,
        status="Processing",
        uploaded_by=uploader_id
    )
    db.add(upload_record)
    db.commit()
    db.refresh(upload_record)

    try:
        # 2. Find skiprows dynamically by searching for the 'VCN' column header row
        skiprows = 0
        for i in range(25):
            try:
                df_temp = pd.read_csv(filepath, skiprows=i, nrows=5)
                cols = [str(c).strip() for c in df_temp.columns]
                if 'VCN' in cols:
                    skiprows = i
                    break
            except Exception:
                continue

        # 3. Read full CSV from identified header row
        df = pd.read_csv(filepath, skiprows=skiprows, low_memory=False)
        df.columns = [str(c).strip() for c in df.columns]

        # Filter out summary/empty rows; keeping rows where VCN is present and starts with 'IN' (e.g. INCOK...)
        df = df[df['VCN'].notna() & df['VCN'].astype(str).str.startswith('IN')].copy()

        # Clean amount column
        amt_col = 'Invoice Amount'
        if amt_col not in df.columns:
            # Fallback if there is variation in column names
            for col in df.columns:
                if 'amount' in col.lower() and 'discount' not in col.lower() and 'sor' not in col.lower():
                    amt_col = col
                    break

        df[amt_col] = pd.to_numeric(
            df[amt_col].astype(str).str.replace(',', '').str.replace('₹', '').str.replace('$', '').str.strip(),
            errors='coerce'
        ).fillna(0.0)

        # Take absolute value so that invoice billing offsets represent positive port revenues
        df['amount_clean'] = df[amt_col].abs()

        # Date parsing helper
        def parse_date(date_str):
            date_str = str(date_str).strip()
            for fmt in ('%d-%m-%Y %H:%M', '%Y-%m-%d %H:%M:%S', '%d-%m-%Y', '%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y'):
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            # Fallback to start of financial year
            fy_start = int(year_str.split('-')[0])
            return datetime(fy_start, 4, 1)

        # Apply date parsing
        df['parsed_date'] = df['Invoice Date'].apply(parse_date)

        # 4. Department Caching
        # Extract invoice groups as departments (MARINE, CARGO, CFS)
        unique_groups = df['Invoice Group'].dropna().unique()
        dept_cache = {}
        for group in unique_groups:
            group_clean = str(group).strip().upper()
            dept = db.query(models.Department).filter(models.Department.name == group_clean).first()
            if not dept:
                dept = models.Department(name=group_clean)
                db.add(dept)
                db.commit()
                db.refresh(dept)
            dept_cache[group_clean] = dept.id

        # Make sure administrative departments exist for simulated expenses
        for admin_dept in ["HR", "ENGINEERING", "ACCOUNTS"]:
            dept = db.query(models.Department).filter(models.Department.name == admin_dept).first()
            if not dept:
                dept = models.Department(name=admin_dept)
                db.add(dept)
                db.commit()
                db.refresh(dept)
            dept_cache[admin_dept] = dept.id

        # 5. Bulk prepare transactions list
        transactions_to_insert = []
        for _, row in df.iterrows():
            group_val = str(row['Invoice Group']).strip().upper() if pd.notna(row['Invoice Group']) else 'MARINE'
            if group_val not in dept_cache:
                group_val = 'MARINE'
                
            transactions_to_insert.append({
                "date": row['parsed_date'],
                "department_id": dept_cache[group_val],
                "category": str(row['Charge Name']).strip() if pd.notna(row['Charge Name']) else 'Port Services',
                "amount": row['amount_clean'],
                "type": "Revenue",
                "client": str(row['Party Name']).strip() if pd.notna(row['Party Name']) else 'Merchant Client',
                "description": str(row['Sub Group']).strip() if pd.notna(row['Sub Group']) else '',
                "upload_id": upload_record.id,
                "berth": str(row['Berth']).strip() if pd.notna(row['Berth']) else None
            })

        # 6. Generate Proportional Port Expenses & Allocations (for complete dashboard flow)
        df['year_cal'] = df['parsed_date'].dt.year
        df['month_cal'] = df['parsed_date'].dt.month
        monthly_revenues = df.groupby(['year_cal', 'month_cal', 'Invoice Group'])['amount_clean'].sum().reset_index()

        for _, row in monthly_revenues.iterrows():
            year = int(row['year_cal'])
            month = int(row['month_cal'])
            group_name = str(row['Invoice Group']).strip().upper()
            dept_id = dept_cache.get(group_name, dept_cache['MARINE'])
            rev_sum = row['amount_clean']

            # Salary expense (~35% of revenue)
            transactions_to_insert.append({
                "date": datetime(year, month, 1),
                "department_id": dept_cache["HR"],
                "category": "Salary",
                "amount": rev_sum * 0.35,
                "type": "Expense",
                "client": None,
                "description": f"Monthly payroll allocation for {group_name}",
                "upload_id": upload_record.id
            })

            # Fuel & Utility expense (~12% of revenue)
            transactions_to_insert.append({
                "date": datetime(year, month, 15),
                "department_id": dept_id,
                "category": "Fuel",
                "amount": rev_sum * 0.12,
                "type": "Expense",
                "client": None,
                "description": f"Marine vessels and equipment fuel for {group_name}",
                "upload_id": upload_record.id
            })

            # Maintenance & Repair expense (~15% of revenue)
            transactions_to_insert.append({
                "date": datetime(year, month, 20),
                "department_id": dept_cache["ENGINEERING"],
                "category": "Maintenance",
                "amount": rev_sum * 0.15,
                "type": "Expense",
                "client": None,
                "description": f"Structural berth & harbor maintenance for {group_name}",
                "upload_id": upload_record.id
            })

            # Security / Admin expense under ACCOUNTS (~4% of revenue)
            transactions_to_insert.append({
                "date": datetime(year, month, 10),
                "department_id": dept_cache["ACCOUNTS"],
                "category": "Security",
                "amount": rev_sum * 0.04,
                "type": "Expense",
                "client": None,
                "description": f"Security and administrative service outlays for {group_name}",
                "upload_id": upload_record.id
            })

        # Insert all transactions in bulk mappings (extremely fast in SQLite)
        db.bulk_insert_mappings(models.Transaction, transactions_to_insert)
        db.commit()

        # 7. Seed corresponding Budget limits
        txs = db.query(models.Transaction).filter(models.Transaction.upload_id == upload_record.id).all()
        budget_groups = {}
        for t in txs:
            t_month = t.date.month
            t_year = t.date.year
            b_year = t_year
            if t_month in [1, 2, 3]:
                b_year = t_year - 1
            
            key = (b_year, t.department_id, t.category, t.type)
            budget_groups[key] = budget_groups.get(key, 0.0) + t.amount

        budgets_to_insert = []
        for (b_year, dept_id, category, tx_type), actual_amt in budget_groups.items():
            if tx_type == "Expense":
                # Create budget slightly above or below expense to simulate overruns
                overrun = random.random() < 0.15
                allocated = actual_amt * 0.85 if overrun else actual_amt * 1.15
                budgets_to_insert.append({
                    "year": b_year,
                    "department_id": dept_id,
                    "category": category,
                    "allocated_amount": allocated,
                    "spent_amount": actual_amt
                })

        db.bulk_insert_mappings(models.Budget, budgets_to_insert)
        db.commit()

        # 8. Seed/Update FinancialData monthly aggregate metrics
        monthly_financials = {}
        for t in txs:
            key = (t.date.year, t.date.month)
            if key not in monthly_financials:
                monthly_financials[key] = {"revenue": 0.0, "expenses": 0.0, "cash_flow": 0.0}
            if t.type == "Revenue":
                monthly_financials[key]["revenue"] += t.amount
                monthly_financials[key]["cash_flow"] += t.amount
            else:
                monthly_financials[key]["expenses"] += t.amount
                monthly_financials[key]["cash_flow"] -= t.amount

        findata_to_insert = []
        for (year, month), val in monthly_financials.items():
            revenue = val["revenue"]
            expenses = val["expenses"]
            cash_flow = val["cash_flow"]
            profit = revenue - expenses
            assets = revenue * 1.5 + cash_flow * 0.5
            liabilities = expenses * 0.8

            findata = db.query(models.FinancialData).filter(
                models.FinancialData.year == year,
                models.FinancialData.month == month
            ).first()

            if findata:
                findata.revenue += revenue
                findata.expenses += expenses
                findata.cash_flow += cash_flow
                findata.profit = findata.revenue - findata.expenses
                findata.assets = findata.revenue * 1.5 + findata.cash_flow * 0.5
                findata.liabilities = findata.expenses * 0.8
            else:
                findata_to_insert.append({
                    "year": year,
                    "month": month,
                    "revenue": revenue,
                    "expenses": expenses,
                    "profit": profit,
                    "assets": assets,
                    "liabilities": liabilities,
                    "cash_flow": cash_flow
                })

        if findata_to_insert:
            db.bulk_insert_mappings(models.FinancialData, findata_to_insert)
        db.commit()

        # 9. Success completion update
        upload_record.status = "Completed"
        upload_record.row_count = len(df)
        db.commit()

        log_action(db, uploader_id, "CSV Upload Success", f"Uploaded real report {filename} for FY {year_str} with {len(df)} records.")
        run_realtime_checks(db)

    except Exception as e:
        db.rollback()
        upload_record.status = "Failed"
        db.commit()
        log_action(db, uploader_id, "CSV Upload Failed", f"Failed uploading {filename}: {str(e)}")
        raise e

    return upload_record


def parse_and_process_csv(db: Session, file_content: bytes, filename: str, year_str: str, uploader_id: int = None) -> models.Upload:
    """
    Standard Parser for single-invoice UI uploads.
    """
    upload_record = models.Upload(
        filename=filename,
        year=year_str,
        status="Processing",
        uploaded_by=uploader_id
    )
    db.add(upload_record)
    db.commit()
    db.refresh(upload_record)

    try:
        df = pd.read_csv(io.BytesIO(file_content))
        required_cols = {"Date", "Department", "Category", "Amount", "Type", "Budget_Allocated"}
        missing_cols = required_cols - set(df.columns)
        if missing_cols:
            raise ValueError(f"Missing required columns in CSV: {', '.join(missing_cols)}")

        transactions_added = []
        departments_cache = {d.name.lower(): d for d in db.query(models.Department).all()}
        fy_start_year = int(year_str.split('-')[0])

        for _, row in df.iterrows():
            dept_name = str(row['Department']).strip()
            category = str(row['Category']).strip()
            amount_val = float(str(row['Amount']).replace(',', '').replace('₹', '').replace('$', '').strip())
            tx_type = str(row['Type']).strip().capitalize()
            budget_alloc = float(str(row['Budget_Allocated']).replace(',', '').replace('₹', '').replace('$', '').strip())
            desc_val = str(row['Description']).strip() if 'Description' in row and pd.notna(row['Description']) else ""
            client_val = str(row['Client']).strip() if 'Client' in row and pd.notna(row['Client']) else None
            
            date_str = str(row['Date']).strip()
            parsed_date = None
            for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d %H:%M:%S', '%Y-%m-%d %H:%M:%S'):
                try:
                    parsed_date = datetime.strptime(date_str, fmt)
                    break
                except ValueError:
                    continue
            if not parsed_date:
                parsed_date = datetime(fy_start_year, 4, 1)

            dept_name_lower = dept_name.lower()
            if dept_name_lower not in departments_cache:
                new_dept = models.Department(name=dept_name)
                db.add(new_dept)
                db.commit()
                db.refresh(new_dept)
                departments_cache[dept_name_lower] = new_dept
            
            dept = departments_cache[dept_name_lower]

            tx = models.Transaction(
                date=parsed_date,
                department_id=dept.id,
                category=category,
                amount=amount_val,
                type=tx_type,
                client=client_val,
                description=desc_val,
                upload_id=upload_record.id
            )
            db.add(tx)
            transactions_added.append((parsed_date, dept.id, category, amount_val, tx_type, budget_alloc))

        db.commit()

        for parsed_date, dept_id, category, amount, tx_type, budget_alloc in transactions_added:
            tx_year = parsed_date.year
            tx_month = parsed_date.month
            budget_year = tx_year
            if tx_month in [1, 2, 3]:
                budget_year = tx_year - 1

            budget = db.query(models.Budget).filter(
                models.Budget.year == budget_year,
                models.Budget.department_id == dept_id,
                models.Budget.category == category
            ).first()

            if not budget:
                budget = models.Budget(
                    year=budget_year,
                    department_id=dept_id,
                    category=category,
                    allocated_amount=budget_alloc,
                    spent_amount=0.0
                )
                db.add(budget)
                db.commit()
                db.refresh(budget)
            
            if tx_type == "Expense":
                budget.spent_amount += amount
                db.commit()

            findata = db.query(models.FinancialData).filter(
                models.FinancialData.year == tx_year,
                models.FinancialData.month == tx_month
            ).first()

            if not findata:
                findata = models.FinancialData(
                    year=tx_year,
                    month=tx_month,
                    revenue=0.0,
                    expenses=0.0,
                    profit=0.0,
                    assets=0.0,
                    liabilities=0.0,
                    cash_flow=0.0
                )
                db.add(findata)
                db.commit()
                db.refresh(findata)

            if tx_type == "Revenue":
                findata.revenue += amount
                findata.cash_flow += amount
            else:
                findata.expenses += amount
                findata.cash_flow -= amount
            
            findata.profit = findata.revenue - findata.expenses
            findata.assets = findata.revenue * 1.5 + findata.cash_flow * 0.5
            findata.liabilities = findata.expenses * 0.8
            db.commit()

        upload_record.status = "Completed"
        upload_record.row_count = len(transactions_added)
        db.commit()

        log_action(db, uploader_id, "CSV Upload Success", f"Uploaded {filename} with {len(transactions_added)} records.")
        run_realtime_checks(db)

    except Exception as e:
        db.rollback()
        upload_record.status = "Failed"
        db.commit()
        log_action(db, uploader_id, "CSV Upload Failed", f"Failed uploading {filename}: {str(e)}")
        raise e

    return upload_record


def log_action(db: Session, user_id: int, action: str, details: str):
    audit = models.AuditLog(
        user_id=user_id,
        action=action,
        details=details
    )
    db.add(audit)
    
    log = models.Log(
        user_id=user_id,
        action=f"{action}: {details[:100]}"
    )
    db.add(log)
    db.commit()


def run_realtime_checks(db: Session):
    # Budget overruns check
    budgets = db.query(models.Budget).all()
    for budget in budgets:
        if budget.spent_amount > budget.allocated_amount:
            alert_msg = f"Budget overrun in Dept {budget.department.name} - Category '{budget.category}' for FY {budget.year}: spent ${budget.spent_amount:,.2f} exceeding allocated ${budget.allocated_amount:,.2f}."
            existing = db.query(models.Alert).filter(models.Alert.message == alert_msg).first()
            if not existing:
                alert = models.Alert(
                    type="Budget Overrun",
                    message=alert_msg
                )
                db.add(alert)
    
    # Abnormal large transaction check (> 100k USD)
    abnormal_txs = db.query(models.Transaction).filter(
        models.Transaction.amount > 100000.0,
        models.Transaction.type == "Expense"
    ).all()
    for tx in abnormal_txs:
        alert_msg = f"Abnormal transaction: Large expense of ${tx.amount:,.2f} in department {tx.department.name} on category '{tx.category}' on {tx.date.strftime('%Y-%m-%d')}."
        existing = db.query(models.Alert).filter(models.Alert.message == alert_msg).first()
        if not existing:
            alert = models.Alert(
                type="Abnormal Transaction",
                message=alert_msg
            )
            db.add(alert)

    db.commit()
