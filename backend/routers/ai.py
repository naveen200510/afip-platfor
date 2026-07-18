from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
import models, schemas, database, auth
from services.ai_assistant import run_ai_query
from services.recommender import generate_ai_recommendations

router = APIRouter(prefix="/ai", tags=["AI Copilot & Reporting"])

@router.post("/query", response_model=schemas.AIQueryResponse)
def chatbot_query(
    request: schemas.AIQueryRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        res = run_ai_query(db, request.prompt, current_user.id)
        
        # Save query history
        query_log = models.AIQuery(
            user_id=current_user.id,
            prompt=request.prompt,
            response=res["answer"]
        )
        db.add(query_log)
        db.commit()
        
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI query failed: {str(e)}"
        )

@router.get("/recommendations")
def get_recommendations(
    year: int = 2024,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    recs = generate_ai_recommendations(db, year)
    return recs

@router.get("/reports/download/{report_id}")
def download_report(
    report_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
        
    if not os.path.exists(report.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file missing on server"
        )
        
    return FileResponse(
        path=report.file_path,
        filename=os.path.basename(report.file_path),
        media_type="application/pdf"
    )
