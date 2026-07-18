from fastapi import FastAPI, Depends, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import os
import uvicorn
import models
from database import engine, get_db
from routers import auth, data, dashboard, ai, admin
from services.csv_processor import parse_and_process_csv, parse_and_process_real_csv_bulk
from generate_data import generate_financial_csvs

# Initialize database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Financial Intelligence Platform (AFIP) API",
    description="Backend API powering financial analytics, forecasting, chatbot, and reporting.",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local sandbox development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(data.router)
api_router.include_router(dashboard.router)
api_router.include_router(ai.router)
api_router.include_router(admin.router)

app.include_router(api_router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the AI Financial Intelligence Platform (AFIP) API"}

@app.on_event("startup")
def startup_event():
    import shutil
    desktop_dir = "/Users/naveen/Desktop"
    samples_dir = "../data_samples"
    os.makedirs(samples_dir, exist_ok=True)
    
    # Map real Desktop reports to standardized samples
    real_files_mapping = {
        "FinancialAnalysisReport 2021-2022.csv": "CSV2021-22.csv",
        "FinancialAnalysisReport 2022-2023.csv": "2022-23.csv",
        "FinancialAnalysisReport 2023-2024.csv": "2023-24.csv",
        "FinancialAnalysisReport 2024-2025.csv": "2024-25.csv"
    }

    real_copied = False
    for src_name, dest_name in real_files_mapping.items():
        src_path = os.path.join(desktop_dir, src_name)
        dest_path = os.path.join(samples_dir, dest_name)
        if os.path.exists(src_path):
            print(f"Copying real report file {src_name} to samples directory...")
            shutil.copy(src_path, dest_path)
            real_copied = True

    # Only generate simulated CSVs if we couldn't find the real reports on Desktop
    if not real_copied and not os.path.exists(os.path.join(samples_dir, "2024-25.csv")):
        print("Real reports not found on Desktop. Generating mock financial data...")
        generate_financial_csvs(samples_dir)

    # 2. Check if database is empty. If yes, seed it automatically
    db = next(get_db())
    try:
        user_count = db.query(models.User).count()
        if user_count == 0:
            print("Seeding database with default admin account...")
            # Create default admin user: admin / admin123
            from auth import get_password_hash
            admin_user = models.User(
                username="admin",
                email="admin@afip.com",
                hashed_password=get_password_hash("admin123"),
                role="Admin"
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            
            # Create default user: user / user123
            regular_user = models.User(
                username="user",
                email="user@afip.com",
                hashed_password=get_password_hash("user123"),
                role="User"
            )
            db.add(regular_user)
            db.commit()
            
            # Settings for users
            db.add(models.Setting(user_id=admin_user.id))
            db.add(models.Setting(user_id=regular_user.id))
            db.commit()

            # Seed financial data using copied real CSVs
            csv_files = [
                ("CSV2021-22.csv", "2021-22"),
                ("2022-23.csv", "2022-23"),
                ("2023-24.csv", "2023-24"),
                ("2024-25.csv", "2024-25")
            ]
            
            print("Auto-seeding financial database from real CSV files...")
            for filename, year_str in csv_files:
                path = os.path.join(samples_dir, filename)
                if os.path.exists(path):
                    parse_and_process_real_csv_bulk(
                        db=db,
                        filepath=path,
                        filename=filename,
                        year_str=year_str,
                        uploader_id=admin_user.id
                    )
            print("Database seeding completed.")
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8081, reload=True)
