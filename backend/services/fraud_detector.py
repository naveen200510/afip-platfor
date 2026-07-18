from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from datetime import timedelta
import numpy as np
import models

def detect_financial_anomalies(db: Session) -> List[Dict[str, Any]]:
    anomalies = []

    # 1. Detect Duplicate Payments
    # Definition: Transactions in the same department, category, and same amount within a 48-hour window.
    txs = db.query(models.Transaction).order_by(
        models.Transaction.department_id,
        models.Transaction.category,
        models.Transaction.amount,
        models.Transaction.date
    ).all()

    for i in range(len(txs) - 1):
        tx1 = txs[i]
        tx2 = txs[i+1]
        
        if (tx1.department_id == tx2.department_id and 
            tx1.category == tx2.category and 
            tx1.amount == tx2.amount and 
            tx1.type == "Expense" and
            abs((tx2.date - tx1.date).days) <= 1):
            
            anomalies.append({
                "type": "Duplicate Payment",
                "severity": "High",
                "message": f"Possible duplicate payment of ₹{tx1.amount:,.2f} detected in department {tx1.department.name} under category '{tx1.category}'.",
                "details": f"Transactions occurred on {tx1.date.strftime('%Y-%m-%d')} and {tx2.date.strftime('%Y-%m-%d')}.",
                "transaction_ids": [tx1.id, tx2.id],
                "date": tx2.date.strftime("%Y-%m-%d")
            })

    # 2. Detect Abnormal Transaction Amounts (Z-Score > 2.5 per category)
    categories = [r[0] for r in db.query(models.Transaction.category).distinct().all()]
    for category in categories:
        cat_txs = db.query(models.Transaction).filter(
            models.Transaction.category == category,
            models.Transaction.type == "Expense"
        ).all()
        
        if len(cat_txs) >= 5:
            amounts = np.array([t.amount for t in cat_txs])
            mean = np.mean(amounts)
            std = np.std(amounts)
            
            if std > 0:
                for tx in cat_txs:
                    z_score = (tx.amount - mean) / std
                    if z_score > 2.5:
                        anomalies.append({
                            "type": "Abnormal Transaction",
                            "severity": "High",
                            "message": f"Abnormally high payment of ₹{tx.amount:,.2f} detected under category '{category}' in department {tx.department.name}.",
                            "details": f"This amount is {z_score:.2f} standard deviations above the average (₹{mean:,.2f}) for this category.",
                            "transaction_ids": [tx.id],
                            "date": tx.date.strftime("%Y-%m-%d")
                        })

    # 3. Detect Budget Overruns
    overruns = db.query(models.Budget).filter(
        models.Budget.spent_amount > models.Budget.allocated_amount
    ).all()
    
    for budget in overruns:
        diff = budget.spent_amount - budget.allocated_amount
        pct = (diff / budget.allocated_amount * 100) if budget.allocated_amount > 0 else 100
        anomalies.append({
            "type": "Budget Overrun",
            "severity": "Medium" if pct < 15 else "High",
            "message": f"Budget overrun in {budget.department.name} - Category '{budget.category}' for FY {budget.year}.",
            "details": f"Spent ₹{budget.spent_amount:,.2f} which exceeds allocated ₹{budget.allocated_amount:,.2f} by ₹{diff:,.2f} (+{pct:.1f}%).",
            "transaction_ids": [],
            "date": f"FY {budget.year}"
        })

    # 4. Large Variance in Department Spending
    # Detect if a department's monthly spending has high volatility month-over-month
    depts = db.query(models.Department).all()
    for dept in depts:
        # Sum by month/year
        monthly_spend = db.query(
            models.Transaction.date,
            func.sum(models.Transaction.amount)
        ).filter(
            models.Transaction.department_id == dept.id,
            models.Transaction.type == "Expense"
        ).group_by(
            func.strftime("%Y-%m", models.Transaction.date)
        ).all()
        
        if len(monthly_spend) >= 4:
            spends = np.array([s[1] for s in monthly_spend])
            cv = np.std(spends) / np.mean(spends) if np.mean(spends) > 0 else 0
            if cv > 0.6: # Coefficient of variation > 60% indicates highly volatile spending
                anomalies.append({
                    "type": "Large Variance",
                    "severity": "Low",
                    "message": f"Highly volatile monthly spending detected in {dept.name} department.",
                    "details": f"Monthly spending shows a Coefficient of Variation of {cv*100:.1f}%, indicating unstable expenses.",
                    "transaction_ids": [],
                    "date": datetime.now().strftime("%Y-%m-%d")
                })

    # Sort anomalies by severity (High first) then date
    anomalies.sort(key=lambda x: (x["severity"] == "Low", x["severity"] == "Medium", x["severity"] == "High"))
    return anomalies
