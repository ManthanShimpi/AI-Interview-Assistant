import pdfplumber
import spacy
import re
from typing import List

# Load the small English NLP model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    import os
    os.system("python -m spacy download en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
    return text

def extract_skills_from_text(text: str) -> List[str]:
    doc = nlp(text)
    skills = set()
    
    # Comprehensive dictionary of strictly technical skills
    tech_whitelist = {
        "python", "java", "react", "node", "sql", "aws", "docker", 
        "javascript", "c++", "c#", "machine learning", "ai", "fastapi",
        "kubernetes", "git", "linux", "html", "css", "mongodb", "postgres",
        "azure", "gcp", "typescript", "angular", "vue", "django", "flask",
        "spring boot", "ruby", "golang", "rust", "swift", "kotlin", "dart",
        "flutter", "react native", "mysql", "redis", "graphql", "rest api",
        "data structures", "algorithms", "system design", "jenkins", "ci/cd",
        "terraform", "pytorch", "tensorflow", "pandas", "numpy", "scikit-learn",
        "nlp", "computer vision", "opencv", "hadoop", "spark", "kafka", "tableau"
    }
    
    lower_text = text.lower()
    
    # 1. Add known hardcoded tech skills
    for tech in tech_whitelist:
        if re.search(r'\b' + re.escape(tech) + r'\b', lower_text):
            if tech.upper() in ["AWS", "SQL", "GCP", "HTML", "CSS", "PHP", "AI", "REST API", "CI/CD"]:
                skills.add(tech.upper())
            else:
                skills.add(tech.title())
                
    return list(skills)[:5] # Return max 5 best skills to avoid irrelevant questions

def process_resume(file_path: str) -> List[str]:
    """Parse a PDF resume and return extracted technical skills, carefully ignoring academic institutions."""
    text = extract_text_from_pdf(file_path)
    skills = extract_skills_from_text(text)
    return skills
