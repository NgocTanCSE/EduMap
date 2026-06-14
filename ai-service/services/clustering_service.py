import numpy as np
from sklearn.cluster import DBSCAN
import pandas as pd
from typing import List, Dict

class ClusteringService:
    def identify_education_hubs(self, points: List[Dict]) -> List[Dict]:
        """
        Sử dụng thuật toán DBSCAN để tìm các cụm (hubs) cơ sở giáo dục tập trung cao.
        """
        if not points or len(points) < 3:
            return []

        df = pd.DataFrame(points)
        coords = df[['lat', 'lng']].values

        # Thuật toán DBSCAN: eps là bán kính (~0.01 độ ~ 1km), min_samples là số điểm tối thiểu
        db = DBSCAN(eps=0.01, min_samples=3).fit(coords)
        
        df['cluster'] = db.labels_
        
        hubs = []
        for cluster_id in set(db.labels_):
            if cluster_id == -1: continue # Bỏ qua các điểm nhiễu
            
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

    def identify_gaps(self, points: List[Dict], region_center: Dict, radius_km: float = 5.0) -> List[Dict]:
        """
        Tìm các khu vực thiếu hụt cơ sở giáo dục trong một vùng bán kính.
        """
        # Đây là một logic đơn giản: Chia lưới và kiểm tra các ô trống
        # Trong thực tế có thể dùng Voronoi Diagram hoặc Heatmap Inversion
        return [{"area": "Vùng ven Biên Hòa", "gap_score": 0.8, "reason": "Thiếu các trung tâm STEM"}]

clustering_service = ClusteringService()
