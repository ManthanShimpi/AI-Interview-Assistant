import requests
import time

dummy_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /MediaBox [ 0 0 200 200 ] /Count 1 /Kids [ 3 0 R ] >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>\nendobj\n5 0 obj\n<< /Length 47 >>\nstream\nBT /F1 24 Tf 10 100 Td (Software Engineering) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000143 00000 n\n0000000243 00000 n\n0000000332 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n403\n%%EOF"

with open("test.pdf", "wb") as f:
    f.write(dummy_pdf)

print("Uploading resume...")
try:
    with open("test.pdf", "rb") as f:
        res = requests.post("http://localhost:8000/api/resume", files={"file": f})
    res.raise_for_status()
    data = res.json()
    session_id = data["session_id"]
    question_id = data["questions"][0]["id"]
    print("Session created:", session_id)
except Exception as e:
    print("FAILED AT RESUME UPLOAD:", e)
    if 'res' in locals(): print(res.text)
    exit(1)

print(f"Answering question {question_id} for session {session_id}...")
data = {
    "session_id": session_id,
    "question_id": question_id,
    "transcribed_text": "I think this is a good question."
}
try:
    res = requests.post("http://localhost:8000/api/answer", data=data)
    res_json = res.json()
    print("Answer Response:", res.status_code)
    print("Data:", res_json)
except Exception as e:
    print("FAILED AT ANSWER SUBMISSION:", e)
    if 'res' in locals(): print(res.text)
