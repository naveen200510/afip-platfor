from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
import numpy as np
from sklearn.linear_model import LinearRegression
import models, schemas, database, auth
from services.health_score import calculate_financial_health_score
from services.forecaster import forecast_financials, forecast_department_spending

router = APIRouter(prefix="/dashboard", tags=["Financial Analytics"])

@router.get("/kpis")
def get_kpis(year: int = 2024, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    records = db.query(models.FinancialData).filter(
        ((models.FinancialData.year == year) & (models.FinancialData.month >= 4)) | 
        ((models.FinancialData.year == year + 1) & (models.FinancialData.month <= 3))
    ).all()
    
    total_rev = sum(r.revenue for r in records)
    total_exp = sum(r.expenses for r in records)
    total_profit = total_rev - total_exp
    net_cf = sum(r.cash_flow for r in records)
    avg_assets = sum(r.assets for r in records) / len(records) if records else 15000000.0
    avg_liabilities = sum(r.liabilities for r in records) / len(records) if records else 8000000.0
    
    # Calculate operating costs (all expenses excluding salaries)
    salaries = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.category == "Salary",
        models.Transaction.type == "Expense",
        models.Transaction.date >= f"{year}-04-01",
        models.Transaction.date <= f"{year+1}-03-31"
    ).scalar() or 0.0
    operating_cost = total_exp - salaries
    
    # Budget utilization
    budget_alloc = db.query(func.sum(models.Budget.allocated_amount)).filter(models.Budget.year == year).scalar() or 1.0
    budget_spent = db.query(func.sum(models.Budget.spent_amount)).filter(models.Budget.year == year).scalar() or 0.0
    budget_util = (budget_spent / budget_alloc * 100) if budget_alloc > 0 else 0.0
    
    # Growth YoY
    prev_records = db.query(models.FinancialData).filter(
        ((models.FinancialData.year == year - 1) & (models.FinancialData.month >= 4)) | 
        ((models.FinancialData.year == year) & (models.FinancialData.month <= 3))
    ).all()
    prev_rev = sum(r.revenue for r in prev_records) if prev_records else 0.0
    growth = ((total_rev - prev_rev) / prev_rev * 100) if prev_rev > 0 else 12.5 # default mock growth

    health_data = calculate_financial_health_score(db, year)

    # Return structured KPIs (Module 3 + Module 10)
    return {
        "revenue": round(total_rev, 2),
        "expenses": round(total_exp, 2),
        "profit": round(total_profit, 2),
        "growth": round(growth, 2),
        "cash_flow": round(net_cf, 2),
        "assets": round(avg_assets, 2),
        "liabilities": round(avg_liabilities, 2),
        "operating_cost": round(operating_cost, 2),
        "budget_utilization": round(budget_util, 2),
        "health_score": health_data["score"],
        "ratios": health_data["ratios"]
    }

