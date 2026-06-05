from fastapi import FastAPI
from app.routers.chat import router as chat_router # Import the chat router

app = FastAPI(title="EduMap AI Service")

@app.get("/")
async def root():
    return {"message": "EduMap AI Service is running"}

app.include_router(chat_router, prefix="/ai") # Include the chat router

