#!/usr/bin/env python3
"""Direct database query to verify interview data"""

import os
from pymongo import MongoClient
from bson import ObjectId

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "ai-interview-user")

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]

# Get John's user record
john = db["users"].find_one({"username": "John"})
if john:
    print(f"John's ID: {john['_id']}")
    print(f"John's credential check...")
    print(f"Has password_hash: {'password_hash' in john}")
    
    # Get interviews for John
    interviews = list(db["interviews"].find({"user_id": john["_id"]}).sort("created_at", -1))
    print(f"\nInterviews for John: {len(interviews)}")
    
    for i, interview in enumerate(interviews[:2]):
        print(f"\n  Interview {i+1}:")
        print(f"    - _id: {interview['_id']}")
        print(f"    - user_id: {interview['user_id']}")
        print(f"    - final_score: {interview.get('final_score')}")
        print(f"    - avg_answer_quality: {interview.get('avg_answer_quality')}")
        print(f"    - avg_confidence: {interview.get('avg_confidence')}")
        print(f"    - proctoring_score: {interview.get('proctoring_score')}")
        print(f"    - created_at: {interview.get('created_at')}")
else:
    print("John not found")
