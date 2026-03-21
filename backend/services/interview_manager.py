import os
import random
import json
import re
from typing import List, Dict
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

def generate_questions(skills: List[str]) -> List[Dict[str, str]]:
    """Generates the single initial starting question for the dynamic interview."""
    if not skills:
        skills = ["Software Engineering"]
        
    selected_skills = skills[:5] if len(skills) > 5 else skills
    
    if client is None:
        return [{"id": "q1", "text": "CRITICAL SYSTEM ERROR: No Groq API Key detected. Ensure the .env file is updated.", "skill": "System Configuration"}]

    prompt = f"""You are an experienced, realistic interviewer conducting a technical interview.
The candidate's core topics are: {', '.join(selected_skills)}.

TASK: Generate exactly ONE interview question to start the interview.
This should be a comfortable warm-up question on core fundamentals related to one of their skills.
Do not make it too trivial, but do not make it excessively difficult.

You MUST output ONLY a valid JSON array containing exactly ONE string. No markdown formatting, no code blocks, no prefixes. Just ["Question 1 text"]"""

    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.7
        )
        raw_result = response.choices[0].message.content
        
        json_match = re.search(r'\[.*\]', raw_result, re.DOTALL)
        if json_match:
            parsed_questions = json.loads(json_match.group(0))
            
            questions = []
            for i, q_text in enumerate(parsed_questions):
                skill_label = selected_skills[0] if len(selected_skills) > 0 else "Fundamentals"
                questions.append({"id": f"q{i+1}", "text": q_text, "skill": skill_label})
                
            return questions[:1] # Ensure only 1 is returned
        else:
            return [{"id": "q1", "text": f"SYSTEM ERROR: Groq LLM returned a non-JSON format: {raw_result[:100]}...", "skill": "API Error"}]
            
    except Exception as e:
        return [{"id": "q1", "text": f"CRITICAL API FAILURE: The Groq API explicitly rejected the connection. Details: {str(e)}", "skill": "Connection Error"}]
