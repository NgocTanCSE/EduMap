from fastapi import APIRouter
import pandas as pd
import json

router = APIRouter(prefix="/api/ai/analytics", tags=["6. AI Education Analytics"])

@router.get("/stats")
async def get_stats():
    # 1. Giả lập một bộ Dữ liệu Lịch sử (Time-Series) 5 năm qua
    data = {
        "year": [2020, 2021, 2022, 2023, 2024],
        "it_enrollment": [1200, 1500, 2100, 2800, 3500],
        "stem_labs": [5, 8, 12, 18, 25]
    }
    df = pd.DataFrame(data)

    # 2. Phân tích Xu hướng (Tính % tăng trưởng trung bình)
    df['it_growth_rate'] = df['it_enrollment'].pct_change() * 100
    avg_growth = df['it_growth_rate'].mean()

    # 3. Thuật toán Dự báo tương lai (Dùng Moving Average / Linear Trend cơ bản)
    # Dự đoán năm 2025 dựa trên tốc độ tăng trưởng trung bình
    pred_2025_it = int(df['it_enrollment'].iloc[-1] * (1 + avg_growth/100))
    
    # Đóng gói dữ liệu trả về cho Frontend vẽ Chart
    response_data = {
        "status": "success",
        "historical_data": df.fillna(0).to_dict(orient="records"),
        "insights": {
            "average_annual_growth_pct": round(avg_growth, 2),
            "prediction_2025_it_students": pred_2025_it,
            "conclusion": f"Nhu cầu học CNTT đang tăng vọt với tốc độ {round(avg_growth, 2)}%/năm. Dự kiến 2025 sẽ có {pred_2025_it} sinh viên."
        }
    }
    
    return response_data
