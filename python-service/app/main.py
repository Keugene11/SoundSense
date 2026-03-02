from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import history, lastfm, library, oauth, search

app = FastAPI(
    title="SoundSense Python Service",
    description="FastAPI microservice wrapping ytmusicapi for YouTube Music integration",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(history.router, prefix="/api")
app.include_router(lastfm.router, prefix="/api")
app.include_router(library.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(oauth.router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