@router.get("/charts")
def get_charts_data(year: int = 2024, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    records = db.query(models.FinancialData).filter(
        ((models.FinancialData.year == year) & (models.FinancialData.month >= 4)) | 
        ((models.FinancialData.year == year + 1) & (models.FinancialData.month <= 3))
    ).all()
    
    # Sort from April to March
    records.sort(key=lambda r: r.month if r.month >= 4 else r.month + 12)
    
    # 1. Line Chart Data (Monthly Revenue vs Expenses vs Profit)
    line_data = []
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for r in records:
        line_data.append({
            "name": month_names[r.month - 1],
            "Revenue": round(r.revenue, 2),
            "Expenses": round(r.expenses, 2),
            "Profit": round(r.profit, 2)
        })
        
    # 2. Pie Chart Data (Expenses by Category)
    category_totals = db.query(
        models.Transaction.category,
        func.sum(models.Transaction.amount).label("total")
    ).filter(
        models.Transaction.type == "Expense",
        models.Transaction.date >= f"{year}-04-01",
        models.Transaction.date <= f"{year+1}-03-31"
    ).group_by(models.Transaction.category).all()
    pie_data = [{"name": r[0], "value": round(r[1], 2)} for r in category_totals]
    
    # 3. Bar Chart Data (Department budgets allocated vs spent)
    dept_budgets = db.query(
        models.Department.name,
        func.sum(models.Budget.allocated_amount).label("alloc"),
        func.sum(models.Budget.spent_amount).label("spent")
    ).join(models.Budget, models.Budget.department_id == models.Department.id).filter(
        models.Budget.year == year
    ).group_by(models.Department.name).all()
    bar_data = [{"name": r[0], "Allocated": round(r[1], 2), "Spent": round(r[2], 2)} for r in dept_budgets]

    # 4. Heatmap Data (Expenses by Category across Months)
    # We will format this as a list of coordinate records for simple frontend rendering
    heatmap_raw = db.query(
        models.Transaction.category,
        func.strftime("%m", models.Transaction.date).label("month"),
        func.sum(models.Transaction.amount)
    ).filter(
        models.Transaction.type == "Expense",
        models.Transaction.date >= f"{year}-04-01",
        models.Transaction.date <= f"{year+1}-03-31"
    ).group_by(models.Transaction.category, func.strftime("%m", models.Transaction.date)).all()
    
    heatmap_data = []
    for cat, month_str, amount in heatmap_raw:
        m_idx = int(month_str) - 1
        heatmap_data.append({
            "category": cat,
            "month": month_names[m_idx],
            "amount": round(amount, 2)
        })

    # 5. Treemap Data (Departmental Budget Breakdowns)
    treemap_data = {
        "name": f"Budgets FY {year}",
        "children": []
    }
    for dept_name, alloc, spent in dept_budgets:
        treemap_data["children"].append({
            "name": dept_name,
            "value": round(alloc, 2)
        })

    # 6. Area Chart Data (Cumulative Cash Flow)
    cumulative_cf = 0.0
    area_data = []
    for r in records:
        cumulative_cf += r.cash_flow
        area_data.append({
            "name": month_names[r.month - 1],
            "CashFlow": round(r.cash_flow, 2),
            "Cumulative": round(cumulative_cf, 2)
        })

    # 7. Radar Chart Data (Department KPI metrics: Efficiency, Growth, Profitability)
    # Let's mock a structured comparison for departments
    radar_data = []
    for dept_name, alloc, spent in dept_budgets:
        efficiency = round(100 - (spent/alloc * 100 if alloc > 0 else 50), 2)
        radar_data.append({
            "subject": dept_name,
            "Efficiency": max(10, min(100, efficiency)),
            "BudgetUsage": round(min(100, spent/alloc*100 if alloc > 0 else 0), 2),
            "CostSavings": round(max(0, (alloc - spent)/1000.0), 2)
        })

    # 8. Waterfall Chart Data (Revenue to Net Profit progression)
    total_revenue = sum(r.revenue for r in records) or 1000000.0
    total_expenses = sum(r.expenses for r in records) or 800000.0
    net_profit = total_revenue - total_expenses
    
    salaries = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.category == "Salary",
        models.Transaction.type == "Expense",
        models.Transaction.date >= f"{year}-04-01",
        models.Transaction.date <= f"{year+1}-03-31"
    ).scalar() or 0.0
    operating_cost = total_expenses - salaries
    
    waterfall_data = [
        {"name": "Total Revenue", "value": round(total_revenue, 2), "summary": True},
        {"name": "Salaries", "value": -round(salaries, 2), "summary": False},
        {"name": "Operating Cost", "value": -round(operating_cost, 2), "summary": False},
        {"name": "Net Profit", "value": round(net_profit, 2), "summary": True}
    ]

    # 9. Sankey Chart Data (Flow from Revenue Sources -> Departments -> Categories)
    sankey_data = {
        "nodes": [
            {"name": "Product Sales"}, {"name": "Service Consulting"}, # Revenues
            {"name": "Engineering"}, {"name": "Operations"}, {"name": "Maintenance"}, {"name": "HR"}, # Middle depts
            {"name": "Salary"}, {"name": "Fuel"}, {"name": "Equipment/Repair"}, {"name": "Other"} # Categories
        ],
        "links": [
            {"source": 0, "target": 2, "value": 25000000},
            {"source": 0, "target": 3, "value": 15000000},
            {"source": 1, "target": 4, "value": 5000000},
            {"source": 2, "target": 6, "value": 12000000},
            {"source": 2, "target": 8, "value": 8000000},
            {"source": 3, "target": 6, "value": 8000000},
            {"source": 3, "target": 7, "value": 4000000},
            {"source": 4, "target": 8, "value": 3000000},
            {"source": 5, "target": 6, "value": 2000000}
        ]
    }

    return {
        "line": line_data,
        "pie": pie_data,
        "bar": bar_data,
        "heatmap": heatmap_data,
        "treemap": treemap_data,
        "area": area_data,
        "radar": radar_data,
        "waterfall": waterfall_data,
        "sankey": sankey_data
    }

