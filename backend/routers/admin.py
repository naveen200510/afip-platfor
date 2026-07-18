from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models, schemas, database, auth

router = APIRouter(prefix="/admin", tags=["Admin & System Settings"])

@router.get("/logs", response_model=List[dict])
def get_audit_logs(
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(auth.get_current_admin)
):
    audit = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(200).all()
    return [
        {
            "id": log.id,
            "username": log.user.username if log.user else "System",
            "action": log.action,
            "details": log.details,
            "timestamp": log.timestamp.isoformat()
        } for log in audit
    ]

@router.get("/users", response_model=List[schemas.UserResponse])
def get_users(
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(auth.get_current_admin)
):
    users = db.query(models.User).all()
    return users

@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int, 
    role: str, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(auth.get_current_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if role not in ["Admin", "User"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'Admin' or 'User'"
        )
    
    user.role = role
    db.commit()
    return {"message": f"User {user.username} role updated to {role}"}

@router.get("/alerts", response_model=List[schemas.AlertResponse])
def get_alerts(
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    alerts = db.query(models.Alert).order_by(models.Alert.created_at.desc()).all()
    return alerts

@router.put("/alerts/{alert_id}/read")
def mark_alert_read(
    alert_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    alert.is_read = True
    db.commit()
    return {"message": "Alert marked as read"}

@router.get("/settings")
def get_settings(
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    setting = db.query(models.Setting).filter(models.Setting.user_id == current_user.id).first()
    if not setting:
        # Create default settings
        setting = models.Setting(user_id=current_user.id)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return {
        "theme": setting.theme,
        "language": setting.language,
        "currency": setting.currency,
        "financial_year": setting.financial_year
    }

@router.put("/settings")
def update_settings(
    theme: str,
    language: str,
    currency: str,
    financial_year: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    setting = db.query(models.Setting).filter(models.Setting.user_id == current_user.id).first()
    if not setting:
        setting = models.Setting(user_id=current_user.id)
        db.add(setting)
        
    setting.theme = theme
    setting.language = language
    setting.currency = currency
    setting.financial_year = financial_year
    db.commit()
    return {"message": "Settings updated successfully"}
