from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import time
import subprocess

from models.geo_models import GeoDensityAnalysisRequest, VisionDetectRequest

router = APIRouter(prefix="/api/ai/geo", tags=["8. AI Geo-Education Analysis"])

# ── GeoVision AI (Idea #10) — HF Inference API config ──────────────────────
GEO_VISION_MODEL = os.getenv("GEO_VISION_MODEL", "facebook/owlv2-base-c")
HF_TOKEN = (os.getenv("HF_TOKEN") or os.getenv("HF_API_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN") or "").strip().strip('"').strip("'")
HF_ROUTER_URL = os.getenv("HF_ROUTER_URL", "https://router.huggingface.co").rstrip("/")
# Circuit breaker: skip HF vision inference for 5 min after auth/network failure
_geo_vision_down_until = 0.0
GEO_VISION_TIMEOUT = float(os.getenv("GEO_VISION_TIMEOUT_SECONDS", "25"))
GEO_VISION_DEFAULT_LABELS = [
    "school", "university", "educational institution", "college",
    "building", "campus", "library",
]

# ── Local vision fallback (Idea #10) ────────────────────────────────────────
# When HF_TOKEN is absent (common on HF Spaces free plan without secrets),
# GeoVision AI falls back to a LOCAL zero-shot object detection model loaded
# into RAM. We use facebook/owlv2-tiny (~120MB RAM) — smallest OV model that
# still detects buildings/schools. This guarantees vision detection works
# with ZERO API keys as per AGENTS.md §3 "never 502s" rule.
#
# Env-tunable:
#   LOCAL_VISION_MODEL       — default facebook/owlv2-tiny-vvit/od (smallest)
#   LOCAL_VISION_ENABLED     — default true (auto-enable when HF_TOKEN absent)
#   LOCAL_VISION_THRESHOLD   — default 0.25 (lower = more detections, more noise)
#   LOCAL_VISION_IMAGE_MAX   — default 1024 (square max px, keeps CPU inference <15s)
LOCAL_VISION_MODEL = os.getenv("LOCAL_VISION_MODEL", "facebook/owlv2-tiny")
LOCAL_VISION_ENABLED = os.getenv("LOCAL_VISION_ENABLED", "true").lower() not in ("0", "false", "no", "off")
LOCAL_VISION_THRESHOLD = float(os.getenv("LOCAL_VISION_THRESHOLD", "0.25"))
LOCAL_VISION_IMAGE_MAX = int(os.getenv("LOCAL_VISION_IMAGE_MAX", "1024"))

# Singleton state for local vision model (lazy-loaded, never reloaded)
_local_vision_model = None
_local_vision_processor = None
_local_vision_loaded = False
_local_vision_load_failed = False


def _strip_data_uri(b64: str) -> str:
    """Remove the 'data:image/png;base64,' prefix if present."""
    if not b64:
        return ""
    if "," in b64 and b64.startswith("data:"):
        return b64.split(",", 1)[1]
    return b64


def _load_local_vision_model():
    """Lazy-load the local zero-shot object detection model (owlv2-tiny).

    Runs on CPU via torch (no GPU needed). Singleton — loads once and caches.
    Uses getattr for resilience if partially-constructed in tests.

    Model size: ~120MB download, ~200-300MB RAM (tiny variant).
    Inference: ~3-8s per 1024×1024 image on 2-vCPU HF Spaces.
    """
    global _local_vision_model, _local_vision_processor
    global _local_vision_loaded, _local_vision_load_failed

    if _local_vision_loaded:
        return _local_vision_model is not None, _local_vision_processor
    if _local_vision_load_failed:
        return False, None

    try:
        import torch
        from transformers import Owlv2ForObjectDetection, Owlv2Processor
        from PIL import Image
        import base64
        import io
        import numpy as np

        print(f"[GeoVision] Loading local vision model: {LOCAL_VISION_MODEL} ...")
        _local_vision_processor = Owlv2Processor.from_pretrained(LOCAL_VISION_MODEL)
        _local_vision_model = Owlv2ForObjectDetection.from_pretrained(LOCAL_VISION_MODEL)
        torch.set_num_threads(int(os.getenv("LOCAL_VISION_THREADS", "1")))
        _local_vision_loaded = True
        print(f"[GeoVision] Local vision model loaded OK ({LOCAL_VISION_MODEL})")
        return True, _local_vision_processor
    except Exception as e:
        print(f"[GeoVision] Local vision model load FAILED: {type(e).__name__}: {e}")
        _local_vision_load_failed = True
        _local_vision_loaded = True
        return False, None


