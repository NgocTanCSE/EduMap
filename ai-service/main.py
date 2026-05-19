from fastapi import FastAPI, Body
from services.predictive_service import predictive_service

app = FastAPI()

@app.get("/api/ai/trends")
async def get_trends():
    # Gia lap du lieu thi truong lon
    mock_logs = [{"keyword": "AI"}, {"keyword": "AI"}, {"keyword": "Green Tech"}]
    return predictive_service.analyze_trends(mock_logs)

@app.post("/api/ai/predict")
async def predict_user(data: dict = Body(...)):
    user_id = data.get("user_id")
    history = data.get("recent_keywords", [])
    prediction = predictive_service.predict_career_path(history)
    return {"user_id": user_id, "recommendation": prediction}

@app.get("/")
async def root():
    return {"message": "EduMap AI Service is running with Predictive Engine!"}
