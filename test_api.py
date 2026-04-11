#!/usr/bin/env python3
"""Test script to verify API is working and data is saved"""

import requests
import json
import os
from pymongo import MongoClient

# MongoDB connection
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "ai-interview-user")

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]

# Check database
print("=" * 60)
print("DATABASE INSPECTION")
print("=" * 60)

users = list(db["users"].find({}))
print(f"\nTotal users in database: {len(users)}")
for user in users:
    print(f"  - {user['username']} (ID: {user['_id']})")

interviews = list(db["interviews"].find({}))
print(f"\nTotal interviews in database: {len(interviews)}")
for interview in interviews:
    print(f"  - Interview ID: {interview['_id']}")
    print(f"    User ID: {interview.get('user_id')}")
    print(f"    Score: {interview.get('final_score')}")
    print(f"    Created: {interview.get('created_at')}")

# Test API
print("\n" + "=" * 60)
print("API TEST")
print("=" * 60)

BASE_URL = "http://localhost:8000"

if users:
    user = users[0]
    print(f"\nTesting with user: {user['username']}")
    
    # Login
    try:
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={
                "username": user['username'],
                "password": "password"  # Default password for testing
            }
        )
        print(f"Login Status: {login_response.status_code}")
        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            print(f"Token: {token[:20]}...")
            
            # Get history
            history_response = requests.get(
                f"{BASE_URL}/api/history",
                headers={"Authorization": f"Bearer {token}"}
            )
            print(f"\nHistory Status: {history_response.status_code}")
            print(f"History Data: {json.dumps(history_response.json(), indent=2, default=str)}")
        else:
            print(f"Login Error: {login_response.text}")
    except Exception as e:
        print(f"API Error: {e}")
else:
    print("\nNo users found in database. Please create a user first.")