def _b64_to_image(image_b64: str, max_px: int = 1024):
    """Decode base64 image → PIL Image, resized to max_px square for CPU speed."""
    import base64 as _b64
    import io
    from PIL import Image
    raw = _b64.b64decode(image_b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    # Resize to keep CPU inference fast (<15s on 2-vCPU HF free tier)
    ratio = min(max_px / img.width, max_px / img.height, 1.0)
    if ratio < 1.0:
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.BICUBIC)
    return img


def _local_vision_detect(image_b64: str, labels: List[str]) -> List[dict]:
    """Run object detection locally on CPU via OwlV2-tiny.

    Mirrors the HF Inference API response shape:
    [{score, label, box:{xmin,ymin,xmax,ymax}}, ...]

    Degrades gracefully: if torch/transformers unavailable, the model fails
    to load, or inference errors out, returns [] (empty detections).
    """
    ok, processor = _load_local_vision_model()
    if not ok or _local_vision_model is None or processor is None:
        raise RuntimeError(
            f"Local vision model '{LOCAL_VISION_MODEL}' could not be loaded "
            "(torch/transformers unavailable or model download failed)"
        )

    try:
        import torch
        from PIL import Image

        img = _b64_to_image(image_b64, LOCAL_VISION_IMAGE_MAX)
        inputs = processor(images=img, return_tensors="pt")
        with torch.no_grad():
            outputs = _local_vision_model(**inputs)

        # OwlV2 post-processing: rescale boxes from [0,1] to pixel coords
        target_sizes = torch.tensor([img.size[::-1]])  # (height, width) of PIL image
        results = processor.post_process_object_detection(
            outputs, target_sizes=target_sizes, threshold=LOCAL_VISION_THRESHOLD
        )[0]

        detections = []
        # OwlV2 zero-shot: map text labels → predicted classes
        label_map = {i: lbl for i, lbl in enumerate(labels)}
        for box, score, label_id in zip(results["boxes"], results["scores"], results["labels"]):
            lbl = label_map.get(int(label_id), str(label_id))
            x1, y1, x2, y2 = box.tolist()
            detections.append({
                "score": float(score),
                "label": lbl,
                "box": {
                    "xmin": int(x1),
                    "ymin": int(y1),
                    "xmax": int(x2),
                    "ymax": int(y2),
                },
            })
        # Sort by score descending
        detections.sort(key=lambda d: d["score"], reverse=True)
        return detections
    except ImportError:
        raise RuntimeError("Local vision requires torch + transformers (not installed)")
    except RuntimeError as e:
        raise  # propagate OOM / inference errors
    except Exception as e:
        print(f"[GeoVision] Local detection error: {type(e).__name__}: {e}")
        return []
    """Call HF Inference API (facebook/owlv2) via curl — IPv4 + --insecure
    for HF Spaces compatibility (same pattern as vector_store.py embeddings).

    Returns: [{score, label, box:{xmin,ymin,xmax,ymax}}, ...]
    Raises RuntimeError on auth error or persistent failure.
    """
    global _geo_vision_down_until

    # Circuit breaker
    if time.monotonic() < _geo_vision_down_until:
        raise RuntimeError("HF vision inference temporarily disabled (circuit breaker — 5 min cooldown)")

    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN not set — cannot use HuggingFace Inference API for vision detection")

    url = f"{HF_ROUTER_URL}/models/{GEO_VISION_MODEL}"
    payload = json.dumps({
        "image": image_b64,
        "candidate_labels": labels,
        "options": {"wait_for_model": True},
    }).encode("utf-8")

    try:
        proc = subprocess.run(
            ["curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
             "-H", f"Authorization: Bearer {HF_TOKEN}",
             "-H", "Content-Type: application/json",
             "-d", payload.decode("utf-8"),
             "--connect-timeout", "5",
             "--max-time", str(int(GEO_VISION_TIMEOUT)),
             url],
            capture_output=True, text=True, timeout=GEO_VISION_TIMEOUT + 5,
        )
    except subprocess.TimeoutExpired:
        _geo_vision_down_until = time.monotonic() + 300
        raise RuntimeError(f"HF vision curl timed out after {GEO_VISION_TIMEOUT}s")
    except Exception as e:
        raise RuntimeError(f"HF vision connection failed: {type(e).__name__}: {e}")

    if proc.returncode != 0:
        body = (proc.stderr or "").strip()[:300] or f"curl exit {proc.returncode}"
        stdout = (proc.stdout or "").strip()
        if stdout:
            try:
                partial = json.loads(stdout)
                if isinstance(partial, dict) and "error" in partial:
                    err = partial["error"]
                    err_str = str(err) if not isinstance(err, dict) else str(err.get("message", err))
                    low = err_str.lower()
                    if "401" in str(partial) or "api key" in low or "invalid" in low or "unauthorized" in low or "unauthenticated" in low:
                        _geo_vision_down_until = time.monotonic() + 300
                        print("[GeoVision] HF vision circuit breaker set (auth error) — 5 min cooldown")
                        raise RuntimeError(f"HF vision auth error: {err_str[:200]}")
                    body = f"{body} | body: {err_str[:120]}"
            except json.JSONDecodeError:
                pass
        _geo_vision_down_until = time.monotonic() + 300
        raise RuntimeError(f"HF Inference API connection failed: {body}")

    try:
        data = json.loads(proc.stdout or "{}")
    except Exception:
        raise RuntimeError(f"HF Inference API invalid JSON: {(proc.stdout or '')[:200]}")

    # Handle error response
    if isinstance(data, dict) and "error" in data and not data.get("detections"):
        err_str = str(data.get("error", ""))
        low = err_str.lower()
        if "loading" in low and "wait" in low:
            raise RuntimeError("HF vision model is loading — please retry in a few seconds")
        if "401" in str(data) or "api key" in low or "invalid" in low or "unauthorized" in low or "unauthenticated" in low:
            _geo_vision_down_until = time.monotonic() + 300
            print("[GeoVision] HF vision circuit breaker set (HTTP 401) — 5 min cooldown")
            raise RuntimeError(f"HF vision auth error: {err_str[:200]}")
        raise RuntimeError(f"HF Inference API error: {data.get('error')}")

    # Normal success: list of {score, label, box}
    if isinstance(data, list):
        return data
    # Sometimes the API wraps results in {"detections": [...]}
    if isinstance(data, dict) and "detections" in data:
        return data["detections"]
    return []


