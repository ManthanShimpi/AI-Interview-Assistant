from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import os
import shutil
import json
from typing import List

# Import local ML services
from services.resume_parser import process_resume
from services.interview_manager import generate_questions
from services.audio_analyzer import analyze_audio_confidence
from services.evaluator import evaluate_answer

# Optional Python CV proctoring (requires: opencv-python-headless, mediapipe, ultralytics)
try:
    from services.proctor_service import analyze_frame
    CV_PROCTORING_AVAILABLE = True
    print("[Proctor] Python CV proctoring loaded OK.")
except ImportError as e:
    CV_PROCTORING_AVAILABLE = False
    print(f"[Proctor] WARNING: CV proctoring unavailable ({e}). Run: pip install opencv-python-headless mediapipe ultralytics")

app = FastAPI(title="Local AI Interview Assistant API")
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

@app.post("/api/resume", response_model=SessionStartResponse)
async def upload_resume(file: UploadFile = File(...)):
    """Uploads resume, extracts skills locally, and generates custom questions."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
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
    audio: UploadFile = File(None)
):
    """Evaluates an answer semantically and acoustically without APIs."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
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
    proctoring_score: float = Form(10.0) # Provided by frontend local CV
):
    """Retrieve the final aggregated scores and feedback."""
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
    
    return {
        "session_id": session_id,
        "final_score": final_score,
        "avg_answer_quality": round(avg_semantic, 1),
        "avg_confidence": round(avg_confidence, 1),
        "proctoring_score": round(proctoring_score, 1),
        "strengths": session.get("skills", [])[:4],
        "detailed_answers": answers
    }
