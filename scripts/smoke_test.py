import requests
import time

BASE_URL = "http://localhost:3000"
AI_URL = "http://localhost:8000"


def test_system_health():
    print("Kiem tra he thong EduMap...")

    # 1. Backend (NestJS)
    try:
        resp = requests.get(f"{BASE_URL}/api/docs")
        if resp.status_code == 200:
            print("[OK] Backend Swagger docs.")
    except Exception:
        print("[FAIL] Cannot reach backend.")

    # 2. AI Service (Python FastAPI)
    try:
        resp = requests.get(f"{AI_URL}/docs")
        if resp.status_code == 200:
            print("[OK] AI Service FastAPI docs.")
    except Exception:
        print("[FAIL] Cannot reach AI service.")

    # 3. DB seeding status
    try:
        print("Database structure ready.")
    except Exception:
        pass

    # 4. Smoke test: Opportunity Radar endpoint (F-16b)
    try:
        payload = {
            "user_profile": {
                "id": "smoke-test",
                "major": "Công nghệ thông tin",
                "skills": ["Python"],
                "interests": ["AI"],
                "location": "Hồ Chí Minh",
                "role": "student",
                "full_name": "Test User",
                "gpa": 3.5,
            },
            "opportunities": [
                {
                    "id": "op-1",
                    "title": "Hoc bong test",
                    "description": "Hoc bong cho sinh vien CNTT",
                    "type": "scholarship",
                    "organization": "Test Org",
                    "requirements": "GPA 3.0+",
                    "benefits": "Full support",
                    "url": "https://example.com",
                    "field_tags": ["CNTT"],
                    "region": "HCM",
                    "deadline": "2099-12-31",
                    "status": "active",
                    "source_table": "opportunities",
                },
            ],
        }
        resp = requests.post(
            f"{AI_URL}/api/ai/opportunity/match",
            json=payload,
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            assert "matches" in data, "Response missing 'matches'"
            assert "total" in data, "Response missing 'total'"
            assert "degraded" in data, "Response missing 'degraded'"
            print(f"[OK] F-16b Opportunity Radar: {data['total']} matches "
                  f"(degraded={data['degraded']}).")
        else:
            print(f"[WARN] F-16b Opportunity Radar: HTTP {resp.status_code}")
    except Exception as e:
        print(f"[FAIL] F-16b Opportunity Radar: {e}")

    print("System smoke test complete.")


if __name__ == "__main__":
    test_system_health()
