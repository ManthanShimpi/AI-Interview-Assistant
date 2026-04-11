from dotenv import load_dotenv

load_dotenv()
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends
from pydantic import BaseModel
from pymongo.database import Database
from bson import ObjectId
import uuid
from .database import get_db
from . import models, auth

import os
import shutil
import json
from typing import List

# Import local ML services (optional for signup/login to work)
try:
    from .services.resume_parser import process_resume
    from .services.interview_manager import generate_questions
    from .services.audio_analyzer import analyze_audio_confidence
    from .services.evaluator import evaluate_answer

    SERVICES_AVAILABLE = True
except ImportError as e:
    SERVICES_AVAILABLE = False
    print(f"[Services] WARNING: services modules unavailable ({e}). Resume/answer endpoints disabled.")

# Optional Python CV proctoring (requires: opencv-python-headless, mediapipe, ultralytics)
try:
    from .services.proctor_service import analyze_frame
    CV_PROCTORING_AVAILABLE = True
    print("[Proctor] Python CV proctoring loaded OK.")
except ImportError as e:
    CV_PROCTORING_AVAILABLE = False
    print(f"[Proctor] WARNING: CV proctoring unavailable ({e}). Run: pip install opencv-python-headless mediapipe ultralytics")

app = FastAPI(title="Local AI Interview Assistant API")
allow_origins=["*"]
# Groq API configuration injected. Awaiting uvicorn reload swap.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store (Dictionary of dicts)
sessions = {}

class SessionStartResponse(BaseModel):
    session_id: str
    skills: List[str]
    questions: list

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

@app.post("/api/auth/register")
def register(user: UserCreate, db: Database = Depends(get_db)):
    db_user = db[models.USERS_COLLECTION].find_one({"username": user.username})
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = auth.get_password_hash(user.password)
    new_user = {
        "username": user.username,
        "password_hash": hashed_password,
    }
    db[models.USERS_COLLECTION].insert_one(new_user)
    return {"message": "User created successfully"}

@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Database = Depends(get_db)):
    user = db[models.USERS_COLLECTION].find_one({"username": form_data.username})
    if not user or not auth.verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    print(f"[DEBUG] User logged in: {user['username']} (ID: {user['_id']})")
    access_token = auth.create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/history")
def get_user_history(current_user: dict = Depends(auth.get_current_user), db: Database = Depends(get_db)):
    print(f"[DEBUG] Fetching history for user: {current_user.get('username')} (ID: {current_user['_id']})")
    cursor = (
        db[models.INTERVIEWS_COLLECTION]
        .find({"user_id": current_user["_id"]})
        .sort("created_at", -1)
    )
    interviews = []
    def serialize_doc(obj):
        if isinstance(obj, list):
            return [serialize_doc(item) for item in obj]
        elif isinstance(obj, dict):
            return {key: serialize_doc(value) for key, value in obj.items()}
        elif isinstance(obj, ObjectId):
            return str(obj)
        else:
            return obj

    for doc in cursor:
        doc = serialize_doc(doc)   # 🔥 FULL deep conversion
        doc["id"] = doc["_id"]
        del doc["_id"]
        interviews.append(doc)
    print(f"[DEBUG] Found {len(interviews)} interviews for user")
    return interviews