@router.get("/compare")
def compare_years(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Yearly Comparison (Module 4) - Aggregated by Financial Year (April - March)
    """
    records = db.query(models.FinancialData).all()
    if not records:
        return [
            {"year": 2021, "revenue": 2931365853.0, "expenses": 2470381091.0, "profit": 460984762.0, "yoy_growth_pct": 0.0},
            {"year": 2022, "revenue": 3325412362.0, "expenses": 2694391322.0, "profit": 631021040.0, "yoy_growth_pct": 13.4},
            {"year": 2023, "revenue": 4626078254.0, "expenses": 2807452232.0, "profit": 1818626022.0, "yoy_growth_pct": 39.1},
            {"year": 2024, "revenue": 4946483114.0, "expenses": 3274918818.0, "profit": 1671564296.0, "yoy_growth_pct": 6.9}
        ]
        
    fy_groups = {}
    for r in records:
        fy = r.year if r.month >= 4 else r.year - 1
        if fy not in fy_groups:
            fy_groups[fy] = {"revenue": 0.0, "expenses": 0.0}
        fy_groups[fy]["revenue"] += r.revenue
        fy_groups[fy]["expenses"] += r.expenses
        
    comparison = []
    sorted_years = sorted(fy_groups.keys())
    for idx, yr in enumerate(sorted_years):
        rev = fy_groups[yr]["revenue"]
        exp = fy_groups[yr]["expenses"]
        prof = rev - exp
        
        yoy_growth = 0.0
        if idx > 0:
            prev_rev = fy_groups[sorted_years[idx-1]]["revenue"]
            if prev_rev > 0:
                yoy_growth = (rev - prev_rev) / prev_rev * 100
                
        comparison.append({
            "year": yr,
            "revenue": round(rev, 2),
            "expenses": round(exp, 2),
            "profit": round(prof, 2),
            "yoy_growth_pct": round(yoy_growth, 2)
        })
        
    return comparison

@router.post("/simulate", response_model=schemas.ScenarioSimulationOutput)
def simulate_scenario(
    inputs: schemas.ScenarioSimulationInput,
    year: int = 2024,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Scenario Simulation (Module 16) - "What if" recalculation engine
    """
    records = db.query(models.FinancialData).filter(
        ((models.FinancialData.year == year) & (models.FinancialData.month >= 4)) | 
        ((models.FinancialData.year == year + 1) & (models.FinancialData.month <= 3))
    ).all()
    
    orig_rev = sum(r.revenue for r in records)
    orig_exp = sum(r.expenses for r in records)
    
    if orig_rev == 0 or orig_exp == 0:
        # Defaults for mock simulation
        orig_rev = 48000000.0
        orig_exp = 38000000.0

    orig_profit = orig_rev - orig_exp
    orig_cf = orig_rev - orig_exp # simplified cash flow

    # Fetch salary, fuel, maintenance category spending
    salary_spend = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.category == "Salary",
        models.Transaction.type == "Expense",
        models.Transaction.date >= f"{year}-04-01",
        models.Transaction.date <= f"{year+1}-03-31"
    ).scalar() or (orig_exp * 0.55)

    fuel_spend = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.category == "Fuel",
        models.Transaction.type == "Expense",
        models.Transaction.date >= f"{year}-04-01",
        models.Transaction.date <= f"{year+1}-03-31"
    ).scalar() or (orig_exp * 0.12)

    maint_spend = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.category.in_(["Maintenance", "Repair"]),
        models.Transaction.type == "Expense",
        models.Transaction.date >= f"{year}-04-01",
        models.Transaction.date <= f"{year+1}-03-31"
    ).scalar() or (orig_exp * 0.15)

    other_spend = orig_exp - (salary_spend + fuel_spend + maint_spend)

    # Apply simulation adjustments
    sim_rev = orig_rev * (1 + inputs.revenue_change_pct / 100.0)
    
    sim_salary = salary_spend * (1 + inputs.salary_change_pct / 100.0)
    sim_fuel = fuel_spend * (1 + inputs.fuel_change_pct / 100.0)
    sim_maint = maint_spend * (1 + inputs.maintenance_change_pct / 100.0)
    
    sim_exp = sim_salary + sim_fuel + sim_maint + other_spend
    sim_profit = sim_rev - sim_exp
    sim_cf = sim_rev - sim_exp

    # Resolve active currency preferences
    setting = db.query(models.Setting).filter(models.Setting.user_id == current_user.id).first()
    cur = "USD"
    if setting and setting.currency:
        cur = setting.currency
    rate = 83.0 if cur == "INR" else (0.92 if cur == "EUR" else 1.0)
    sym = "₹" if cur == "INR" else ("€" if cur == "EUR" else "$")

    def format_val(val_usd):
        converted = val_usd * rate
        if cur == "INR":
            if converted >= 10000000:
                return f"{sym}{converted/10000000:,.2f} Cr"
            if converted >= 100000:
                return f"{sym}{converted/100000:,.2f} L"
            return f"{sym}{converted:,.2f}"
        else:
            if converted >= 1000000000:
                return f"{sym}{converted/1000000000:,.2f}B"
            if converted >= 1000000:
                return f"{sym}{converted/1000000:,.2f}M"
            return f"{sym}{converted:,.2f}"

    details = []
    if inputs.salary_change_pct != 0:
        details.append(f"Salary adjustments ({inputs.salary_change_pct:+.1f}%) changed payroll spending from {format_val(salary_spend)} to {format_val(sim_salary)}.")
    if inputs.fuel_change_pct != 0:
        details.append(f"Fuel adjustments ({inputs.fuel_change_pct:+.1f}%) changed fuel spending from {format_val(fuel_spend)} to {format_val(sim_fuel)}.")
    if inputs.maintenance_change_pct != 0:
        details.append(f"Maintenance adjustments ({inputs.maintenance_change_pct:+.1f}%) changed repairs spending from {format_val(maint_spend)} to {format_val(sim_maint)}.")
    if inputs.revenue_change_pct != 0:
        details.append(f"Revenue adjustments ({inputs.revenue_change_pct:+.1f}%) changed total turnover from {format_val(orig_rev)} to {format_val(sim_rev)}.")

    return {
        "original_revenue": round(orig_rev, 2),
        "simulated_revenue": round(sim_rev, 2),
        "original_expenses": round(orig_exp, 2),
        "simulated_expenses": round(sim_exp, 2),
        "original_profit": round(orig_profit, 2),
        "simulated_profit": round(sim_profit, 2),
        "original_cash_flow": round(orig_cf, 2),
        "simulated_cash_flow": round(sim_cf, 2),
        "details": details
    }

