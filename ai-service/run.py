import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"Starting Clarix RAG Service on http://127.0.0.1:{port}...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