@app.get("/api/history/{interview_id}")
def get_interview_detail(
    interview_id: str,
    current_user: dict = Depends(auth.get_current_user),
    db: Database = Depends(get_db)
):
    from bson import ObjectId

    def serialize_doc(obj):
        if isinstance(obj, list):
            return [serialize_doc(item) for item in obj]
        elif isinstance(obj, dict):
            return {key: serialize_doc(value) for key, value in obj.items()}
        elif isinstance(obj, ObjectId):
            return str(obj)
        else:
            return obj

    try:
        oid = ObjectId(interview_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview = db[models.INTERVIEWS_COLLECTION].find_one({
        "_id": oid,
        "user_id": current_user["_id"]
    })

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # 🔥 CRITICAL FIX
    interview = serialize_doc(interview)

    interview["id"] = interview["_id"]
    del interview["_id"]

    return interview

@app.post("/api/resume", response_model=SessionStartResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: dict = Depends(auth.get_current_user)
):
    """Uploads resume, extracts skills locally, and generates custom questions."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    if not SERVICES_AVAILABLE:
        raise HTTPException(status_code=503, detail="Resume services unavailable on this build.")
        
    session_id = str(uuid.uuid4())
    temp_pdf = f"temp_{session_id}.pdf"
    
    with open(temp_pdf, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    try:
        # 1. Parse Resume (Local NLP)
        skills = process_resume(temp_pdf)
        
        # 2. Generate initial dynamic questions
        questions = generate_questions(skills)
        
        # 3. Store in session
        sessions[session_id] = {
            "skills": skills,
            "questions": questions,
            "answers": [],
            "proctoring_score": 10.0,   # managed server-side now
            "proctor_state": {}          # timing state for CV analysis
        }
        
        return SessionStartResponse(
            session_id=session_id,
            skills=skills,
            questions=questions
        )
    finally:
        if os.path.exists(temp_pdf):
            os.remove(temp_pdf)

@app.post("/api/answer")
async def handle_answer(
    session_id: str = Form(...),
    question_id: str = Form(...),
    transcribed_text: str = Form(...),
    audio: UploadFile = File(None),
    current_user: dict = Depends(auth.get_current_user)
):
    """Evaluates an answer semantically and acoustically without APIs."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    if not SERVICES_AVAILABLE:
        raise HTTPException(status_code=503, detail="Answer services unavailable on this build.")
        
    session = sessions[session_id]
    
    # Find the question context
    question_data = next((q for q in session["questions"] if q["id"] == question_id), None)
    if not question_data:
        raise HTTPException(status_code=400, detail="Question ID not found")
        
    skill = question_data.get("skill", "General")
    
    # Build history from past answers
    history = []
    for ans in session["answers"]:
        q_text = next((q["text"] for q in session["questions"] if q["id"] == ans["question_id"]), "Unknown")
        history.append({"question_text": q_text, "transcribed_text": ans["transcribed_text"]})

    # 1. Evaluate logical correctness using LLM inference
    semantic_result = evaluate_answer(question_data["text"], transcribed_text, session.get("skills"), history)
    
    # 2. Evaluate audio confidence using librosa locally
    audio_confidence = 5.0
    audio_metrics = {}
    if audio:
        audio_bytes = await audio.read()
        print(f"--- [DEBUG] Received audio of size {len(audio_bytes)} bytes ---")
        confidence_result = analyze_audio_confidence(audio_bytes)
        audio_confidence = confidence_result.get("score", 5.0)
        audio_metrics = confidence_result.get("metrics", {})
        
    # Compile outcome
    result = {
        "question_id": question_id,
        "transcribed_text": transcribed_text,
        "semantic_score": semantic_result["score"],
        "semantic_feedback": semantic_result["feedback"],
        "next_question": semantic_result["next_question"],
        "audio_confidence": audio_confidence,
        "audio_metrics": audio_metrics
    }
    
    # Store answer in session
    session["answers"].append(result)
    session["questions"].append(semantic_result["next_question"])
    
    return result

@app.websocket("/ws/proctor")
async def proctor_websocket(websocket: WebSocket):
    """WebSocket endpoint that receives JPEG frames, runs Python CV analysis, and returns violation events."""
    await websocket.accept()
    
    # Per-connection state for timing (look_away, look_down, no_face)
    state = {}
    score = 10.0
    session_id = None
    
    try:
        # First message must be JSON with session_id
        init_msg = await websocket.receive_text()
        init_data = json.loads(init_msg)
        session_id = init_data.get("session_id")
        
        await websocket.send_json({"status": "connected", "message": "Python CV Proctoring active"})
        
        while True:
            # Receive raw JPEG bytes from the browser
            frame_bytes = await websocket.receive_bytes()
            
            # Run analysis
            result = analyze_frame(frame_bytes, state)
            
            # Deduct from score
            if result["violation"]:
                score = max(0.0, score - result["score_deduction"])
                result["current_score"] = round(score, 1)
                
                # Persist score in session if available
                if session_id and session_id in sessions:
                    sessions[session_id]["proctoring_score"] = score
                
                await websocket.send_json(result)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Proctor WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass


@app.post("/api/report")
async def get_report(
    session_id: str = Form(...),
    proctoring_score: float = Form(10.0), # Provided by frontend local CV
    current_user: dict = Depends(auth.get_current_user),
    db: Database = Depends(get_db)
):
    """Retrieve the final aggregated scores and feedback."""
    print(f"[DEBUG] /api/report called - Session: {session_id}, User: {current_user.get('username')}")
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = sessions[session_id]
    answers = session["answers"]
    
    if not answers:
        return {"status": "error", "message": "No answers provided"}
        
    avg_semantic = sum(a["semantic_score"] for a in answers) / len(answers)
    avg_confidence = sum(a["audio_confidence"] for a in answers) / len(answers)
    
    # Scoring computation from specs: Answer 60%, Confidence 20%, Proctoring 20%
    final_score = (avg_semantic * 0.6) + (avg_confidence * 0.2) + (proctoring_score * 0.2)
    final_score = round(min(10.0, max(0.0, final_score)), 1)
    
    strengths = session.get("skills", [])[:4]
    
    # Save to database
    new_interview = {
        "user_id": current_user["_id"],
        "final_score": final_score,
        "avg_answer_quality": round(avg_semantic, 1),
        "avg_confidence": round(avg_confidence, 1),
        "proctoring_score": round(proctoring_score, 1),
        "strengths": strengths,
        "detailed_answers": answers,
        "created_at": datetime.utcnow(),
    }
    result = db[models.INTERVIEWS_COLLECTION].insert_one(new_interview)
    history_id = str(result.inserted_id)
    
    print(f"[DEBUG] Interview saved to DB - ID: {history_id}, User: {current_user.get('username')}")

    return {
        "session_id": session_id,
        "history_id": history_id,
        "final_score": final_score,
        "avg_answer_quality": round(avg_semantic, 1),
        "avg_confidence": round(avg_confidence, 1),
        "proctoring_score": round(proctoring_score, 1),
        "strengths": strengths,
        "detailed_answers": answers
    }
