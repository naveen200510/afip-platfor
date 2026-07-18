from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
import models, schemas, database, auth
from services.csv_processor import parse_and_process_csv

router = APIRouter(prefix="/data", tags=["Data Management"])

@router.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    year: str = Form(...), # e.g. "2024-25"
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Verify file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only CSV files are supported."
        )

    try:
        content = await file.read()
        upload_record = parse_and_process_csv(
            db=db,
            file_content=content,
            filename=file.filename,
            year_str=year,
            uploader_id=current_user.id
        )
        return {
            "message": "File uploaded and processed successfully",
            "upload_id": upload_record.id,
            "filename": upload_record.filename,
            "row_count": upload_record.row_count,
            "status": upload_record.status
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing CSV: {str(e)}"
        )

@router.get("/uploads", response_model=List[dict])
def get_uploads(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    uploads = db.query(models.Upload).order_by(models.Upload.uploaded_at.desc()).all()
    return [
        {
            "id": u.id,
            "filename": u.filename,
            "year": u.year,
            "status": u.status,
            "row_count": u.row_count,
            "uploaded_at": u.uploaded_at.isoformat()
        } for u in uploads
    ]

@router.get("/transactions", response_model=List[schemas.TransactionResponse])
def get_transactions(
    limit: int = 100, 
    offset: int = 0, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    txs = db.query(models.Transaction).order_by(models.Transaction.date.desc()).offset(offset).limit(limit).all()
    return txs

@router.get("/search")
def smart_search(
    query: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Smart Search (Module 11) - search terms like 'salary', 'maintenance', 'electricity', 'vehicle', 'diesel', 'repair'
    and return every matching record across all years.
    """
    if not query or len(query.strip()) < 2:
        return []
        
    search_term = f"%{query.strip()}%"
    
    # Query transactions matching description, category, or department name
    results = db.query(models.Transaction).join(models.Department).filter(
        or_(
            models.Transaction.description.like(search_term),
            models.Transaction.category.like(search_term),
            models.Department.name.like(search_term)
        )
    ).order_by(models.Transaction.date.desc()).all()

    return [
        {
            "id": tx.id,
            "date": tx.date.strftime("%Y-%m-%d"),
            "department": tx.department.name,
            "category": tx.category,
            "amount": tx.amount,
            "type": tx.type,
            "description": tx.description
        } for tx in results
    ]
