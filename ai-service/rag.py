import os
import math
from typing import List, Dict, Any, Tuple
from dotenv import load_dotenv
from google import genai

# LangChain components for RAG document chunking and prompt engineering
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langchain_core.documents import Document

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "server", ".env"))

def get_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in environment.")
    return genai.Client(api_key=api_key)

# 1. TEXT CHUNKING (Powered by LangChain RecursiveCharacterTextSplitter)
def chunk_text(text: str, chunk_size: int = 700, chunk_overlap: int = 150) -> List[str]:
    """
    Splits legal contract text into overlapping chunks using LangChain's RecursiveCharacterTextSplitter.
    Recursively attempts to split on paragraphs (\n\n), newlines (\n), periods, and words.
    """
    if not text or not text.strip():
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len
    )

    docs: List[Document] = splitter.create_documents([text])
    return [doc.page_content.strip() for doc in docs if doc.page_content.strip()]

# 2. VECTOR EMBEDDINGS (using gemini-embedding-001)
def get_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generates embedding vectors for a list of text chunks.
    Batch processed in groups of up to 50 chunks.
    """
    if not texts:
        return []

    client = get_client()
    embeddings: List[List[float]] = []
    batch_size = 50

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=batch
        )
        for emb in response.embeddings:
            embeddings.append(emb.values)

    return embeddings

def get_query_embedding(query: str) -> List[float]:
    """
    Generates an embedding vector for a user search query.
    """
    client = get_client()
    response = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=[query]
    )
    return response.embeddings[0].values

# 3. COSINE SIMILARITY (Pure Math)
def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_v1 = math.sqrt(sum(a * a for a in v1))
    norm_v2 = math.sqrt(sum(b * b for b in v2))
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)

# 4. RETRIEVAL: Find top-K most relevant chunks
def retrieve_top_k(query_vec: List[float], chunks: List[Dict[str, Any]], k: int = 4) -> List[Dict[str, Any]]:
    """
    Scores each chunk against the query vector and returns the top k chunks.
    """
    scored = []
    for chunk in chunks:
        score = cosine_similarity(query_vec, chunk["embedding"])
        scored.append({
            "chunk_index": chunk.get("chunk_index", 0),
            "content": chunk.get("content", ""),
            "score": score
        })

    # Sort descending by similarity score
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:k]

# 5. GENERATION: Answer user question using LangChain Prompt Template + Gemini
def generate_rag_response(query: str, top_chunks: List[Dict[str, Any]], chat_history: List[Dict[str, str]] = None) -> Tuple[str, List[str]]:
    client = get_client()

    context_blocks = []
    sources = []
    for c in top_chunks:
        label = f"Clause Segment #{c['chunk_index'] + 1}"
        sources.append(label)
        context_blocks.append(f"[{label}]:\n{c['content']}")

    context_str = "\n\n".join(context_blocks)

    # LangChain prompt template for grounding context
    prompt_template = PromptTemplate(
        input_variables=["context_str", "query"],
        template="""You are Clarix, an expert AI legal assistant.
A user is asking a question about a legal contract or agreement.

### CONTRACT EXCERPTS:
{context_str}

### INSTRUCTIONS:
1. Answer the question clearly and concisely in plain English using the contract excerpts above.
2. If the excerpts do not contain enough information to answer the question, honestly state that the uploaded document does not mention it.
3. Explicitly reference which Clause Segment (e.g., "According to Clause Segment #2...") provided the answer.
4. Avoid legal jargon and explain terms simply for a non-lawyer.

### USER QUESTION:
{query}
"""
    )

    formatted_prompt = prompt_template.format(context_str=context_str, query=query)

    # Try models in order: gemini-3.5-flash -> gemini-2.5-flash-lite -> gemini-flash-latest
    candidate_models = [
        "models/gemini-3.5-flash",
        "models/gemini-2.5-flash-lite",
        "models/gemini-2.5-flash",
        "models/gemini-flash-latest"
    ]

    response = None
    for model_name in candidate_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=formatted_prompt
            )
            if response and response.text:
                break
        except Exception:
            continue

    answer = response.text if response and response.text else "I could not generate an answer."
    return answer, sources
