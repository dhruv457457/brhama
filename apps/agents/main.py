from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.agents import router as agents_router
from routers.webhooks import router as webhooks_router
from scheduler.jobs import create_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start scheduler
    scheduler = create_scheduler()
    scheduler.start()
    print("[Pact] Scheduler started")
    yield
    scheduler.shutdown()
    print("[Pact] Scheduler stopped")


app = FastAPI(
    title="Pact Agent API",
    description="AI-powered contributor rewards pipeline",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents_router)
app.include_router(webhooks_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "pact-agents"}
