import numpy as np
from sklearn.linear_model import LinearRegression
from sqlalchemy.orm import Session
from typing import Dict, List, Any
import models

def forecast_financials(db: Session, target_metric: str = None) -> Dict[str, Any]:
    """
    Forecasts financial metrics (Revenue, Expenses, Profit, Cash Flow) for the 12 months of 2025-26.
    Uses historical data from the database.
    """
    # 1. Fetch historical monthly aggregates
    records = db.query(models.FinancialData).order_by(
        models.FinancialData.year, 
        models.FinancialData.month
    ).all()

    if len(records) < 6:
        # Fallback: if not enough data, return mock projections
        return generate_mock_forecast(target_metric)

    # Prepare datasets
    months_idx = np.arange(len(records)).reshape(-1, 1)
    
    forecasts = {}
    metrics_to_forecast = ["revenue", "expenses", "cash_flow", "profit"]
    if target_metric and target_metric in metrics_to_forecast:
        metrics_to_forecast = [target_metric]

    for metric in metrics_to_forecast:
        y = np.array([getattr(r, metric) for r in records])
        
        # Fit Linear Regression for trend
        model = LinearRegression()
        model.fit(months_idx, y)
        
        # Calculate seasonality residuals
        trend_pred = model.predict(months_idx)
        residuals = y - trend_pred
        
        # Calculate average monthly seasonality (modulo 12)
        seasonality = np.zeros(12)
        for m in range(1, 13):
            # average residual for calendar month m
            monthly_residuals = [residuals[i] for i, r in enumerate(records) if r.month == m]
            if monthly_residuals:
                seasonality[m - 1] = np.mean(monthly_residuals)
        
        # Forecast next 12 months (months 48 to 59 if we have 48 months)
        next_months_idx = np.arange(len(records), len(records) + 12).reshape(-1, 1)
        future_trend = model.predict(next_months_idx)
        
        # We start forecasting from April 2025 (month 4) to March 2026 (month 3)
        future_months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] # Standard financial year
        
        # Combine trend + seasonality
        future_values = []
        std_error = np.std(residuals) if len(residuals) > 1 else y.mean() * 0.1
        
        for idx, month in enumerate(future_months):
            seasonal_offset = seasonality[month - 1]
            val = future_trend[idx] + seasonal_offset
            # Ensure revenue/expenses don't go negative
            if metric in ["revenue", "expenses"] and val < 0:
                val = max(1000.0, y.mean() * 0.5)
            
            future_values.append({
                "month": month,
                "value": round(float(val), 2),
                "lower_bound": round(float(val - 1.96 * std_error), 2),
                "upper_bound": round(float(val + 1.96 * std_error), 2)
            })
            
        forecasts[metric] = future_values

    return forecasts

def forecast_department_spending(db: Session, department_id: int) -> List[Dict[str, Any]]:
    """
    Forecasts department expenditure for 2025-26.
    """
    # Fetch historical transaction totals by month
    txs = db.query(
        models.Transaction.date,
        models.Transaction.amount
    ).filter(
        models.Transaction.department_id == department_id,
        models.Transaction.type == "Expense"
    ).all()

    if not txs:
        return []

    # Aggregate by month
    monthly_data = {}
    for tx in txs:
        key = (tx.date.year, tx.date.month)
        monthly_data[key] = monthly_data.get(key, 0.0) + tx.amount

    # Sort keys
    sorted_keys = sorted(monthly_data.keys())
    if len(sorted_keys) < 4:
        # Fallback to simple scaling if insufficient data
        mean_val = sum(monthly_data.values()) / len(monthly_data) if monthly_data else 50000.0
        return [{"month": m, "value": round(mean_val * 1.05, 2)} for m in [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]]

    # Train linear regression
    x_idx = np.arange(len(sorted_keys)).reshape(-1, 1)
    y_vals = np.array([monthly_data[k] for k in sorted_keys])

    model = LinearRegression()
    model.fit(x_idx, y_vals)

    next_idx = np.arange(len(sorted_keys), len(sorted_keys) + 12).reshape(-1, 1)
    preds = model.predict(next_idx)

    future_months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
    return [
        {
            "month": future_months[i],
            "value": round(max(0.0, float(preds[i])), 2)
        }
        for i in range(12)
    ]

def generate_mock_forecast(metric: str = None) -> Dict[str, Any]:
    # Mock data starting April 2025
    months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
    forecasts = {}
    
    metrics = {
        "revenue": (12000000, 15000000, 1000000),
        "expenses": (8000000, 9500000, 800000),
        "cash_flow": (1500000, 3000000, 300000),
        "profit": (2000000, 4500000, 400000)
    }
    
    for m_name, (min_v, max_v, std) in metrics.items():
        if metric and m_name != metric:
            continue
        vals = []
        for month in months:
            val = random_walk_value(min_v, max_v)
            vals.append({
                "month": month,
                "value": val,
                "lower_bound": val - std,
                "upper_bound": val + std
            })
        forecasts[m_name] = vals
    return forecasts

def random_walk_value(min_v, max_v):
    import random
    return round(float(random.randint(min_v, max_v)), 2)
