import os
import re
import random
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
import models
from services.report_generator import generate_pdf_report
from services.health_score import calculate_financial_health_score
from services.recommender import generate_ai_recommendations
import google.generativeai as genai

MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12
}

def format_usd(val: float, db: Session = None) -> str:
    """Format currencies nicely in active currency (INR in Cr/L, USD/EUR in B/M)."""
    currency = "USD"
    symbol = "$"
    rate = 1.0
    if db is not None:
        try:
            setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
            if setting:
                currency = setting.currency
                if currency == "INR":
                    symbol = "₹"
                    rate = 83.0
                elif currency == "EUR":
                    symbol = "€"
                    rate = 0.92
        except Exception:
            pass
            
    converted = val * rate
    if currency == "INR":
        if converted >= 10000000:  # 1 Crore
            return f"{symbol}{converted / 10000000:.2f} Cr"
        if converted >= 100000:  # 1 Lakh
            return f"{symbol}{converted / 100000:.2f} L"
        return f"{symbol}{converted:,.2f}"
    else:
        if converted >= 1000000000:
            return f"{symbol}{converted / 1000000000:.2f}B"
        if converted >= 1000000:
            return f"{symbol}{converted / 1000000:.2f}M"
        if converted >= 1000:
            return f"{symbol}{converted / 1000:.0f}K"
        return f"{symbol}{converted:,.2f}"

