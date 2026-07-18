from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role: Optional[str] = "User"  # User / Admin

class UserResponse(UserBase):
    id: int
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class ForgotPasswordInput(BaseModel):
    email: EmailStr

# --- Department Schemas ---
class DepartmentBase(BaseModel):
    name: str

class DepartmentResponse(DepartmentBase):
    id: int

    class Config:
        from_attributes = True

# --- Transaction Schemas ---
class TransactionBase(BaseModel):
    date: datetime
    category: str
    amount: float
    type: str
    client: Optional[str] = None
    description: Optional[str] = None

class TransactionCreate(TransactionBase):
    department_name: str

class TransactionResponse(TransactionBase):
    id: int
    department: DepartmentResponse
    upload_id: Optional[int] = None

    class Config:
        from_attributes = True

# --- Budget Schemas ---
class BudgetBase(BaseModel):
    year: int
    category: str
    allocated_amount: float
    spent_amount: float

class BudgetResponse(BudgetBase):
    id: int
    department: DepartmentResponse

    class Config:
        from_attributes = True

# --- Financial Data Schemas ---
class FinancialDataBase(BaseModel):
    year: int
    month: int
    revenue: float
    expenses: float
    profit: float
    assets: float
    liabilities: float
    cash_flow: float

class FinancialDataResponse(FinancialDataBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Forecast Schemas ---
class ForecastBase(BaseModel):
    year: int
    metric: str
    value: float
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    model_used: str

class ForecastResponse(ForecastBase):
    id: int

    class Config:
        from_attributes = True

# --- Alert Schemas ---
class AlertResponse(BaseModel):
    id: int
    type: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Insight Schemas ---
class InsightResponse(BaseModel):
    id: int
    title: str
    description: str
    impact_level: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Scenario Simulation ---
class ScenarioSimulationInput(BaseModel):
    salary_change_pct: float = 0.0      # e.g. 10.0 for 10% increase
    fuel_change_pct: float = 0.0        # e.g. -20.0 for 20% decrease
    maintenance_change_pct: float = 0.0 # e.g. 100.0 for doubling
    revenue_change_pct: float = 0.0     # e.g. 15.0 for 15% increase

class ScenarioSimulationOutput(BaseModel):
    original_revenue: float
    simulated_revenue: float
    original_expenses: float
    simulated_expenses: float
    original_profit: float
    simulated_profit: float
    original_cash_flow: float
    simulated_cash_flow: float
    details: List[str]

# --- AI Query ---
class AIQueryRequest(BaseModel):
    prompt: str

class AIQueryResponse(BaseModel):
    answer: str
    chart_config: Optional[dict] = None  # To return chart specs if AI wants to render a chart
    has_pdf: Optional[bool] = False
    pdf_path: Optional[str] = None
