from typing import Dict, List, Optional
import uuid


def evaluate_answer(
    question_text: str,
    answer_text: str,
    skills: Optional[List[str]],
    history: List[Dict],
) -> Dict:
    """
    Very simple heuristic evaluator:
    - Scores based on length of the answer
    - Returns generic feedback
    - Generates a follow-up question to keep the interview going
    """
    length = len(answer_text.strip())

    if length < 20:
        score = 4.0
        feedback = "Your answer is quite brief. Try to add more detail, context, and concrete examples."
    elif length < 80:
        score = 7.0
        feedback = "Good answer. You can improve it by adding clearer structure and 1–2 specific examples."
    else:
        score = 9.0
        feedback = "Strong, detailed answer with good depth. Consider tightening it slightly for clarity."

    primary_skill = (skills or ["General"])[0]
    next_question = {
        "id": str(uuid.uuid4()),
        "text": f"Can you share another example that highlights your strengths in {primary_skill}?",
        "skill": primary_skill,
    }

    return {
        "score": score,
        "feedback": feedback,
        "next_question": next_question,
    }

import os
import re
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

def evaluate_answer(question: str, user_answer: str, skills: list = None, history: list = None) -> dict:
    if client is None:
        return {
            "score": 0.0,
            "feedback": "CRITICAL ERROR: No Groq API Key configured in .env. Failsafe activated: Cannot grade without AI Key.",
            "next_question": {"id": "qX", "text": "Failsafe question: Can you explain your background?", "skill": "General"}
        }
        
    if not user_answer or len(user_answer.split()) < 4:
        return {
            "score": 0.0,
            "feedback": "Automatic Failure: Answer was too brief or repetitive to evaluate technical depth.",
            "next_question": {"id": "qX", "text": "Let's try again. Can you elaborate on your experience with " + (skills[0] if skills else "your core skills") + "?", "skill": "Elaboration"}
        }
        
    skills_text = ", ".join(skills) if skills else "General Software Engineering"
    
    history_lines = []
    if history:
        for i, item in enumerate(history[-3:]): # Keep last 3 exchanges for context limit
            history_lines.append(f"Past Q: {item.get('question_text')}")
            history_lines.append(f"Past A: {item.get('transcribed_text')}")
    history_str = "\n".join(history_lines) if history_lines else "First Question"

    prompt = f"""You are a fair and constructive technical interviewer evaluating a candidate's answer.
Candidate's Core Skills: {skills_text}

Interview Context (Last 3 exchanges):
{history_str}

Current Question Asked: "{question}"
Candidate's Answer: "{user_answer}"

Task:
1. Assess the candidate's core understanding of the concepts mentioned. Give a low score (1.0-4.0) if completely incorrect, mid (5.0-7.0) for partial, high (8.0-10.0) for strong competency.
2. Provide brief, conversational feedback addressed to the candidate.
3. Generate the logical NEXT QUESTION to keep the interview going. It should either dig deeper into their current answer, or pivot to another of their core skills.

OUTPUT EXACTLY IN THIS FORMAT:
SCORE: X.X
FEEDBACK: Speak directly and conversationally to the candidate (e.g., "Good point about Redis. Let's move on."). Keep it brief (1-3 sentences).
NEXT_QUESTION_SKILL: One or two words classifying the next question (e.g., "Database Design", "Behavioral").
NEXT_QUESTION_TEXT: The actual text of the next question you want to ask them.
"""

    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.4
        )
        result = response.choices[0].message.content
        
        score = 0.0
        feedback_text = "API Evaluation fallback response."
        next_q_skill = "General"
        next_q_text = f"Can you tell me more about your experience with {skills[0] if skills else 'coding'}?"
        
        score_match = re.search(r'SCORE:\s*([\d\.]+)', result, re.IGNORECASE)
        feedback_match = re.search(r'FEEDBACK:\s*(.*?)(?=NEXT_QUESTION_SKILL|NEXT_QUESTION_TEXT|$)', result, re.DOTALL | re.IGNORECASE)
        skill_match = re.search(r'NEXT_QUESTION_SKILL:\s*(.*?)(?=NEXT_QUESTION_TEXT|$)', result, re.DOTALL | re.IGNORECASE)
        text_match = re.search(r'NEXT_QUESTION_TEXT:\s*(.*)', result, re.DOTALL | re.IGNORECASE)
        
        if score_match:
            parsed = float(score_match.group(1))
            score = max(0.0, min(10.0, parsed))
        
        if feedback_match:
            feedback_text = feedback_match.group(1).strip()
            
        if skill_match:
            next_q_skill = skill_match.group(1).strip()
            
        if text_match:
            next_q_text = text_match.group(1).strip()
            
        return {
            "score": round(score, 1),
            "feedback": feedback_text,
            "next_question": {
                "id": f"q_{os.urandom(4).hex()}",
                "text": next_q_text,
                "skill": next_q_skill
            }
        }
    except Exception as e:
        return {
            "score": 0.0,
            "feedback": f"GROQ INSTANCE FAILURE: The LLaMA3 API explicitly crashed. Reason: {str(e)}"
        }
