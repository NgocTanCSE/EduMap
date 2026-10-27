import os
try:
    import numpy as np
    from sklearn.cluster import DBSCAN
    from scipy.spatial import Voronoi, ConvexHull
    import pandas as pd
    from typing import List, Dict, Optional, Any, Tuple
    from math import radians, sin, cos, sqrt, atan2
    SKLEARN_OK = True
except ImportError as e:
    SKLEARN_OK = False
    print(f"clustering_service: sklearn/scipy not available: {e}")


def _empty_feature_collection() -> Dict:
    """A valid, empty GeoJSON FeatureCollection."""
    return {"type": "FeatureCollection", "features": []}


def _cluster_polygon(cluster_df: pd.DataFrame) -> Dict:
    """Build a GeoJSON geometry (Polygon or Point) bounding a cluster.

    Uses the convex hull of the cluster's member points so the frontend can
    draw a closed polygon boundary (``react-leaflet`` GeoJSON layer).
    Geometry coordinates follow RFC 7946 ordering: ``[lng, lat]``.

    Falls back to a Point at the centroid when the cluster has fewer than 3
    points or the points are collinear (``ConvexHull`` raises ``QhullError``),
    so the map ALWAYS receives a valid, renderable geometry.
    """
    try:
        pts = cluster_df[['lat', 'lng']].to_numpy()
        if len(pts) >= 3:
            hull = ConvexHull(pts)
            # ConvexHull.vertices are counterclockwise hull vertex indices.
            # Close the ring by repeating the first vertex (RFC 7946 3.1.6).
            ring = [[float(pts[i, 1]), float(pts[i, 0])] for i in hull.vertices]
            ring.append(ring[0])
            return {"type": "Polygon", "coordinates": [ring]}
        # 1-2 points: emit a Point at the centroid so the hub is still visible.
        lat = float(cluster_df['lat'].mean())
        lng = float(cluster_df['lng'].mean())
        return {"type": "Point", "coordinates": [lng, lat]}
    except Exception:
        # Collinear / degenerate input -> Point at the centroid.
        lat = float(cluster_df['lat'].mean())
        lng = float(cluster_df['lng'].mean())
        return {"type": "Point", "coordinates": [lng, lat]}


