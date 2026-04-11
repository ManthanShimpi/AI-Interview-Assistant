from typing import List, Dict
import uuid


def _make_question(text: str, skill: str) -> Dict:
    return {
        "id": str(uuid.uuid4()),
        "text": text,
        "skill": skill,
    }


def generate_questions(skills: List[str]) -> List[Dict]:
    """
    Generate a small set of behavioral + technical questions
    based on the extracted skills.
    """
    if not skills:
        skills = ["General"]

    primary_skill = skills[0]

    questions: List[Dict] = []
    questions.append(
        _make_question(
            f"Tell me about a recent project where you used {primary_skill}.",
            primary_skill,
        )
    )
    questions.append(
        _make_question(
            f"What was the most challenging technical problem you solved related to {primary_skill}, and how did you approach it?",
            primary_skill,
        )
    )
    questions.append(
        _make_question(
            "Describe a time you received critical feedback and how you responded.",
            "Behavioral",
        )
    )

    return questions
