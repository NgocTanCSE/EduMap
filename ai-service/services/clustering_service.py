import os
try:
    import numpy as np
    from sklearn.cluster import DBSCAN
    from scipy.spatial import Voronoi, ConvexHull
    import pandas as pd
    from typing import List, Dict, Optional
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