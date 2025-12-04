"""FastAPI application serving Next.js frontend and providing backend APIs."""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path

app = FastAPI(
    title="Rooster App Verloskunde",
    description="Planning application for healthcare practice",
    version="3.0.0-railway"
)

# Health check endpoint for Railway
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "3.0.0-railway"}

# API endpoints
@app.get("/api/version")
async def get_version():
    return {
        "version": "3.0.0-railway",
        "backend": "FastAPI",
        "frontend": "Next.js Static Export"
    }

# Mount Next.js static files
static_dir = Path("out")
if static_dir.exists():
    # Serve Next.js build output
    app.mount("/_next", StaticFiles(directory="out/_next"), name="nextjs")
    app.mount("/static", StaticFiles(directory="out"), name="static")
    
    # Catch-all route for Next.js pages
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Try to serve the requested file
        file_path = static_dir / full_path
        
        # If it's a file, serve it
        if file_path.is_file():
            return FileResponse(file_path)
        
        # If it's a directory or doesn't exist, try index.html
        index_path = static_dir / full_path / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        # Fallback to root index.html (SPA fallback)
        return FileResponse(static_dir / "index.html")
else:
    @app.get("/")
    async def root():
        return {
            "message": "Frontend not built yet. Run 'npm run build' first.",
            "backend_status": "operational"
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
