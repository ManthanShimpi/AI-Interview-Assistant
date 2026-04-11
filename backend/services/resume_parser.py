import re
from typing import List

import pdfplumber


SKILL_KEYWORDS = [
    "python",
    "java",
    "javascript",
    "typescript",
    "react",
    "node",
    "django",
    "flask",
    "fastapi",
    "sql",
    "mongodb",
    "aws",
    "docker",
    "kubernetes",
    "machine learning",
    "data science",
]


def process_resume(pdf_path: str) -> List[str]:
    """
    Very simple local resume parser:
    - Extracts text from the PDF using pdfplumber
    - Looks for known skill keywords
    - Returns a unique, title-cased list of skills
    """
    text_chunks: list[str] = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                text_chunks.append(page_text.lower())
    except Exception:
        # Some PDFs are malformed / image-only; fall back gracefully.
        return ["General Software Engineering"]

    full_text = "\n".join(text_chunks)

    found_skills: list[str] = []
    for kw in SKILL_KEYWORDS:
        pattern = r"\b" + re.escape(kw) + r"\b"
        if re.search(pattern, full_text):
            found_skills.append(kw.title())

    if not found_skills:
        found_skills = ["General Software Engineering"]

    # Deduplicate while preserving order
    seen = set()
    unique_skills: list[str] = []
    for s in found_skills:
        if s not in seen:
            seen.add(s)
            unique_skills.append(s)

    return unique_skills

