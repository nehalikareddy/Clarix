import os
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pymongo import MongoClient

import rag

# Load environment variables
load_dotenv()
load_dotenv("../server/.env")  # Fallback to server's .env if present

app = FastAPI(
    title="Clarix RAG Intelligence Service",
    description="Python microservice handling legal contract chunking, vector embeddings, and RAG Q&A",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to MongoDB if MONGO_URI is present, otherwise fallback to in-memory store
MONGO_URI = os.getenv("MONGO_URI")
db_chunks = None
in_memory_chunks: Dict[str, List[Dict[str, Any]]] = {}

if MONGO_URI:
    try:
        mongo_client = MongoClient(MONGO_URI)
        db = mongo_client.get_default_database()
        db_chunks = db["document_chunks"]
        print("[AI Service] Connected to MongoDB document_chunks collection.")
    except Exception as e:
        print(f"[AI Service] MongoDB connection warning: {e}. Falling back to in-memory store.")
else:
    print("[AI Service] No MONGO_URI found in environment. Using in-memory store for chunks.")

# Request / Response Schemas
class IndexRequest(BaseModel):
    doc_id: str
    text: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    doc_id: str
    message: str
    chat_history: Optional[List[ChatMessage]] = []

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "clarix-rag-microservice",
        "storage": "mongodb" if db_chunks is not None else "in-memory"
    }

@app.post("/index")
def index_document(payload: IndexRequest):
    """
    Chunks contract text, generates Gemini embeddings, and stores them.
    """
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Document text cannot be empty.")

    # 1. Chunking
    chunks = rag.chunk_text(payload.text, chunk_size=700, chunk_overlap=150)
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not extract any chunks from text.")

    # 2. Embedding
    try:
        embeddings = rag.get_embeddings(chunks)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate embeddings: {str(e)}")

    # 3. Store in DB or memory
    records = []
    for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        records.append({
            "doc_id": payload.doc_id,
            "chunk_index": idx,
            "content": chunk,
            "embedding": emb
        })

    if db_chunks is not None:
        try:
            # Delete any existing chunks for this doc_id to avoid duplicates
            db_chunks.delete_many({"doc_id": payload.doc_id})
            db_chunks.insert_many(records)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    else:
        in_memory_chunks[payload.doc_id] = records

    return {
        "status": "success",
        "doc_id": payload.doc_id,
        "chunks_indexed": len(records)
    }

@app.post("/chat")
def chat_with_document(payload: ChatRequest):
    """
    RAG Chat: Finds top matching chunks, passes them to Gemini, and returns the cited answer.
    """
    doc_id = payload.doc_id
    user_query = payload.message.strip()

    if not user_query:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # 1. Fetch chunks for this document
    chunks = []
    if db_chunks is not None:
        chunks = list(db_chunks.find({"doc_id": doc_id}, {"_id": 0}))
    else:
        chunks = in_memory_chunks.get(doc_id, [])

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail=f"No indexed chunks found for document '{doc_id}'. Please upload or index the document first."
        )

    # 2. Embed the question
    try:
        query_vec = rag.get_query_embedding(user_query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to embed user query: {str(e)}")

    # 3. Retrieve top-K chunks using cosine similarity
    top_chunks = rag.retrieve_top_k(query_vec, chunks, k=4)

    # 4. Generate answer with citations
    history = [m.model_dump() for m in payload.chat_history] if payload.chat_history else []
    try:
        answer, sources = rag.generate_rag_response(user_query, top_chunks, history)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(e)}")

    return {
        "reply": answer,
        "sources": sources
    }