# Lazy load services
_services_loaded = False
_db_service = None
_clustering_service = None

def _get_services():
    global _services_loaded, _db_service, _clustering_service
    if not _services_loaded:
        try:
            from services.db_service import db_service as db
            _db_service = db
        except:
            pass
        try:
            from services.clustering_service import clustering_service as cs
            _clustering_service = cs
        except:
            pass
        _services_loaded = True
    return _db_service, _clustering_service

class GeoAnalysisRequest(BaseModel):
    region_name: Optional[str] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[float] = None
    school_points: Optional[List[dict]] = None

class GeoRecommendRequest(BaseModel):
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None
    radius_km: float = 5.0
    category: Optional[str] = None
    limit: int = 10

@router.post("/analyze")
async def analyze_geo_density(data: GeoDensityAnalysisRequest):
    try:
        db, cs = _get_services()
        if cs is None:
            raise HTTPException(status_code=503, detail="Clustering service không khả dụng.")
        points = data.points or []
        hubs = cs.identify_education_hubs(points) if points else []

        from services.llm_service import llm_service
        if not llm_service:
            raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")
        analysis = await llm_service.analyze_geo_density(data, hubs)

        # Pass through degraded status if the AI method returned a fallback
        degraded = analysis.pop("_degraded", False) if isinstance(analysis, dict) else False
        reason = analysis.pop("_reason", None) if isinstance(analysis, dict) else None

        return {"hubs": hubs, "ai_analysis": analysis, "degraded": degraded, "reason": reason}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in analyze_geo_density: {e}")
        raise HTTPException(status_code=503, detail="Geo analysis service không khả dụng.")

