import os
import random
import pandas as pd
from datetime import datetime, timedelta

def generate_financial_csvs(output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    
    departments = ["Engineering", "HR", "Accounts", "Purchase", "Maintenance", "Stores", "Operations"]
    
    client_profiles = {
        "Tata Motors": {"base": 350000000, "growth": 0.24},
        "Reliance Industries": {"base": 700000000, "growth": 0.08},
        "Infosys": {"base": 450000000, "growth": 0.14},
        "HDFC Bank": {"base": 550000000, "growth": 0.11},
        "ICICI Bank": {"base": 480000000, "growth": 0.12},
        "Larsen & Toubro": {"base": 380000000, "growth": 0.18},
        "Wipro": {"base": 320000000, "growth": -0.05},
        "Adani Group": {"base": 420000000, "growth": 0.20}
    }

    # Let's map categories to types and standard ranges (scaled to billions/32B annual revenue)
    categories = {
        "Salary": ("Expense", 150000000, 250000000, 220000000),      # category: (type, min, max, budget_allocated_per_tx)
        "Fuel": ("Expense", 15000000, 35000000, 25000000),
        "Travel": ("Expense", 5000000, 25000000, 18000000),
        "Maintenance": ("Expense", 10000000, 50000000, 30000000),
        "Electricity": ("Expense", 8000000, 15000000, 12000000),
        "Vehicle": ("Expense", 20000000, 80000000, 60000000),
        "Diesel": ("Expense", 12000000, 45000000, 30000000),
        "Repair": ("Expense", 5000000, 40000000, 20000000),
        "Product Sales": ("Revenue", 400000000, 1200000000, 0),
        "Service Consulting": ("Revenue", 100000000, 400000000, 0),
    }

    # Generate data for each of the 4 financial years
    years = [
        ("2021-22", 2021),
        ("2022-23", 2022),
        ("2023-24", 2023),
        ("2024-25", 2024)
    ]

    for fy_str, start_year in years:
        rows = []
        start_date = datetime(start_year, 4, 1)
        end_date = datetime(start_year + 1, 3, 31)
        
        # Monthly transactions
        current_date = start_date
        while current_date <= end_date:
            # For each department, generate some transactions per month
            for dept in departments:
                # 1. Salary is regular every month
                salary_amount = random.randint(180000000, 240000000)
                # Salary increases YoY
                yo_y_mult = 1.0 + (start_year - 2021) * 0.08 # 8% annual raise
                salary_amount = int(salary_amount * yo_y_mult)
                allocated_salary = int(250000000 * yo_y_mult)
                
                rows.append({
                    "Date": current_date.strftime("%Y-%m-%d"),
                    "Department": dept,
                    "Category": "Salary",
                    "Amount": salary_amount,
                    "Type": "Expense",
                    "Client": "",
                    "Budget_Allocated": allocated_salary,
                    "Description": f"Monthly payroll for {dept}"
                })
                
                # 2. Fuel, Electricity, Travel
                for cat in ["Fuel", "Electricity", "Travel"]:
                    if random.random() > 0.3: # 70% chance of transaction
                        _, min_v, max_v, alloc = categories[cat]
                        # Apply YoY adjustment
                        mult = 1.0 + (start_year - 2021) * 0.05
                        amount = int(random.randint(min_v, max_v) * mult)
                        
                        # In 2024-25, Fuel spikes by 35%!
                        if cat == "Fuel" and fy_str == "2024-25":
                            amount = int(amount * 1.35)
                        
                        # In 2023-24, Travel is reduced
                        if cat == "Travel" and fy_str == "2023-24":
                            amount = int(amount * 0.6)

                        rows.append({
                            "Date": (current_date + timedelta(days=random.randint(1, 25))).strftime("%Y-%m-%d"),
                            "Department": dept,
                            "Category": cat,
                            "Amount": amount,
                            "Type": "Expense",
                            "Client": "",
                            "Budget_Allocated": int(alloc * mult),
                            "Description": f"{cat} expenses for {dept}"
                        })

                # 3. Maintenance and Repair
                for cat in ["Maintenance", "Repair"]:
                    if random.random() > 0.4:
                        _, min_v, max_v, alloc = categories[cat]
                        mult = 1.0 + (start_year - 2021) * 0.06
                        amount = int(random.randint(min_v, max_v) * mult)
                        
                        # Spike repair/maintenance in 2024-25 by 42%
                        if cat == "Repair" and fy_str == "2024-25":
                            amount = int(amount * 1.42)
                        
                        # Budget overrun trigger
                        overrun_chance = 0.15 if fy_str != "2024-25" else 0.45
                        alloc_amount = int(alloc * mult)
                        if random.random() < overrun_chance:
                            alloc_amount = int(amount * 0.8) # Alloc is less than spent

                        rows.append({
                            "Date": (current_date + timedelta(days=random.randint(1, 25))).strftime("%Y-%m-%d"),
                            "Department": dept,
                            "Category": cat,
                            "Amount": amount,
                            "Type": "Expense",
                            "Client": "",
                            "Budget_Allocated": alloc_amount,
                            "Description": f"Quarterly {cat.lower()} work"
                        })
                
                # 4. Operations and Stores have vehicle and diesel expenses
                if dept in ["Operations", "Stores", "Maintenance"]:
                    for cat in ["Diesel", "Vehicle"]:
                        if random.random() > 0.3:
                            _, min_v, max_v, alloc = categories[cat]
                            mult = 1.0 + (start_year - 2021) * 0.05
                            amount = int(random.randint(min_v, max_v) * mult)
                            rows.append({
                                "Date": (current_date + timedelta(days=random.randint(1, 25))).strftime("%Y-%m-%d"),
                                "Department": dept,
                                "Category": cat,
                                "Amount": amount,
                                "Type": "Expense",
                                "Client": "",
                                "Budget_Allocated": int(alloc * mult),
                                "Description": f"{cat} usage details"
                            })

            # 5. Revenues (Operations & Accounts record sales and consulting)
            for cat in ["Product Sales", "Service Consulting"]:
                # Generates 2-3 sales per month
                for _ in range(random.randint(2, 4)):
                    # Pick a random client and use their profile to determine amount
                    client_name = random.choice(list(client_profiles.keys()))
                    profile = client_profiles[client_name]
                    
                    growth_rate = profile["growth"]
                    base_amount = profile["base"]
                    
                    yoy_factor = (1 + growth_rate) ** (start_year - 2021)
                    
                    # Random noise +/- 15%
                    amount = int(base_amount * yoy_factor * random.uniform(0.85, 1.15))
                    
                    # Ensure minimum revenue range is valid
                    amount = max(amount, 80000000)

                    rows.append({
                        "Date": (current_date + timedelta(days=random.randint(1, 27))).strftime("%Y-%m-%d"),
                        "Department": "Operations" if cat == "Product Sales" else "Accounts",
                        "Category": cat,
                        "Amount": amount,
                        "Type": "Revenue",
                        "Client": client_name,
                        "Budget_Allocated": 0,
                        "Description": f"Invoice billing to {client_name}"
                    })
            
            # Move to next month
            # Approximate by adding 30 days or calculating next calendar month
            if current_date.month == 12:
                current_date = datetime(current_date.year + 1, 1, 1)
            else:
                current_date = datetime(current_date.year, current_date.month + 1, 1)
        
        # Write to CSV file
        df = pd.DataFrame(rows)
        filename = f"CSV{fy_str}.csv" if fy_str == "2021-22" else f"{fy_str}.csv"
        filepath = os.path.join(output_dir, filename)
        df.to_csv(filepath, index=False)
        print(f"Generated {filepath} with {len(df)} records.")

if __name__ == "__main__":
    generate_financial_csvs("../data_samples")
