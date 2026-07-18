from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import models, schemas, auth, database

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=schemas.UserResponse)
def register(user_in: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # Check if user already exists
    db_user = db.query(models.User).filter(
        (models.User.username == user_in.username) | (models.User.email == user_in.email)
    ).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    # Check if this is the first user (make them Admin)
    user_count = db.query(models.User).count()
    role = "Admin" if user_count == 0 else user_in.role
    
    hashed_pwd = auth.get_password_hash(user_in.password)
    user = models.User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_pwd,
        role=role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Auto create settings for user
    settings = models.Setting(user_id=user.id)
    db.add(settings)
    db.commit()

    return user

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    # Log login action
    audit = models.AuditLog(user_id=user.id, action="User Login", details=f"User {user.username} logged in successfully.")
    db.add(audit)
    db.commit()

    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/forgot-password")
def forgot_password(input_data: schemas.ForgotPasswordInput, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == input_data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email address not found"
        )
    
    # Mock sending email link
    return {"message": "Password reset instructions have been sent to your email."}

@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
