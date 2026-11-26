"""Root FastAPI entrypoint for Vercel and local `uvicorn main:app` execution."""

from backend.main import app

__all__ = ["app"]