class ClusteringService:
    def identify_education_hubs(self, points: List[Dict]) -> Dict:
        """Cluster education POIs with DBSCAN and return a GeoJSON
        ``FeatureCollection``.

        Issue #7 (GeoAI → GeoJSON): previously this returned a flat list of hub
        metadata dicts ({hub_id, center, point_count, categories}) which could
        NOT be drawn as boundaries on a map. It now serializes every cluster as
        a GeoJSON ``Feature`` whose ``geometry`` is the cluster's convex-hull
        polygon (so the frontend can render a boundary polygon) and whose
        ``properties`` carry the legacy hub metadata (so the AI summary panel
        keeps working).

        Returns an empty FeatureCollection (``{"type":"FeatureCollection",
        "features":[]}``) when sklearn is unavailable, the input is empty,
        or clustering fails — callers always receive a valid GeoJSON object.
        """
        if not SKLEARN_OK:
            return _empty_feature_collection()
        if not points or len(points) < 3:
            return _empty_feature_collection()

        try:
            df = pd.DataFrame(points)
            # Ensure required columns exist; tolerate missing 'category'.
            if 'category' not in df.columns:
                df['category'] = 'unknown'

            coords = df[['lat', 'lng']].values
            db = DBSCAN(eps=0.01, min_samples=3).fit(coords)
            df['cluster'] = db.labels_

            total_points = len(df)
            features = []
            for cluster_id in set(db.labels_):
                if cluster_id == -1:
                    continue  # noise points are not hubs
                cluster_points = df[df['cluster'] == cluster_id]
                point_count = len(cluster_points)
                center_lat = float(cluster_points['lat'].mean())
                center_lng = float(cluster_points['lng'].mean())
                categories = cluster_points['category'].unique().tolist()

                features.append({
                    "type": "Feature",
                    "geometry": _cluster_polygon(cluster_points),
                    "properties": {
                        "hub_id": int(cluster_id),
                        "center": {"lat": center_lat, "lng": center_lng},
                        "point_count": point_count,
                        "categories": categories,
                        # Relative density: share of all points this hub concentrates.
                        "density_score": round(point_count / max(total_points, 1) * 100, 1),
                        "name": f"Cụm giáo dục #{int(cluster_id)}",
                    },
                })

            # Sort by point_count desc (most significant hubs first).
            features.sort(key=lambda f: f["properties"]["point_count"], reverse=True)
            return {"type": "FeatureCollection", "features": features}
        except Exception as e:
            print(f"Error identifying hubs: {e}")
            return _empty_feature_collection()

    def identify_gaps(self, points: List[Dict], region_center: Dict, radius_km: float = 5.0) -> List[Dict]:
        if not SKLEARN_OK:
            return []
        if not points or len(points) < 3:
            return []
        try:
            center_lat = region_center.get('lat', 10.9567)
            center_lng = region_center.get('lng', 107.1825)
            grid_size = 0.01
            grid_points = []

            for lat_offset in np.arange(-radius_km/111, radius_km/111, grid_size):
                for lng_offset in np.arange(-radius_km/111, radius_km/111, grid_size):
                    grid_lat = center_lat + lat_offset
                    grid_lng = center_lng + lng_offset
                    min_distance = float('inf')
                    for point in points:
                        dist = self._haversine_distance(grid_lat, grid_lng, point['lat'], point['lng'])
                        min_distance = min(min_distance, dist)
                    if min_distance > 2.0:
                        grid_points.append({
                            "lat": float(grid_lat),
                            "lng": float(grid_lng),
                            "distance_to_nearest": float(min_distance),
                            "gap_score": min(min_distance / 5.0, 1.0)
                        })

            if not grid_points:
                return []

            gap_df = pd.DataFrame(grid_points)
            coords = gap_df[['lat', 'lng']].values
            db = DBSCAN(eps=grid_size * 2, min_samples=2).fit(coords)
            gap_df['cluster'] = db.labels_

            gaps = []
            for cluster_id in set(db.labels_):
                if cluster_id == -1:
                    continue
                cluster_points = gap_df[gap_df['cluster'] == cluster_id]
                center_lat = cluster_points['lat'].mean()
                center_lng = cluster_points['lng'].mean()
                avg_gap_score = cluster_points['gap_score'].mean()
                gaps.append({
                    "area": f"Vùng thiếu hụt #{cluster_id + 1}",
                    "center": {"lat": float(center_lat), "lng": float(center_lng)},
                    "gap_score": float(avg_gap_score),
                    "affected_points": len(cluster_points),
                    "reason": "Cần bổ sung cơ sở giáo dục"
                })
            return sorted(gaps, key=lambda x: x['gap_score'], reverse=True)
        except Exception as e:
            print(f"Error identifying gaps: {e}")
            return []

    def identify_data_gaps(self, points: List[Dict], grid_size_km: float = 1.0) -> Dict:
        """Grid-based coverage analysis + attribute gap detection (Idea #6).

        Divides the bounding box of *points* into a regular grid whose cells
        are ``grid_size_km`` × ``grid_size_km``.  Cells that contain **zero**
        POIs are flagged as **spatial gaps** (priority survey targets).
        Independently, the method aggregates which POI attributes (name,
        address, city, description, rating, …) are missing across the input
        set, producing an **attribute gap** report.

        Args:
            points: list of POI dicts. Each dict must contain ``lat``/``lng``;
                optional keys like ``name``, ``address``, ``city``,
                ``district``, ``description``, ``category``, ``source``,
                ``verified``, ``updated_at``, ``rating_avg``, ``website``,
                ``hours`` are inspected for the attribute-gap report.
            grid_size_km: side length of each grid cell in kilometres
                (default 1 km → ≈0.009°; clamped to [0.1, 50] km).

        Returns a GeoJSON ``FeatureCollection`` (RFC 7946, ``[lng, lat]``)
        whose ``features`` are the gap grid-cells (Polygon) sorted by
        ``gap_score`` descending, plus top-level ``summary`` and
        ``attribute_gaps`` keys the router can forward verbatim.

        When ``sklearn`` is unavailable, the points list is empty, or an error
        occurs, a valid-but-degraded envelope is returned so the frontend
        never crashes (per AGENTS.md "degrade, never crash").
        """
        degraded_reason: Optional[str] = None

        if not SKLEARN_OK:
            degraded_reason = "scikit-learn/scipy not available — analysis degraded."
            return {
                "type": "FeatureCollection",
                "features": [],
                "summary": {
                    "total_cells": 0, "gap_cells": 0, "gap_rate": 0.0,
                    "total_points": 0, "grid_size_km": grid_size_km,
                    "attribute_gaps": {},
                },
                "attribute_gaps": {},
                "metadata": {
                    "method": "grid_based_coverage_analysis",
                    "degraded": True,
                    "reason": degraded_reason,
                },
            }

        if not points:
            return {
                "type": "FeatureCollection",
                "features": [],
                "summary": {
                    "total_cells": 0, "gap_cells": 0, "gap_rate": 0.0,
                    "total_points": 0, "grid_size_km": grid_size_km,
                    "attribute_gaps": {},
                },
                "attribute_gaps": {},
                "metadata": {
                    "method": "grid_based_coverage_analysis",
                    "degraded": True,
                    "reason": "Không có POI nào để phân tích.",
                },
            }

        try:
            # ── 1. Normalise points (clamp grid_size_km, parse lat/lng) ──────
            grid_size_km = max(0.1, min(50.0, float(grid_size_km)))
            grid_deg = grid_size_km / 111.0  # degrees ≈ km (equirectangular approx)

            valid_pts: List[Dict[str, Any]] = []
            for p in points:
                lat = self._safe_float(p.get("lat"))
                lng = self._safe_float(p.get("lng"))
                if lat is None or lng is None:
                    continue
                valid_pts.append({"lat": lat, "lng": lng, **p})

            if not valid_pts:
                degraded_reason = "No points with valid coordinates."
                return {
                    "type": "FeatureCollection",
                    "features": [],
                    "summary": {
                        "total_cells": 0, "gap_cells": 0, "gap_rate": 0.0,
                        "total_points": 0, "grid_size_km": grid_size_km,
                        "attribute_gaps": {},
                    },
                    "attribute_gaps": {},
                    "metadata": {
                        "method": "grid_based_coverage_analysis",
                        "degraded": True,
                        "reason": degraded_reason,
                    },
                }

            # ── 2. Build grid over the bounding box ──────────────────────────
            lats = [p["lat"] for p in valid_pts]
            lngs = [p["lng"] for p in valid_pts]
            lat_min, lat_max = min(lats), max(lats)
            lng_min, lng_max = min(lngs), max(lngs)

            # Extend the bbox by one cell on each side so the boundary cells
            # are full squares (not clipped halves).
            lat_min -= grid_deg
            lat_max += grid_deg
            lng_min -= grid_deg
            lng_max += grid_deg

            # ── 3. Spatial index: assign each point to a grid cell ───────────
            # cell index (row, col) → points
            def _cell_index(lat: float, lng: float) -> Tuple[int, int]:
                row = int((lat - lat_min) // grid_deg) if grid_deg > 0 else 0
                col = int((lng - lng_min) // grid_deg) if grid_deg > 0 else 0
                return row, col

            cell_to_points: Dict[Tuple[int, int], List[Dict[str, Any]]] = {}
            for p in valid_pts:
                idx = _cell_index(p["lat"], p["lng"])
                cell_to_points.setdefault(idx, []).append(p)

            n_rows = int((lat_max - lat_min) // grid_deg) + 1
            n_cols = int((lng_max - lng_min) // grid_deg) + 1
            total_cells = n_rows * n_cols

            # ── 4. Identify gap cells (zero POI count) ────────────────────────
            features: List[Dict[str, Any]] = []
            gap_cells = 0

            # Pre-compute point arrays for vectorised nearest-distance.
            pt_lats = np.array([p["lat"] for p in valid_pts])
            pt_lngs = np.array([p["lng"] for p in valid_pts])

            for row in range(n_rows):
                for col in range(n_cols):
                    cell_pts = cell_to_points.get((row, col), [])
                    count = len(cell_pts)

                    cell_lat_min = lat_min + row * grid_deg
                    cell_lng_min = lng_min + col * grid_deg
                    cell_lat_max = cell_lat_min + grid_deg
                    cell_lng_max = cell_lng_min + grid_deg
                    center_lat = (cell_lat_min + cell_lat_max) / 2.0
                    center_lng = (cell_lng_min + cell_lng_max) / 2.0

                    if count == 0:
                        # Spatial gap — compute distance to nearest POI.
                        dists = self._haversine_vectorized(
                            center_lat, center_lng, pt_lats, pt_lngs
                        )
                        nearest_dist = float(np.min(dists)) if dists.size else 0.0
                        gap_score = min(nearest_dist / (grid_size_km * 3.0), 1.0)
                        gap_cells += 1

                        ring = [
                            [cell_lng_min, cell_lat_min],
                            [cell_lng_max, cell_lat_min],
                            [cell_lng_max, cell_lat_max],
                            [cell_lng_min, cell_lat_max],
                            [cell_lng_min, cell_lat_min],  # closed ring (RFC 7946 3.1.6)
                        ]
                        features.append({
                            "type": "Feature",
                            "geometry": {"type": "Polygon", "coordinates": [ring]},
                            "properties": {
                                "cell_id": f"{row}:{col}",
                                "center": {"lat": center_lat, "lng": center_lng},
                                "gap_type": "spatial",
                                "gap_score": round(gap_score, 3),
                                "points_in_cell": 0,
                                "nearest_poi_distance_km": round(nearest_dist, 3),
                                "priority": "high" if gap_score >= 0.5 else "medium" if gap_score >= 0.2 else "low",
                                "reason": "Khu vực chưa có cơ sở giáo dục nào trong ô lưới này.",
                                "area": f"Ô lưới {row}:{col} — chưa được khảo sát",
                            },
                        })

            # Sort spatial gaps by gap_score descending.
            features.sort(key=lambda f: f["properties"]["gap_score"], reverse=True)

            # ── 5. Attribute gap detection (global aggregate) ────────────────
            attribute_gaps = self._detect_attribute_gaps(valid_pts)

            summary = {
                "total_cells": total_cells,
                "gap_cells": gap_cells,
                "gap_rate": round(gap_cells / max(total_cells, 1) * 100, 1),
                "total_points": len(valid_pts),
                "grid_size_km": grid_size_km,
                "attribute_gaps": attribute_gaps,
            }

            return {
                "type": "FeatureCollection",
                "features": features,
                "summary": summary,
                "attribute_gaps": attribute_gaps,
                "metadata": {
                    "method": "grid_based_coverage_analysis",
                    "degraded": False,
                    "reason": None,
                },
            }

        except Exception as e:
            print(f"Error identifying data gaps: {e}")
            return {
                "type": "FeatureCollection",
                "features": [],
                "summary": {
                    "total_cells": 0, "gap_cells": 0, "gap_rate": 0.0,
                    "total_points": len(points) if points else 0,
                    "grid_size_km": grid_size_km,
                    "attribute_gaps": {},
                },
                "attribute_gaps": {},
                "metadata": {
                    "method": "grid_based_coverage_analysis",
                    "degraded": True,
                    "reason": f"Lỗi phân tích: {e}",
                },
            }

    def _detect_attribute_gaps(self, points: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate which POI attributes are missing across the input set.

        Returns ``{attr: {missing, total, pct}}`` sorted by pct desc.
        An attribute is "missing" when its value is ``None``, empty string,
        or absent from the dict.
        """
        if not points:
            return {}
        total = len(points)
        # Attributes to inspect for gaps — ordered by importance for the
        # survey-priority list.
        attrs = ["name", "address", "city", "district", "description",
                 "category", "rating_avg", "website", "hours",
                 "verified", "updated_at"]
        result: Dict[str, Any] = {}
        for attr in attrs:
            missing = 0
            for p in points:
                val = p.get(attr)
                if val is None or (isinstance(val, str) and val.strip() == ""):
                    missing += 1
            if missing > 0:
                result[attr] = {
                    "missing": missing,
                    "total": total,
                    "pct": round(missing / total * 100, 1),
                }
        # Sort by pct desc for the priority list.
        result = dict(sorted(result.items(), key=lambda x: x[1]["pct"], reverse=True))
        return result

    def _haversine_vectorized(self, lat1: float, lng1: float,
                              lats: np.ndarray, lngs: np.ndarray) -> np.ndarray:
        """Vectorised haversine distance (km) from a single point to arrays."""
        try:
            R = 6371.0
            lat1_rad = radians(lat1)
            lat2_rad = np.radians(lats)
            dlat = np.radians(lats) - lat1_rad
            dlon = np.radians(lngs) - radians(lng1)
            a = (np.sin(dlat / 2) ** 2
                 + np.cos(lat1_rad) * np.cos(lat2_rad)
                 * np.sin(dlon / 2) ** 2)
            return 2 * R * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
        except Exception:
            return np.array([9999.0])

    @staticmethod
    def _safe_float(v: Any) -> Optional[float]:
        """Coerce a value to float, returning None on failure / NaN."""
        try:
            f = float(v)
            if f != f:  # NaN check
                return None
            return f
        except (TypeError, ValueError, OverflowError):
            return None

    def generate_heatmap_data(self, points: List[Dict], region_center: Dict, radius_km: float = 5.0) -> List[Dict]:
        if not SKLEARN_OK:
            return []
        if not points:
            return []

        center_lat = region_center.get('lat', 10.9567)
        center_lng = region_center.get('lng', 107.1825)
        grid_size = 0.005
        heatmap_data = []

        try:
            for lat_offset in np.arange(-radius_km/111, radius_km/111, grid_size):
                for lng_offset in np.arange(-radius_km/111, radius_km/111, grid_size):
                    grid_lat = center_lat + lat_offset
                    grid_lng = center_lng + lng_offset
                    density = 0
                    for point in points:
                        dist = self._haversine_distance(grid_lat, grid_lng, point['lat'], point['lng'])
                        if dist < 1.0:
                            density += 1.0 / (1.0 + dist)
                    if density > 0:
                        heatmap_data.append({
                            "lat": float(grid_lat),
                            "lng": float(grid_lng),
                            "weight": float(density)
                        })
        except Exception as e:
            print(f"Error generating heatmap: {e}")
        return heatmap_data

    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        try:
            R = 6371
            lat1_rad = radians(lat1)
            lat2_rad = radians(lat2)
            dlat = radians(lat2 - lat1)
            dlon = radians(lon2 - lon1)
            a = sin(dlat/2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            return R * c
        except:
            return 9999.0

clustering_service = ClusteringService() if SKLEARN_OK else ClusteringService()