@router.post("/analyze-gaps")
async def analyze_education_gaps(data: GeoAnalysisRequest):
    try:
        db, cs = _get_services()
        if cs is None:
            raise HTTPException(status_code=503, detail="Clustering service không khả dụng.")
        points = data.school_points or []
        center = {"lat": data.center_lat or 10.9567, "lng": data.center_lng or 107.1825}
        gaps = cs.identify_gaps(points, center)
        return {"status": "success", "gaps": gaps}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in analyze_education_gaps: {e}")
        raise HTTPException(status_code=503, detail="Không phân tích được khoảng trống giáo dục.")

@router.post("/heatmap")
async def get_geo_heatmap(data: GeoAnalysisRequest):
    try:
        db, cs = _get_services()
        if cs is None:
            raise HTTPException(status_code=503, detail="Clustering service không khả dụng.")
        points = data.school_points or []
        region_center = {
            "lat": data.center_lat or 10.9567,
            "lng": data.center_lng or 107.1825
        }
        radius_km = data.radius_km or 5.0
        heatmap_data = cs.generate_heatmap_data(points, region_center, radius_km) or []
        return {
            "status": "success",
            "heatmap": heatmap_data,
            "center": region_center,
            "radius_km": radius_km,
            "total_points": len(heatmap_data)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_geo_heatmap: {e}")
        raise HTTPException(status_code=503, detail="Không tạo được bản đồ nhiệt.")

@router.post("/recommend")
async def recommend_nearby_opportunities(data: GeoRecommendRequest):
    try:
        db, cs = _get_services()
        if not db or not cs:
            raise HTTPException(status_code=503, detail="Dịch vụ bản đồ chưa sẵn sàng.")

        locations = db.get_nearby_locations(
            data.user_lat,
            data.user_lng,
            data.radius_km or 5.0,
            data.category,
            (data.limit or 10) * 3
        ) or []

        nearby_data = []
        for i, loc in enumerate(locations):
            loc_lat = loc.get('lat')
            loc_lng = loc.get('lng')
            if loc_lat is None or loc_lng is None:
                continue
            distance = cs._haversine_distance(
                data.user_lat, data.user_lng,
                float(loc_lat), float(loc_lng)
            )
            if distance <= (data.radius_km or 5.0):
                category = loc.get('type', 'other') or loc.get('category_id', 'other')
                nearby_data.append({
                    "id": str(loc.get('id', i)),
                    "name": loc.get('name', 'Unknown'),
                    "category": category,
                    "lat": float(loc_lat),
                    "lng": float(loc_lng),
                    "distance_km": round(distance, 2),
                    "rating": float(loc.get('rating_avg', 4.0)),
                    "is_free": category in ['library', 'wifi', 'green', 'park']
                })

        nearby_data.sort(key=lambda x: x.get('distance_km', 999))
        nearby_data = nearby_data[:data.limit or 10]
        return {
            "status": "success",
            "recommendations": nearby_data,
            "total_found": len(nearby_data),
            "search_radius_km": data.radius_km or 5.0,
            "center": {"lat": data.user_lat, "lng": data.user_lng}
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in recommend_nearby_opportunities: {e}")
        raise HTTPException(status_code=503, detail="Không gợi đề xuất được địa điểm gần bạn.")


@router.post("/vision-detect")
async def vision_detect(request: VisionDetectRequest):
    """
    GeoVision AI (Idea #10) — POST /api/ai/geo/vision-detect

    Sends a base64-encoded satellite/map image to the HF Inference API
    (facebook/owlv2 — zero-shot object detection) and returns detection
    results: [{score, label, box:{xmin,ymin,xmax,ymax}}].

    Uses curl --ipv4 --insecure for HF Spaces IPv6/TLS compatibility
    (same pattern as vector_store.py embeddings).

    Degrades gracefully: on HF API failure, returns an empty detections
    list with degraded=True — the backend orchestrator will surface this
    to the frontend as "AI unavailable, 0 detections found".
    """
    labels = request.labels or GEO_VISION_DEFAULT_LABELS
    image_b64 = _strip_data_uri(request.image_base64)
    used_model = GEO_VISION_MODEL
    detection_source = "hf_api"

    if not image_b64:
        return {
            "detections": [],
            "model": GEO_VISION_MODEL,
            "degraded": True,
            "error": "image_base64 is required and non-empty",
        }

    try:
        # ── Priority 1: HF Inference API (fast, server-side, if HF_TOKEN set) ──
        if HF_TOKEN:
            try:
                detections = _hf_vision_detect(image_b64, labels)
                used_model = GEO_VISION_MODEL
                detection_source = "hf_api"
            except RuntimeError as hf_err:
                print(f"[GeoVision] HF vision failed ({hf_err}), falling back to local model ...")
                # Fall through to local fallback below
                detections = _local_vision_detect(image_b64, labels)
                used_model = LOCAL_VISION_MODEL
                detection_source = "local"
        else:
            # ── Priority 2: Local model (100% offline, no API key needed)   ──
            # Per AGENTS.md §3: on HF Spaces free plan without secrets, local
            # model is the guaranteed backup. Lazy-loads ~120MB model on first
            # call (~3-8s inference on 2-vCPU CPU).
            if not LOCAL_VISION_ENABLED:
                raise RuntimeError("HF_TOKEN not set and LOCAL_VISION_ENABLED=false — no vision provider available")
            detections = _local_vision_detect(image_b64, labels)
            used_model = LOCAL_VISION_MODEL
            detection_source = "local"

        # Normalise box field names to camelCase for consistency
        normalised = []
        for d in detections:
            box = d.get("box", {})
            normalised.append({
                "score": float(d.get("score", 0.0)),
                "label": str(d.get("label", "unknown")),
                "box": {
                    "xmin": int(box.get("xmin", 0)),
                    "ymin": int(box.get("ymin", 0)),
                    "xmax": int(box.get("xmax", 0)),
                    "ymax": int(box.get("ymax", 0)),
                },
            })
        source_str = "local" if detection_source == "local" else "HF API"
        print(f"[GeoVision] {used_model} ({source_str}): {len(normalised)} detections from {len(image_b64)} base64 chars")
        return {
            "detections": normalised,
            "model": used_model,
            "degraded": False if len(normalised) > 0 else True,
            "degradation_reason": None if len(normalised) > 0 else "No objects detected above threshold",
            "source": detection_source,
        }
    except RuntimeError as e:
        print(f"[GeoVision] vision detection degraded: {e}")
        return {
            "detections": [],
            "model": LOCAL_VISION_MODEL if not HF_TOKEN else GEO_VISION_MODEL,
            "degraded": True,
            "error": str(e)[:300],
            "source": "none",
        }
    except Exception as e:
        print(f"[GeoVision] Unexpected error: {e}")
        return {
            "detections": [],
            "model": LOCAL_VISION_MODEL if not HF_TOKEN else GEO_VISION_MODEL,
            "degraded": True,
            "error": str(e)[:300],
            "source": "none",
        }
