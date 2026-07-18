from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="User")  # Admin / User
    created_at = Column(DateTime, default=datetime.utcnow)

    queries = relationship("AIQuery", back_populates="user")
    logs = relationship("Log", back_populates="user")
    settings = relationship("Setting", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

class FinancialData(Base):
    __tablename__ = "financial_data"
    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, index=True, nullable=False)
    month = Column(Integer, nullable=False)
    revenue = Column(Float, default=0.0)
    expenses = Column(Float, default=0.0)
    profit = Column(Float, default=0.0)
    assets = Column(Float, default=0.0)
    liabilities = Column(Float, default=0.0)
    cash_flow = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

    transactions = relationship("Transaction", back_populates="department")
    budgets = relationship("Budget", back_populates="department")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    category = Column(String, index=True, nullable=False)  # Salary, Fuel, electricity, etc.
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False)  # Expense / Revenue
    client = Column(String, nullable=True)  # Corporate client name (for revenues)
    description = Column(Text, nullable=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"), nullable=True)
    berth = Column(String, index=True, nullable=True)  # Physical berth name (e.g. SPM, Q6)

    department = relationship("Department", back_populates="transactions")
    upload = relationship("Upload", back_populates="transactions")

class Budget(Base):
    __tablename__ = "budgets"
    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    category = Column(String, nullable=False)
    allocated_amount = Column(Float, default=0.0)
    spent_amount = Column(Float, default=0.0)

    department = relationship("Department", back_populates="budgets")

class Forecast(Base):
    __tablename__ = "forecasts"
    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    metric = Column(String, nullable=False)  # Revenue, Expenses, Cash Flow, etc.
    value = Column(Float, nullable=False)
    lower_bound = Column(Float, nullable=True)
    upper_bound = Column(Float, nullable=True)
    model_used = Column(String, nullable=False)  # Linear Regression, ARIMA, Prophet, etc.

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)  # Budget Overrun, Cash Flow, Abnormal, Revenue Drop
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # PDF / Word / PowerPoint
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class AIQuery(Base):
    __tablename__ = "ai_queries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    prompt = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="queries")

class Insight(Base):
    __tablename__ = "insights"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    impact_level = Column(String, default="Medium")  # High / Medium / Low
    created_at = Column(DateTime, default=datetime.utcnow)

class Log(Base):
    __tablename__ = "logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="logs")

class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    theme = Column(String, default="dark")  # dark / light
    language = Column(String, default="en")
    currency = Column(String, default="USD")  # INR, USD, EUR
    financial_year = Column(String, default="2024-25")

    user = relationship("User", back_populates="settings")

class KPI(Base):
    __tablename__ = "kpis"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    value = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow)

class Upload(Base):
    __tablename__ = "uploads"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    year = Column(String, nullable=False)
    status = Column(String, default="Pending")  # Pending / Completed / Failed
    row_count = Column(Integer, default=0)
    uploaded_by = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="upload")

class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")
