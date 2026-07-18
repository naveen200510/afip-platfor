# AFIP AI — AI Financial Intelligence Platform

AFIP AI is a high-fidelity CFO Financial Intelligence Dashboard custom-engineered for maritime port authority financial statement visualization, anomaly detection, and predictive modeling (modeled after the Cochin Port Authority).

The platform enables ports to manage millions of dollars in operational transactions, monitor budgets, forecast client growth using machine learning, and query databases dynamically using a built-in AI Copilot assistant.

---

## 🚀 Core Features

### 1. Unified CFO Dashboard & Visual Analytics
* **Interactive Financial Charts**: Custom area charts for cumulative surplus, monthly cash flow line trends, departmental budget weightage treemaps, and spending intensity heatmaps.
* **Berth-Specific Revenues**: Tracks operational billing collections, cargo volumes, and percentage contributions from individual shipping berths (e.g. SPM, COT, Q7).

### 2. Multi-Currency & Localization Engine
* **Dynamic Conversions**: Instantly toggle the entire platform between **USD ($)**, **EUR (€)**, and **INR (₹)**.
* **Indian Numbering Format**: Automatically scales values to Crores (`Cr` = $10^7$) and Lakhs (`L` = $10^5$) when INR is selected (e.g. `₹76.42 Cr` instead of billions).
* **Pre-Scaled Chart Rendering**: Data coordinates are scaled client-side before passing to Recharts, ensuring relative bar and line heights are visual matches with dynamic Y-axis ticks.

### 3. Machine Learning Revenue Forecasts
* **Linear Regression Engine**: Analyzes historical monthly client billings across multiple fiscal years (FY21 to FY24) and trains individual regression models (`y = mx + c`) to project account revenues for the upcoming year (**FY 2025-26**).
* **Account Growth Insights**: Identifies top-yielding clients and highlights accounts with the steepest upward trendlines.

### 4. Real-Time Anomaly & Budget Scanners
* **Overrun Monitors**: Background scanners check live ledger entries to flag categories where actual spending exceeds departmental allocations.
* **Abnormal Transactions**: Instantly highlights single expenditures exceeding **$100,000 USD**.
* **Dynamic Alert Translation**: The frontend notification dropdown parses hardcoded database alert messages, converts values, and shows them in the user's active currency.

### 5. Conversational AI Copilot & NLP Compiler
* **Dynamic Query Compilation**: A local natural language compiler that parses questions about salaries, department budgets, YoY differences, client forecasts, and berth collections, translating them directly into SQL queries to fetch database values.

---

## 🛠️ Technology Stack

* **Frontend**: React (Vite + TypeScript), Recharts, TailwindCSS / CSS, Lucide-React.
* **Backend**: FastAPI (Python 3.9+), SQLAlchemy ORM, SQLite (local database), Pandas, Scikit-learn (for predictive modeling).

---

## 💻 Local Setup & Execution

### 1. Backend Server Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Initialize virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the server:
   ```bash
   python3 main.py
   ```
   *The API will run locally at:* `http://localhost:8081`

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install node packages:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   *The dashboard will open at:* `http://localhost:5173`

---

## 🔑 Default Credentials

For local development sandbox access:
* **Username**: `admin`
* **Password**: `admin123`