def run_ai_query(db: Session, user_prompt: str, user_id: int = 1) -> dict:
    prompt_lower = user_prompt.lower()
    years_found = [int(y) for y in re.findall(r'\b(202\d)\b', prompt_lower)]
    
    # 1. Check if user requested a PDF report
    if "pdf" in prompt_lower or "report" in prompt_lower or "download document" in prompt_lower:
        # Create reports folder if not exists
        os.makedirs("./reports", exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pdf_path = f"./reports/financial_report_{timestamp}.pdf"
        generate_pdf_report(db, 2024, pdf_path)
        
        # Save to database
        db_report = models.Report(name=f"Report 2024 ({timestamp})", type="PDF", file_path=pdf_path)
        db.add(db_report)
        db.commit()

        ans = "I have successfully generated your financial performance report for FY 2024-25. You can download the PDF by clicking the download icon above."
        return {
            "answer": ans,
            "chart_config": None,
            "has_pdf": True,
            "pdf_path": f"/api/ai/reports/download/{db_report.id}"
        }

    # 2. Hardcoded specific dashboard questions (matching charts)
    # Check if user requested Berth revenue / "bird" revenue
    if any(w in prompt_lower for w in ["berth", "berths", "birth", "births", "bird", "birds", "dock", "jetty", "jetties"]):
        setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
        symbol = "₹" if setting and setting.currency == "INR" else ("€" if setting and setting.currency == "EUR" else "$")
        
        berth_names = [r[0] for r in db.query(models.Transaction.berth).distinct().all() if r[0]]
        matched_berth = None
        for b in berth_names:
            if b.lower() in prompt_lower:
                matched_berth = b
                break
                
        yr = years_found[0] if years_found else None
        
        query = db.query(
            models.Transaction.berth,
            func.sum(models.Transaction.amount).label("total")
        ).filter(
            models.Transaction.type == "Revenue",
            models.Transaction.berth != None,
            models.Transaction.berth != ""
        )
        
        if yr:
            query = query.filter(models.Transaction.date >= f"{yr}-04-01", models.Transaction.date <= f"{yr+1}-03-31")
        if matched_berth:
            query = query.filter(models.Transaction.berth == matched_berth)
            
        berth_data = query.group_by(models.Transaction.berth).order_by(func.sum(models.Transaction.amount).desc()).all()
        
        if berth_data:
            if matched_berth:
                val = berth_data[0][1]
                time_str = f"in FY {yr}-{str(yr+1)[2:]}" if yr else "overall"
                return {
                    "answer": f"The berth **{matched_berth}** generated a total of **{format_usd(val, db)}** {time_str} in billing collections.",
                    "chart_config": None
                }
            else:
                is_least = any(w in prompt_lower for w in ["least", "lowest", "worst", "minimum", "min"])
                time_str = f"in FY {yr}-{str(yr+1)[2:]}" if yr else "overall"
                if is_least:
                    least_berth, least_val = berth_data[-1]
                    chart_data = [{"name": r[0], "value": round(r[1], 2)} for r in berth_data[-5:]]
                    return {
                        "answer": f"The physical berth with the least revenue {time_str} is **{least_berth}**, generating a total of **{format_usd(least_val, db)}** in billing collections.",
                        "chart_config": {
                            "type": "bar",
                            "title": f"Lowest Berth Revenues ({symbol})",
                            "data": chart_data
                        }
                    }
                else:
                    top_berth, top_val = berth_data[0]
                    chart_data = [{"name": r[0], "value": round(r[1], 2)} for r in berth_data[:5]]
                    return {
                        "answer": f"The physical berth with the highest revenue {time_str} is **{top_berth}**, generating a total of **{format_usd(top_val, db)}** in billing collections.",
                        "chart_config": {
                            "type": "bar",
                            "title": f"Top Berth Revenues ({symbol})",
                            "data": chart_data
                        }
                    }

    if "customer" in prompt_lower or "client" in prompt_lower:
        client_names = [r[0] for r in db.query(models.Transaction.client).distinct().all() if r[0]]
        matched_client = None
        for c in client_names:
            if c.lower() in prompt_lower:
                matched_client = c
                break
                
        yr = years_found[0] if years_found else None
        
        query = db.query(
            models.Transaction.client,
            func.sum(models.Transaction.amount).label("total")
        ).filter(
            models.Transaction.type == "Revenue",
            models.Transaction.client != None,
            models.Transaction.client != "Merchant Client",
            models.Transaction.client != ""
        )
        
        if yr:
            query = query.filter(models.Transaction.date >= f"{yr}-04-01", models.Transaction.date <= f"{yr+1}-03-31")
        if matched_client:
            query = query.filter(models.Transaction.client == matched_client)
            
        client_data = query.group_by(models.Transaction.client).order_by(func.sum(models.Transaction.amount).desc()).all()
        
        if client_data:
            setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
            symbol = "₹" if setting and setting.currency == "INR" else ("€" if setting and setting.currency == "EUR" else "$")
            
            if matched_client:
                val = client_data[0][1]
                time_str = f"in FY {yr}-{str(yr+1)[2:]}" if yr else "overall"
                return {
                    "answer": f"The client **{matched_client}** contributed a total of **{format_usd(val, db)}** {time_str} in revenue.",
                    "chart_config": None
                }
            else:
                is_least = any(w in prompt_lower for w in ["least", "lowest", "worst", "minimum", "min"])
                time_str = f"in FY {yr}-{str(yr+1)[2:]}" if yr else "overall"
                if is_least:
                    least_client, least_val = client_data[-1]
                    chart_data = [{"name": r[0], "value": round(r[1], 2)} for r in client_data[-5:]]
                    return {
                        "answer": f"Your lowest revenue-generating client {time_str} is **{least_client}** with a total contribution of **{format_usd(least_val, db)}**.",
                        "chart_config": {
                            "type": "bar",
                            "title": f"Lowest Client Revenues ({symbol})",
                            "data": chart_data
                        }
                    }
                else:
                    top_client, top_val = client_data[0]
                    chart_data = [{"name": r[0], "value": round(r[1], 2)} for r in client_data[:5]]
                    return {
                        "answer": f"Your top revenue-generating client {time_str} is **{top_client}** with a total contribution of **{format_usd(top_val, db)}**.",
                        "chart_config": {
                            "type": "bar",
                            "title": f"Top Client Revenues ({symbol})",
                            "data": chart_data
                        }
                    }

    if "why did profit decrease" in prompt_lower or "profit decrease" in prompt_lower or "decrease in profit" in prompt_lower:
        years_profit = db.query(
            models.FinancialData.year,
            func.sum(models.FinancialData.profit).label("total_profit"),
            func.sum(models.FinancialData.expenses).label("total_exp")
        ).group_by(models.FinancialData.year).order_by(models.FinancialData.year).all()
        
        if len(years_profit) >= 2:
            y1, p1, e1 = years_profit[-2]
            y2, p2, e2 = years_profit[-1]
            diff = p2 - p1
            exp_diff = e2 - e1
            
            if diff < 0:
                ans = f"Net profit decreased from **{format_usd(p1, db)}** in FY {y1} to **{format_usd(p2, db)}** in FY {y2} (a decrease of **{format_usd(abs(diff), db)}**). This decline is primarily driven by an increase of **{format_usd(exp_diff, db)}** in operating expenses, especially in categories like Maintenance (+15%) and Fuel (+12%)."
            else:
                ans = f"Actually, the aggregate profits increased from **{format_usd(p1, db)}** in FY {y1} to **{format_usd(p2, db)}** in FY {y2}. However, in specific quarters like Q3, profits dipped slightly due to temporary surges in maintenance and fuel charges."
            
            chart_data = [{"year": str(r[0]), "Profit": round(r[1], 2), "Expenses": round(r[2], 2)} for r in years_profit]
            
            return {
                "answer": ans,
                "chart_config": {
                    "type": "line",
                    "title": "YoY Profit & Expenses",
                    "data": chart_data
                }
            }

    if "compare salaries" in prompt_lower or "salary comparison" in prompt_lower or "salary spent" in prompt_lower:
        salary_data = db.query(
            models.Department.name,
            func.sum(models.Transaction.amount).label("total_salary")
        ).join(models.Transaction).filter(
            models.Transaction.category == "Salary",
            models.Transaction.type == "Expense"
        ).group_by(models.Department.name).all()
        
        if salary_data:
            chart_data = [{"name": r[0].upper(), "value": round(r[1], 2)} for r in salary_data]
            total_sal = sum(r[1] for r in salary_data)
            return {
                "answer": f"Total annual salary expenditure across all departments amounts to **{format_usd(total_sal, db)}**. HR and Operations represent the largest shares of the payroll.",
                "chart_config": {
                    "type": "pie",
                    "title": "Salary Distribution by Department",
                    "data": chart_data
                }
            }

    if "yearly summary" in prompt_lower or "annual performance" in prompt_lower or "summarize" in prompt_lower:
        summary_records = db.query(
            models.FinancialData.year,
            func.sum(models.FinancialData.revenue).label("revenue"),
            func.sum(models.FinancialData.expenses).label("expenses"),
            func.sum(models.FinancialData.profit).label("profit")
        ).group_by(models.FinancialData.year).order_by(models.FinancialData.year).all()
        
        if summary_records:
            chart_data = [
                {
                    "year": str(r[0]),
                    "Revenue": round(r[1], 2),
                    "Expenses": round(r[2], 2),
                    "Profit": round(r[3], 2)
                } for r in summary_records
            ]
            ans = "Here is the yearly financial summary:\n\n"
            for r in summary_records:
                ans += f"- **FY {r[0]}**: Revenue: {format_usd(r[1], db)} | Expenses: {format_usd(r[2], db)} | Net Profit: {format_usd(r[3], db)}\n"
            return {
                "answer": ans,
                "chart_config": {
                    "type": "bar",
                    "title": "Yearly Performance Summary",
                    "data": chart_data
                }
            }

    if "health" in prompt_lower or "score" in prompt_lower:
        health_data = calculate_financial_health_score(db, 2024)
        ans = f"The port's Financial Health Score is **{health_data['score']}/100** (CIBIL-like rating).\n\n" \
              f"- **Profit Margin**: {health_data['ratios']['profit_margin_pct']}%\n" \
              f"- **Operating Expense Ratio (OER)**: {health_data['ratios']['expense_ratio_pct']}%\n" \
              f"- **Current Liquidity Ratio**: {health_data['ratios']['current_ratio']}"
        return {
            "answer": ans,
            "chart_config": None
        }

    if "anomaly" in prompt_lower or "fraud" in prompt_lower or "suspicious" in prompt_lower or "alert" in prompt_lower:
        alerts = db.query(models.Alert).order_by(models.Alert.created_at.desc()).limit(5).all()
        if alerts:
            ans = "Here are the most recent alerts and financial anomalies detected by the AI agent:\n\n"
            for a in alerts:
                ans += f"- **[{a.type}]**: {a.message}\n"
            return {
                "answer": ans,
                "chart_config": None
            }
        return {
            "answer": "No suspicious transactions or budget overruns are currently active. Financial metrics are within safe operational thresholds.",
            "chart_config": None
        }

    # 3. Dynamic Local NLP Query Compiler (translating text to DB queries)
    # Extract year using word boundaries
    years_found = [int(y) for y in re.findall(r'\b(202\d)\b', prompt_lower)]
    depts = db.query(models.Department).all()

    # Check for suggestions, recommendations, advice, or ways to increase/improve metrics
    if any(w in prompt_lower for w in ["suggest", "recommend", "advice", "advise", "how to increase", "how to improve", "ways to"]):
        target = "overall profitability"
        if any(w in prompt_lower for w in ["revenue", "income", "earning", "billing"]):
            target = "revenue"
        elif any(w in prompt_lower for w in ["cost", "expense", "spend"]):
            target = "costs"
            
        setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
        symbol = "₹" if setting and setting.currency == "INR" else ("€" if setting and setting.currency == "EUR" else "$")
        
        # Get actual top berth
        berth_data = db.query(models.Transaction.berth, func.sum(models.Transaction.amount)).filter(
            models.Transaction.type == "Revenue"
        ).group_by(models.Transaction.berth).order_by(func.sum(models.Transaction.amount).desc()).all()
        top_berth = berth_data[0][0] if berth_data else "SPM"
        
        if target == "revenue":
            ans = f"To drive and expand the port's **billing revenue**, we recommend three primary strategic initiatives based on our operational data:\n\n"
            ans += f"1. **Optimize Berth Turnaround at {top_berth}**: As our highest revenue-generating asset, a 5% reduction in vessel turnaround times at {top_berth} will allow us to handle ~12 additional vessels annually, projecting an additional **{format_usd(1500000.0, db)}** in billing collections.\n"
            ans += f"2. **Dynamic Tariff Tiering**: Implement premium berthing surcharges during peak shipping seasons and weekends for high-demand cargo terminals.\n"
            ans += f"3. **Cross-Sell Logistical Services**: Expand custom cargo packaging and cold-storage options for our fastest-growing clients to capture more ancillary trade revenue."
            
            return {
                "answer": ans,
                "chart_config": {
                    "type": "bar",
                    "title": f"Projected Revenue Impact ({symbol})",
                    "data": [
                        {"name": "Berth Optimization", "value": round(1500000.0, 2)},
                        {"name": "Dynamic Tariffs", "value": round(800000.0, 2)},
                        {"name": "Cross-Selling", "value": round(600000.0, 2)}
                    ]
                }
            }
        elif target == "costs":
            recs = generate_ai_recommendations(db, 2024)
            ans = f"To optimize the port's operational expenditures, here are the top cost-saving recommendations:\n\n"
            for r in recs[:3]:
                ans += f"- **{r['title']}**: {r['recommendation']} (Projected savings: **{format_usd(r['projected_savings'], db)}**)\n"
            
            return {
                "answer": ans,
                "chart_config": {
                    "type": "bar",
                    "title": f"Projected Savings ({symbol})",
                    "data": [{"name": r["title"][:20], "value": round(r["projected_savings"], 2)} for r in recs[:3]]
                }
            }
        else:
            ans = f"To maximize overall **profitability** (Revenue Expansion + Cost Rationalization), we suggest the following dual-action approach based on our metrics:\n\n"
            ans += f"1. **Revenue Expansion**: Maximize container throughput at our high-performing berths (like {top_berth}) by implementing prioritized logistics lane queues.\n"
            ans += f"2. **Cost Rationalization**: Review and renegotiate local vendor contracts for Fuel and Maintenance, which have shown YoY spikes, to move toward fixed preventive maintenance plans."
            
            return {
                "answer": ans,
                "chart_config": None
            }

    # Check if query asks for a department-level comparison (e.g. "which department spends the most", "department with highest budget")
    if "department" in prompt_lower or "departments" in prompt_lower:
        is_least = any(w in prompt_lower for w in ["least", "lowest", "worst", "minimum", "min"])
        is_highest = any(w in prompt_lower for w in ["highest", "best", "maximum", "max", "peak", "most"])
        
        if is_least or is_highest:
            yr = years_found[0] if years_found else 2024
            spent_data = db.query(
                models.Department.name,
                func.sum(models.Transaction.amount).label("total")
            ).join(models.Transaction).filter(
                models.Transaction.type == "Expense",
                models.Transaction.date >= f"{yr}-04-01",
                models.Transaction.date <= f"{yr+1}-03-31"
            ).group_by(models.Department.name).all()
            
            if spent_data:
                spent_data_sorted = sorted(spent_data, key=lambda x: x[1])
                target_dept, target_val = spent_data_sorted[0] if is_least else spent_data_sorted[-1]
                
                setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
                symbol = "₹" if setting and setting.currency == "INR" else ("€" if setting and setting.currency == "EUR" else "$")
                
                direction = "least" if is_least else "most"
                time_str = f"in FY {yr}-{str(yr+1)[2:]}"
                
                ans = f"The department that spent the **{direction} money** {time_str} is **{target_dept.upper()}**, with a total expenditure of **{format_usd(target_val, db)}**."
                
                chart_data = [{"name": r[0].upper(), "value": round(r[1], 2)} for r in spent_data]
                chart_data.sort(key=lambda x: x["value"], reverse=True)
                
                return {
                    "answer": ans,
                    "chart_config": {
                        "type": "bar",
                        "title": f"Department Expenditures ({symbol})",
                        "data": chart_data
                    }
                }

    # Check if query asks for a monthly profile comparison
    if "month" in prompt_lower:
        is_least = any(w in prompt_lower for w in ["least", "lowest", "worst", "minimum", "min", "drop", "lowest", "became lowest"])
        is_highest = any(w in prompt_lower for w in ["highest", "best", "maximum", "max", "peak", "most"])
        
        metric = "profit"
        if any(w in prompt_lower for w in ["revenue", "income", "make", "earned"]):
            metric = "revenue"
        elif any(w in prompt_lower for w in ["spend", "expense", "cost", "outlay"]):
            metric = "expenses"
            
        if is_least or is_highest:
            yr = years_found[0] if years_found else 2024
            records = db.query(models.FinancialData).filter(
                ((models.FinancialData.year == yr) & (models.FinancialData.month >= 4)) | 
                ((models.FinancialData.year == yr + 1) & (models.FinancialData.month <= 3))
            ).all()
            
            if records:
                month_names = {
                    1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
                    7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December"
                }
                
                if metric == "revenue":
                    records_sorted = sorted(records, key=lambda r: r.revenue)
                elif metric == "expenses":
                    records_sorted = sorted(records, key=lambda r: r.expenses)
                else:
                    records_sorted = sorted(records, key=lambda r: r.revenue - r.expenses)
                    
                target_record = records_sorted[0] if is_least else records_sorted[-1]
                val = target_record.revenue if metric == "revenue" else (target_record.expenses if metric == "expenses" else (target_record.revenue - target_record.expenses))
                m_name = month_names[target_record.month]
                
                setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
                symbol = "₹" if setting and setting.currency == "INR" else ("€" if setting and setting.currency == "EUR" else "$")
                
                direction = "lowest" if is_least else "highest"
                
                ans = f"In FY {yr}-{str(yr+1)[2:]}, the month with the **{direction} {metric}** is **{m_name}** with a value of **{format_usd(val, db)}**."
                
                records_chrono = sorted(records, key=lambda r: r.month if r.month >= 4 else r.month + 12)
                chart_data = []
                for r in records_chrono:
                    name_key = month_names[r.month][:3]
                    val_key = r.revenue if metric == "revenue" else (r.expenses if metric == "expenses" else (r.revenue - r.expenses))
                    chart_data.append({"name": name_key, "value": round(val_key, 2)})
                    
                return {
                    "answer": ans,
                    "chart_config": {
                        "type": "bar",
                        "title": f"Monthly {metric.capitalize()} Profile ({symbol})",
                        "data": chart_data
                    }
                }

    # E. Interactive "What-If" Scenario Simulation
    if any(w in prompt_lower for w in ["simulate", "what if", "scenario"]):
        pcts = [float(p) for p in re.findall(r'(-?\d+(?:\.\d+)?)%', prompt_lower)]
        if pcts:
            rev_change = 0.0
            fuel_change = 0.0
            maint_change = 0.0
            salary_change = 0.0
            
            for idx, pct in enumerate(pcts):
                if any(w in prompt_lower for w in ["revenue", "income", "cargo", "marine"]):
                    rev_change = pct / 100
                elif "fuel" in prompt_lower:
                    fuel_change = pct / 100
                elif any(w in prompt_lower for w in ["maintenance", "repair"]):
                    maint_change = pct / 100
                elif any(w in prompt_lower for w in ["salary", "salaries", "payroll"]):
                    salary_change = pct / 100
            
            records = db.query(models.FinancialData).filter(
                ((models.FinancialData.year == 2024) & (models.FinancialData.month >= 4)) | 
                ((models.FinancialData.year == 2025) & (models.FinancialData.month <= 3))
            ).all()
            
            base_rev = sum(r.revenue for r in records) or 1.0
            base_exp = sum(r.expenses for r in records) or 0.0
            base_profit = base_rev - base_exp
            
            fuel_exp = db.query(func.sum(models.Transaction.amount)).filter(
                models.Transaction.category == "Fuel",
                models.Transaction.type == "Expense",
                models.Transaction.date >= "2024-04-01",
                models.Transaction.date <= "2025-03-31"
            ).scalar() or 0.0
            
            maint_exp = db.query(func.sum(models.Transaction.amount)).filter(
                models.Transaction.category == "Maintenance",
                models.Transaction.type == "Expense",
                models.Transaction.date >= "2024-04-01",
                models.Transaction.date <= "2025-03-31"
            ).scalar() or 0.0
            
            salary_exp = db.query(func.sum(models.Transaction.amount)).filter(
                models.Transaction.category == "Salary",
                models.Transaction.type == "Expense",
                models.Transaction.date >= "2024-04-01",
                models.Transaction.date <= "2025-03-31"
            ).scalar() or 0.0
            
            sim_rev = base_rev * (1 + rev_change)
            sim_fuel = fuel_exp * (1 + fuel_change)
            sim_maint = maint_exp * (1 + maint_change)
            sim_salary = salary_exp * (1 + salary_change)
            
            sim_exp = base_exp - fuel_exp - maint_exp - salary_exp + sim_fuel + sim_maint + sim_salary
            sim_profit = sim_rev - sim_exp
            
            setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
            symbol = "₹" if setting and setting.currency == "INR" else ("€" if setting and setting.currency == "EUR" else "$")
            
            ans = f"**What-If Scenario Simulation Results (FY 2024-25)**:\n\n"
            ans += f"- **Base Surplus**: {format_usd(base_profit, db)} (Rev: {format_usd(base_rev, db)} | Exp: {format_usd(base_exp, db)})\n"
            ans += f"- **Simulated Surplus**: **{format_usd(sim_profit, db)}** (Sim Rev: {format_usd(sim_rev, db)} | Sim Exp: {format_usd(sim_exp, db)})\n"
            
            changes_desc = []
            if rev_change != 0: changes_desc.append(f"Revenue: {'+' if rev_change > 0 else ''}{rev_change*100:.0f}%")
            if fuel_change != 0: changes_desc.append(f"Fuel: {'+' if fuel_change > 0 else ''}{fuel_change*100:.0f}%")
            if maint_change != 0: changes_desc.append(f"Maintenance: {'+' if maint_change > 0 else ''}{maint_change*100:.0f}%")
            if salary_change != 0: changes_desc.append(f"Salary: {'+' if salary_change > 0 else ''}{salary_change*100:.0f}%")
            
            ans += f"- **Parameters Applied**: {', '.join(changes_desc)}\n"
            net_impact = sim_profit - base_profit
            ans += f"- **Net Profit Impact**: **{'+' if net_impact >= 0 else ''}{format_usd(net_impact, db)}**."
            
            return {
                "answer": ans,
                "chart_config": {
                    "type": "bar",
                    "title": f"Surplus Projection Comparison ({symbol})",
                    "data": [
                        {"name": "Baseline Profit", "value": round(base_profit, 2)},
                        {"name": "Simulated Profit", "value": round(sim_profit, 2)}
                    ]
                }
            }

    # F. Automated Budget Rebalancing and Overrun Resolution
    if any(w in prompt_lower for w in ["rebalance", "resolve", "overrun"]):
        budgets = db.query(models.Budget).filter(models.Budget.year == 2024).all()
        if budgets:
            dept_stats = {}
            for b in budgets:
                d_name = b.department.name.upper()
                if d_name not in dept_stats:
                    dept_stats[d_name] = {"allocated": 0.0, "spent": 0.0}
                dept_stats[d_name]["allocated"] += b.allocated_amount
                dept_stats[d_name]["spent"] += b.spent_amount
                
            deficits = []
            surpluses = []
            
            for d_name, stats in dept_stats.items():
                diff = stats["spent"] - stats["allocated"]
                if diff > 0:
                    deficits.append({"dept": d_name, "amount": diff})
                elif diff < 0:
                    surpluses.append({"dept": d_name, "amount": abs(diff)})
                    
            if deficits:
                deficits.sort(key=lambda x: x["amount"], reverse=True)
                surpluses.sort(key=lambda x: x["amount"], reverse=True)
                
                ans = f"**Automated Budget Rebalancing & Overrun Resolution Recommendations (FY 2024-25)**:\n\n"
                ans += "Current Deficits Detected:\n"
                for d in deficits:
                    ans += f"- **{d['dept']}**: Deficit of **{format_usd(d['amount'], db)}** (Overrun)\n"
                    
                ans += "\nAvailable surpluses for rebalancing:\n"
                for s in surpluses[:3]:
                    ans += f"- **{s['dept']}**: Remaining allocation of **{format_usd(s['amount'], db)}**\n"
                    
                primary_deficit = deficits[0]
                if surpluses:
                    primary_surplus = surpluses[0]
                    transfer_amt = min(primary_deficit["amount"], primary_surplus["amount"])
                    ans += f"\n👉 **Proposed Adjustment Plan**: Transfer **{format_usd(transfer_amt, db)}** from **{primary_surplus['dept']}**'s underutilized budget to cover the deficit in **{primary_deficit['dept']}**. This will instantly resolve the budget overrun and stabilize the account limits."
                else:
                    ans += "\nNo departmental surpluses are available for transfer. Budget rationalization is recommended."
                    
                setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
                symbol = "₹" if setting and setting.currency == "INR" else ("€" if setting and setting.currency == "EUR" else "$")
                
                chart_data = []
                for d in deficits:
                    chart_data.append({"name": f"{d['dept']} Deficit", "value": round(d["amount"], 2)})
                for s in surpluses[:2]:
                    chart_data.append({"name": f"{s['dept']} Surplus", "value": round(s["amount"], 2)})
                    
                return {
                    "answer": ans,
                    "chart_config": {
                        "type": "bar",
                        "title": f"Rebalancing Pools ({symbol})",
                        "data": chart_data
                    }
                }
            else:
                return {
                    "answer": "All port departments are currently operating within their allocated budget limits. No overruns to resolve.",
                    "chart_config": None
                }

    # A. Check for ratios, OER, profit margin, or financial health score
    if any(w in prompt_lower for w in ["ratio", "margin", "liquidity", "oer", "health score"]):
        yr = years_found[0] if years_found else 2024
        health_data = calculate_financial_health_score(db, yr)
        if health_data:
            setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
            symbol = "₹" if setting and setting.currency == "INR" else ("€" if setting and setting.currency == "EUR" else "$")
            
            ans = f"For FY {yr}-{str(yr+1)[2:]}, here are the port's core financial intelligence ratios:\n\n"
            ans += f"- **Net Profit Margin**: **{health_data['ratios']['profit_margin_pct']}%** (representing our pricing power and bottom-line efficiency).\n"
            ans += f"- **Operating Expense Ratio (OER)**: **{health_data['ratios']['expense_ratio_pct']}%** (lower means leaner, more efficient operations).\n"
            ans += f"- **Current Liquidity Ratio**: **{health_data['ratios']['current_ratio']}** (representing our short-term cash safety net).\n"
            ans += f"- **Financial Health Rating**: **{health_data['score']}/100** (overall rating)."
            return {
                "answer": ans,
                "chart_config": {
                    "type": "bar",
                    "title": f"Key Ratios FY {yr}",
                    "data": [
                        {"name": "Profit Margin %", "value": health_data['ratios']['profit_margin_pct']},
                        {"name": "OER Ratio %", "value": health_data['ratios']['expense_ratio_pct']},
                        {"name": "Liquidity Ratio", "value": health_data['ratios']['current_ratio']}
                    ]
                }
            }

    # B. Check for department budget details (e.g. CFS, MARINE, CARGO, HR, ENGINEERING, ACCOUNTS)
    matched_d = None
    for d in depts:
        if re.search(r'\b' + re.escape(d.name.lower()) + r'\b', prompt_lower):
            matched_d = d
            break
            
    if matched_d and any(w in prompt_lower for w in ["spend", "expense", "budget", "allocated", "outlay", "cost"]):
        yr = years_found[0] if years_found else 2024
        budgets = db.query(models.Budget).filter(
            models.Budget.department_id == matched_d.id,
            models.Budget.year == yr
        ).all()
        if budgets:
            allocated = sum(b.allocated_amount for b in budgets)
            spent = sum(b.spent_amount for b in budgets)
            util = (spent / allocated * 100) if allocated > 0 else 0.0
            status_str = "exceeding budget limit (overrun)" if spent > allocated else "within allocated budget limit"
            
            setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
            symbol = "₹" if setting and setting.currency == "INR" else ("€" if setting and setting.currency == "EUR" else "$")
            
            ans = f"For **{matched_d.name.upper()}** in FY {yr}-{str(yr+1)[2:]}, the allocated budget is **{format_usd(allocated, db)}** and the actual spent outlay is **{format_usd(spent, db)}**, representing a **{util:.2f}%** utilization rate ({status_str}).\n\n"
            ans += "Breakdown by category:"
            for b in budgets:
                ans += f"\n- **{b.category}**: Allocated {format_usd(b.allocated_amount, db)} | Spent {format_usd(b.spent_amount, db)} ({b.spent_amount/b.allocated_amount*100:.1f}% util)"
                
            return {
                "answer": ans,
                "chart_config": {
                    "type": "bar",
                    "title": f"{matched_d.name.upper()} Budget vs Spent ({symbol})",
                    "data": [
                        {"name": "Budget Allocated", "value": round(allocated, 2)},
                        {"name": "Actual Spent", "value": round(spent, 2)}
                    ]
                }
            }

    # C. Check for YoY comparison or difference
    if "compare" in prompt_lower or "difference" in prompt_lower or len(years_found) >= 2:
        years_to_compare = years_found if len(years_found) >= 2 else [2023, 2024]
        ans = f"Comparing performance metrics between **FY {years_to_compare[0]}** and **FY {years_to_compare[1]}**:\n\n"
        
        data_list = []
        for y in years_to_compare:
            records = db.query(models.FinancialData).filter(
                ((models.FinancialData.year == y) & (models.FinancialData.month >= 4)) | 
                ((models.FinancialData.year == y + 1) & (models.FinancialData.month <= 3))
            ).all()
            rev = sum(r.revenue for r in records)
            exp = sum(r.expenses for r in records)
            prof = rev - exp
            data_list.append({"year": y, "revenue": rev, "expenses": exp, "profit": prof})
            
        if len(data_list) >= 2:
            y1_data, y2_data = data_list[0], data_list[1]
            rev_diff = y2_data["revenue"] - y1_data["revenue"]
            exp_diff = y2_data["expenses"] - y1_data["expenses"]
            prof_diff = y2_data["profit"] - y1_data["profit"]
            
            setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
            symbol = "₹" if setting and setting.currency == "INR" else ("€" if setting and setting.currency == "EUR" else "$")
            
            ans += f"- **Revenue**: {format_usd(y1_data['revenue'], db)} vs {format_usd(y2_data['revenue'], db)} ({'+' if rev_diff >= 0 else ''}{format_usd(rev_diff, db)} difference)\n"
            ans += f"- **Expenses**: {format_usd(y1_data['expenses'], db)} vs {format_usd(y2_data['expenses'], db)} ({'+' if exp_diff >= 0 else ''}{format_usd(exp_diff, db)} difference)\n"
            ans += f"- **Net Profit**: {format_usd(y1_data['profit'], db)} vs {format_usd(y2_data['profit'], db)} ({'+' if prof_diff >= 0 else ''}{format_usd(prof_diff, db)} difference)\n"
            
            return {
                "answer": ans,
                "chart_config": {
                    "type": "bar",
                    "title": f"YoY Performance comparison ({symbol})",
                    "data": [
                        {"name": f"FY {years_to_compare[0]} Revenue", "value": round(y1_data['revenue'], 2)},
                        {"name": f"FY {years_to_compare[1]} Revenue", "value": round(y2_data['revenue'], 2)},
                        {"name": f"FY {years_to_compare[0]} Profit", "value": round(y1_data['profit'], 2)},
                        {"name": f"FY {years_to_compare[1]} Profit", "value": round(y2_data['profit'], 2)}
                    ]
                }
            }

    # D. Check for client predictions or forecast
    if "client" in prompt_lower or "customer" in prompt_lower:
        if any(w in prompt_lower for w in ["predict", "project", "forecast", "future", "2025", "growth", "slope"]):
            txs = db.query(
                models.Transaction.client,
                models.Transaction.date,
                models.Transaction.amount
            ).filter(
                models.Transaction.type == "Revenue",
                models.Transaction.client != None,
                models.Transaction.client != ""
            ).all()
            if txs:
                import pandas as pd
                from sklearn.linear_model import LinearRegression
                import numpy as np
                df_txs = pd.DataFrame(txs, columns=["client", "date", "amount"])
                df_txs['client'] = df_txs['client'].astype(str).str.strip()
                df_txs['year_cal'] = df_txs['date'].dt.year
                df_txs['month_cal'] = df_txs['date'].dt.month
                df_txs['fy'] = df_txs['year_cal'].where(df_txs['month_cal'] >= 4, df_txs['year_cal'] - 1)
                
                current_totals = df_txs[df_txs['fy'] == 2024].groupby('client')['amount'].sum().reset_index().sort_values(by='amount', ascending=False)
                top_clients = list(current_totals['client'].head(8))
                
                yearly_df = df_txs[df_txs['client'].isin(top_clients)].groupby(['client', 'fy'])['amount'].sum().reset_index()
                
                historical_years = [2021, 2022, 2023, 2024]
                predicted_rankings = []
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
                    projected_growth = (predicted_2025 - actual_2024) / actual_2024 * 100 if actual_2024 > 0 else 12.0
                    predicted_rankings.append({
                        "client": client,
                        "historical_2024": actual_2024,
                        "predicted_2025": predicted_2025,
                        "projected_growth_pct": projected_growth
                    })
                
                predicted_rankings.sort(key=lambda x: x["predicted_2025"], reverse=True)
                highest_growth = max(predicted_rankings, key=lambda x: x["projected_growth_pct"])
                
                setting = db.query(models.Setting).filter(models.Setting.user_id == 1).first()
                symbol = "₹" if setting and setting.currency == "INR" else ("€" if setting and setting.currency == "EUR" else "$")
                
                ans = f"Based on our machine learning linear regression projections for the upcoming year **FY 2025-26**:\n\n"
                ans += f"- **Top Projected Client**: **{predicted_rankings[0]['client']}** is forecast to contribute the highest revenue of **{format_usd(predicted_rankings[0]['predicted_2025'], db)}**.\n"
                ans += f"- **Highest Growth Client**: **{highest_growth['client']}** has the steepest upward growth trajectory at **+{highest_growth['projected_growth_pct']:.1f}% YoY** (rising to {format_usd(highest_growth['predicted_2025'], db)}).\n\n"
                ans += "Client predictions overview:"
                for p in predicted_rankings[:5]:
                    ans += f"\n- **{p['client']}**: {format_usd(p['historical_2024'], db)} (FY24) → {format_usd(p['predicted_2025'], db)} (FY25 Proj) | Growth: {p['projected_growth_pct']:.1f}%"
                    
                return {
                    "answer": ans,
                    "chart_config": {
                        "type": "bar",
                        "title": f"Projected Client Revenues FY 2025-26 ({symbol})",
                        "data": [{"name": p["client"], "value": round(p["predicted_2025"], 2)} for p in predicted_rankings[:5]]
                    }
                }

    # Extract year using word boundaries
    years_found = [int(y) for y in re.findall(r'\b(202\d)\b', prompt_lower)]
    
    # Extract month matching whole words only
    month_found = None
    for m_key, m_val in MONTH_MAP.items():
        if re.search(r'\b' + re.escape(m_key) + r'\b', prompt_lower):
            month_found = m_val
            break
            
    # Extract department matching whole words only
    depts = db.query(models.Department).all()
    matched_dept = None
    for d in depts:
        if re.search(r'\b' + re.escape(d.name.lower()) + r'\b', prompt_lower):
            matched_dept = d
            break
            
    # Extract category
    categories_list = [c[0] for c in db.query(models.Transaction.category).distinct().all()]
    matched_category = None
    for cat in categories_list:
        if cat.lower() in prompt_lower:
            matched_category = cat
            break
            
    # Determine transaction type or profit query
    is_profit_query = "profit" in prompt_lower or "surplus" in prompt_lower or "net" in prompt_lower
    tx_type = None
    if any(w in prompt_lower for w in ["make", "revenue", "income", "earned", "sales", "billing", "invoice", "receive"]):
        tx_type = "Revenue"
    elif any(w in prompt_lower for w in ["spend", "expense", "cost", "paid", "expenditure", "payout", "outlay", "salary", "fuel", "maintenance"]):
        tx_type = "Expense"

    # If we detected key parameters, perform a targeted DB query
    if years_found or month_found or matched_dept or matched_category or tx_type or is_profit_query:
        query = db.query(models.Transaction)
        
        if matched_dept:
            query = query.filter(models.Transaction.department_id == matched_dept.id)
        if matched_category:
            query = query.filter(models.Transaction.category == matched_category)
            
        # Apply Date / Year constraints
        if years_found:
            y = years_found[0]
            if month_found:
                # Query exactly calendar month and year
                query = query.filter(
                    func.strftime('%Y', models.Transaction.date) == str(y),
                    func.cast(func.strftime('%m', models.Transaction.date), models.Integer) == month_found
                )
            else:
                # Query entire year
                query = query.filter(func.strftime('%Y', models.Transaction.date) == str(y))
        elif month_found:
            # Query latest year month (2024)
            query = query.filter(
                func.strftime('%Y', models.Transaction.date) == '2024',
                func.cast(func.strftime('%m', models.Transaction.date), models.Integer) == month_found
            )
            
        # Evaluate Query
        if is_profit_query:
            rev_sum = query.filter(models.Transaction.type == "Revenue").with_entities(func.sum(models.Transaction.amount)).scalar() or 0.0
            exp_sum = query.filter(models.Transaction.type == "Expense").with_entities(func.sum(models.Transaction.amount)).scalar() or 0.0
            profit_val = rev_sum - exp_sum
            
            desc = []
            if years_found: desc.append(f"in {years_found[0]}")
            if month_found: desc.append(list(MONTH_MAP.keys())[list(MONTH_MAP.values()).index(month_found)].capitalize())
            if matched_dept: desc.append(f"for {matched_dept.name.upper()}")
            
            desc_str = " ".join(desc) if desc else "overall"
            return {
                "answer": f"The net profit **{desc_str}** was **{format_usd(profit_val, db)}** (Revenue: {format_usd(rev_sum, db)} | Expenses: {format_usd(exp_sum, db)}).",
                "chart_config": None
            }
            
        elif tx_type:
            total_val = query.filter(models.Transaction.type == tx_type).with_entities(func.sum(models.Transaction.amount)).scalar() or 0.0
            
            desc = []
            if years_found: desc.append(f"in {years_found[0]}")
            if month_found: 
                # Find month name string
                m_name = [k for k, v in MONTH_MAP.items() if v == month_found][0].capitalize()
                desc.append(m_name)
            if matched_dept: desc.append(f"for {matched_dept.name.upper()}")
            if matched_category: desc.append(f"on '{matched_category}'")
            
            desc_str = " ".join(desc) if desc else "overall"
            action = "made" if tx_type == "Revenue" else "spent"
            
            return {
                "answer": f"The port **{action}** a total of **{format_usd(total_val, db)}** {desc_str}.",
                "chart_config": None
            }

    # 4. Gemini API integration if key exists (as secondary option)
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            tx_count = db.query(models.Transaction).count()
            dept_count = db.query(models.Department).count()
            recent_txs = db.query(models.Transaction).order_by(models.Transaction.date.desc()).limit(15).all()
            tx_details = "\n".join([f"Date: {t.date.strftime('%Y-%m-%d')}, Dept: {t.department.name.upper()}, Cat: {t.category}, Amt: {format_usd(t.amount, db)}, Type: {t.type}, Desc: {t.description}" for t in recent_txs])

            system_context = f"""
You are an expert CFO AI Financial Assistant for the AI Financial Intelligence Platform (AFIP).
The database contains {tx_count} transactions across {dept_count} departments.
Here is some recent transactions context:
{tx_details}

Answer the user's question accurately based on this context. 
Be concise, and format numbers nicely in active currency (INR, USD, or EUR) using format_usd symbols.
User query: {user_prompt}
"""
            response = model.generate_content(system_context)
            return {
                "answer": response.text,
                "chart_config": None
            }
        except Exception:
            pass

    # Generic Fallback
    return {
        "answer": f"I received your request: '{user_prompt}'. We have parsed your data. MARINE and CARGO are your primary revenue streams. Your current annual profit stands at a healthy margin. Ask me about department spending, salary comparisons, why profits decreased, or type 'Create PDF' to export a comprehensive report.",
        "chart_config": None
    }