@router.get("/departments")
def get_department_analytics(year: int = 2024, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Department Analytics (Module 17) - Separate KPIs, Forecast, and Ranking
    """
    depts = db.query(models.Department).all()
    analytics = []
    
    for dept in depts:
        expense_sum = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.department_id == dept.id,
            models.Transaction.type == "Expense",
            models.Transaction.date >= f"{year}-04-01",
            models.Transaction.date <= f"{year+1}-03-31"
        ).scalar() or 0.0

        revenue_sum = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.department_id == dept.id,
            models.Transaction.type == "Revenue",
            models.Transaction.date >= f"{year}-04-01",
            models.Transaction.date <= f"{year+1}-03-31"
        ).scalar() or 0.0
        
        alloc = db.query(func.sum(models.Budget.allocated_amount)).filter(
            models.Budget.department_id == dept.id,
            models.Budget.year == year
        ).scalar() or 0.0
        spent = db.query(func.sum(models.Budget.spent_amount)).filter(
            models.Budget.department_id == dept.id,
            models.Budget.year == year
        ).scalar() or 0.0
        
        future_forecast = forecast_department_spending(db, dept.id)
        forecast_total = sum(f["value"] for f in future_forecast) if future_forecast else (spent * 1.05)

        analytics.append({
            "id": dept.id,
            "name": dept.name,
            "revenue": round(revenue_sum, 2),
            "expenses": round(expense_sum, 2),
            "budget_allocated": round(alloc, 2),
            "budget_spent": round(spent, 2),
            "forecast_spent_2025": round(forecast_total, 2),
            "utilization_pct": round(spent/alloc*100 if alloc > 0 else 0.0, 2)
        })

    # Sort departments by expenses (ranking)
    analytics.sort(key=lambda x: x["expenses"], reverse=True)
    for idx, item in enumerate(analytics):
        item["expense_rank"] = idx + 1

    return analytics

@router.get("/clients")
def get_client_analytics(
    year: int = 2024, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    import pandas as pd
    
    # 1. Fetch all revenue transactions in a single query
    txs = db.query(
        models.Transaction.client,
        models.Transaction.date,
        models.Transaction.amount
    ).filter(
        models.Transaction.type == "Revenue",
        models.Transaction.client != None,
        models.Transaction.client != ""
    ).all()

    if not txs:
        return {
            "current_rankings": [],
            "predicted_rankings": [],
            "timeline_data": [],
            "highest_growth_client": "N/A",
            "highest_growth_pct": 0.0,
            "top_projected_client": "N/A"
        }

    # Load into Pandas DataFrame for high-performance vectorized operations
    df = pd.DataFrame(txs, columns=["client", "date", "amount"])
    
    # Clean client name strings
    df['client'] = df['client'].astype(str).str.strip()
    
    # Vectorized Financial Year calculation (April - March)
    df['year_cal'] = df['date'].dt.year
    df['month_cal'] = df['date'].dt.month
    df['fy'] = df['year_cal'].where(df['month_cal'] >= 4, df['year_cal'] - 1)

    # 2. Compile current rankings
    df_current = df[df['fy'] == year]
    current_totals = df_current.groupby('client').agg(
        total=('amount', 'sum'),
        count=('amount', 'count')
    ).reset_index().sort_values(by='total', ascending=False)
    
    current_rankings = []
    for idx, row in enumerate(current_totals.itertuples()):
        current_rankings.append({
            "rank": idx + 1,
            "client": row.client,
            "revenue": round(row.total, 2),
            "transactions_count": int(row.count)
        })

    # To avoid rendering 295 lines on the chart, focus predictions and line trends on the top 8 clients
    top_clients = list(current_totals['client'].head(8))
    if not top_clients:
        top_clients = list(df.groupby('client')['amount'].sum().sort_values(ascending=False).head(8).index)

    # Group by client & financial year for regression input
    yearly_df = df[df['client'].isin(top_clients)].groupby(['client', 'fy'])['amount'].sum().reset_index()

    historical_years = [2021, 2022, 2023, 2024]
    predicted_rankings = []
    
    # 3. Perform ML linear regression for top clients
    for client in top_clients:
        yearly_revenues = {}
        client_years = yearly_df[yearly_df['client'] == client]
        
        for yr in historical_years:
            val_row = client_years[client_years['fy'] == yr]
            yearly_revenues[yr] = float(val_row['amount'].values[0]) if not val_row.empty else 0.0
            
        X = np.array(historical_years).reshape(-1, 1)
        y = np.array([yearly_revenues[yr] for yr in historical_years])
        
        reg_model = LinearRegression()
        reg_model.fit(X, y)
        
        predicted_2025 = float(reg_model.predict([[2025]])[0])
        predicted_2025 = max(50000.0, predicted_2025)
        
        actual_2024 = yearly_revenues[2024]
        if actual_2024 > 0:
            projected_growth = (predicted_2025 - actual_2024) / actual_2024 * 100
        else:
            projected_growth = 12.0
            
        predicted_rankings.append({
            "client": client,
            "historical_2024": round(actual_2024, 2),
            "predicted_2025": round(predicted_2025, 2),
            "projected_growth_pct": round(projected_growth, 2)
        })
        
    predicted_rankings.sort(key=lambda x: x["predicted_2025"], reverse=True)
    for idx, item in enumerate(predicted_rankings):
        item["projected_rank"] = idx + 1

    # 4. Generate Timeline Data for Recharts Trajectories
    timeline_data = []
    all_years = historical_years + [2025]
    
    for yr in all_years:
        year_entry = {"year": f"FY {yr}-{str(yr+1)[2:]}" if yr < 2025 else "FY 2025-26 (Proj)"}
        for client in top_clients:
            if yr < 2025:
                client_years = yearly_df[(yearly_df['client'] == client) & (yearly_df['fy'] == yr)]
                val = float(client_years['amount'].values[0]) if not client_years.empty else 0.0
                year_entry[client] = round(val, 2)
            else:
                pred_item = next((p for p in predicted_rankings if p["client"] == client), None)
                year_entry[client] = pred_item["predicted_2025"] if pred_item else 0.0
        timeline_data.append(year_entry)

    highest_growth_item = max(predicted_rankings, key=lambda x: x["projected_growth_pct"]) if predicted_rankings else None

    return {
        "current_rankings": current_rankings,
        "predicted_rankings": predicted_rankings,
        "timeline_data": timeline_data,
        "highest_growth_client": highest_growth_item["client"] if highest_growth_item else "N/A",
        "highest_growth_pct": highest_growth_item["projected_growth_pct"] if highest_growth_item else 0.0,
        "top_projected_client": predicted_rankings[0]["client"] if predicted_rankings else "N/A"
    }

@router.get("/berths")
def get_berth_analytics(
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Berth Operations & Revenue Analytics (Module Extension)
    """
    # 1. Total Berth Hire revenue
    total_berth_hire = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.type == "Revenue",
        models.Transaction.category.like("%Berth%")
    ).scalar() or 0.0
    
    # 2. Revenue made from each berth (group by berth name)
    berth_totals = db.query(
        models.Transaction.berth,
        func.sum(models.Transaction.amount).label("total")
    ).filter(
        models.Transaction.type == "Revenue",
        models.Transaction.berth != None,
        models.Transaction.berth != ""
    ).group_by(models.Transaction.berth).order_by(func.sum(models.Transaction.amount).desc()).all()
    
    data = []
    for berth_name, total in berth_totals:
        data.append({
            "berth": berth_name,
            "revenue": round(total, 2)
        })
        
    return {
        "total_berth_charges": round(total_berth_hire, 2),
        "berth_revenues": data
    }
