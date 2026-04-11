import os
from pymongo import MongoClient


MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "ai-interview-user")


client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]


def get_db():
    """
    FastAPI dependency that returns the MongoDB database instance.
    """
    return db
