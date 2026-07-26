import os
try:
    import numpy as np
    from sklearn.cluster import DBSCAN
    from scipy.spatial import Voronoi
    import pandas as pd
    from typing import List, Dict, Optional
    from math import radians, sin, cos, sqrt, atan2
    SKLEARN_OK = True
except ImportError as e:
    SKLEARN_OK = False
    print(f"clustering_service: sklearn/scipy not available: {e}")

class ClusteringService:
    def identify_education_hubs(self, points: List[Dict]) -> List[Dict]:
        if not SKLEARN_OK:
            return []
        if not points or len(points) < 3:
            return []

        try:
            df = pd.DataFrame(points)
            coords = df[['lat', 'lng']].values
            db = DBSCAN(eps=0.01, min_samples=3).fit(coords)
            df['cluster'] = db.labels_

            hubs = []
            for cluster_id in set(db.labels_):
                if cluster_id == -1: continue
                cluster_points = df[df['cluster'] == cluster_id]
                center_lat = cluster_points['lat'].mean()
                center_lng = cluster_points['lng'].mean()
                hubs.append({
                    "hub_id": int(cluster_id),
                    "center": {"lat": float(center_lat), "lng": float(center_lng)},
                    "point_count": len(cluster_points),
                    "categories": cluster_points['category'].unique().tolist()
                })
            return sorted(hubs, key=lambda x: x['point_count'], reverse=True)
        except Exception as e:
            print(f"Error identifying hubs: {e}")
            return []

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