"""Resource Optimizer service — MCLP (Maximum Coverage Location Problem).

Idea #1: AI Education Resource Optimizer (MCLP)
  Given a budget and a set of learner / POI demand points plus candidate
  facility sites, decide where to place Wi-Fi, computers, bookcases (library)
  and study-space facilities so the maximum number of learners is covered.

Solver: ``scipy.optimize.milp`` (Mixed-Integer Linear Programming).
  - Demand point *i* is "covered" when at least one selected facility *j* is
    within ``coverage_radius_km`` of it.
  - Facility *j* has a cost; the total cost of selected facilities must not
    exceed the (sub-)budget for that plan.
  - Objective: maximise the *weighted* number of covered demand points, where
    the weight is the learner population at each demand point.

Budget plans A / B / C:
  The frontend exposes a single budget slider.  We derive three plans from it:
    A  → 40 % of budget   (conservative / pilot)
    B  → 70 % of budget   (balanced)
    C  → 100 % of budget  (full deployment)
  This gives planners an at-a-glance A/B/C comparison on the same map.

Robustness (per AGENTS.md):
  * Candidate pre-filtering to <= 200 points (cap on scipy problem size for a
    1-vCPU HF Spaces container).
  * Demand-point cap to 500 (keeps the coverage matrix small).
  * Greedy fallback when milp is unavailable / fails / times out.
"""

import os
import math
import time
from typing import List, Dict, Optional, Any, Tuple

try:
    import numpy as np
    from scipy.optimize import milp, LinearConstraint, Bounds
    from scipy.sparse import lil_matrix, csr_matrix
    SCIPY_OK = True
except ImportError:  # pragma: no cover - scipy is in requirements.txt
    SCIPY_OK = False
    np = None
    milp = None
    LinearConstraint = None
    Bounds = None
    lil_matrix = None
    csr_matrix = None

import pandas as pd

# ── Defaults (Biên Hòa region, matching the rest of EduMap) ──────────────────
DEFAULT_CENTER = {"lat": 10.9567, "lng": 107.1825}

# Facility type catalog: cost (VND) + per-type coverage radius (km).
# These are sensible defaults for a Vietnamese secondary-city context; clients
# may override per call.
DEFAULT_FACILITY_TYPES: Dict[str, Dict[str, float]] = {
    "wifi":       {"cost": 1_500_000, "radius_km": 0.6, "label": "Wi-Fi công cộng"},
    "computer":   {"cost": 8_000_000, "radius_km": 0.3, "label": "Phòng máy tính"},
    "library":    {"cost": 15_000_000, "radius_km": 0.8, "label": "Tủ sách / Thư viện"},
    "study_space":{"cost": 5_000_000, "radius_km": 0.5, "label": "Không gian học tập"},
}

MAX_CANDIDATES = 200   # hard cap from the risk note in AGENTS.md
MAX_DEMAND_POINTS = 500  # keep coverage matrix small on 1-vCPU

# Budget split ratios for the three plans A / B / C
PLAN_RATIOS = {"A": 0.40, "B": 0.70, "C": 1.00}
PLAN_LABELS = {"A": "Cơ sở dữ liệu (40% ngân sách)", "B": "Cân bằng (70% ngân sách)", "C": "Toàn diện (100% ngân sách)"}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two lat/lng pairs."""
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _empty_feature_collection() -> Dict:
    return {"type": "FeatureCollection", "features": []}


class ResourceOptimizer:
    """MCLP solver for educational resource placement.

    Thread-safe: stateless methods, no shared mutable state beyond constants.
    """

    def _point_weight(self, dp: Dict) -> float:
        """Learner weight of a demand point (population served)."""
        w = dp.get("weight", dp.get("population", dp.get("demand", 1)))
        try:
            w = float(w)
        except (TypeError, ValueError):
            w = 1.0
        return max(w, 1.0)

    def _facility_cost(self, cand: Dict, facility_types: Dict[str, Dict]) -> float:
        """Cost of a candidate facility, falling back to a default type."""
        ftype = str(cand.get("facility_type", cand.get("type", "wifi"))).lower()
        ftype = ftype if ftype in facility_types else "wifi"
        return float(facility_types[ftype]["cost"])

    def _facility_radius(self, cand: Dict, facility_types: Dict[str, Dict]) -> float:
        ftype = str(cand.get("facility_type", cand.get("type", "wifi"))).lower()
        ftype = ftype if ftype in facility_types else "wifi"
        return float(facility_types[ftype]["radius_km"])

    def _build_grid_candidates(self, center: Dict, radius_km: float,
                                grid_step_km: float = 1.5) -> List[Dict]:
        """Generate a regular grid of candidate facility sites around *center*.

        Used when the caller does not supply explicit candidate locations.
        """
        lat0 = float(center.get("lat", DEFAULT_CENTER["lat"]))
        lng0 = float(center.get("lng", DEFAULT_CENTER["lng"]))
        n = max(1, int(math.ceil(radius_km / grid_step_km)))
        step_lat = grid_step_km / 111.0
        step_lng = grid_step_km / (111.0 * math.cos(math.radians(lat0)))
        candidates = []
        for i in range(-n, n + 1):
            for j in range(-n, n + 1):
                lat = lat0 + i * step_lat
                lng = lng0 + j * step_lng
                if _haversine_km(lat0, lng0, lat, lng) <= radius_km:
                    candidates.append({
                        "lat": round(lat, 6),
                        "lng": round(lng, 6),
                        "facility_type": "wifi",
                        "name": f"Grid site ({i},{j})",
                    })
        return candidates

    def _pre_filter_candidates(self, candidates: List[Dict], demand_points: List[Dict],
                                radius_km: float, facility_types: Dict[str, Dict]) -> List[Dict]:
        """Reduce candidate set to <= MAX_CANDIDATES by coverage count.

        For each candidate, count how many demand points it would cover if
        selected (using its own facility-type radius).  Sort descending and
        keep the top ``MAX_CANDIDATES`` — these are the most influential sites.
        """
        if len(candidates) <= MAX_CANDIDATES:
            return candidates

        scored = []
        for c in candidates:
            r = self._facility_radius(c, facility_types)
            cnt = 0
            for d in demand_points:
                if _haversine_km(float(d["lat"]), float(d["lng"]),
                                  float(c["lat"]), float(c["lng"])) <= r:
                    cnt += 1
            scored.append((cnt, c))
        scored.sort(key=lambda t: t[0], reverse=True)
        return [c for _, c in scored[:MAX_CANDIDATES]]

    def _build_coverage_matrix(self, demand_points: List[Dict],
                                candidates: List[Dict],
                                facility_types: Dict[str, Dict]) -> "np.ndarray":
        """Boolean coverage matrix ``a[i][j] = 1`` if facility j covers demand i."""
        m = len(demand_points)
        n = len(candidates)
        # Per-facility radius may differ, so compute per (i,j) pair.
        mat = np.zeros((m, n), dtype=float)
        for i, d in enumerate(demand_points):
            dlat, dlng = float(d["lat"]), float(d["lng"])
            for j, c in enumerate(candidates):
                r = self._facility_radius(c, facility_types)
                if _haversine_km(dlat, dlng, float(c["lat"]), float(c["lng"])) <= r:
                    mat[i, j] = 1.0
        return mat

    def _solve_milp(self, weights: "np.ndarray", costs: "np.ndarray",
                    coverage: "np.ndarray", budget: float) -> Optional[List[int]]:
        """Solve the MCLP with ``scipy.optimize.milp``.

        Returns the list of selected facility indices, or ``None`` on failure.
        """
        if not SCIPY_OK or milp is None:
            return None

        n = len(costs)           # facility variables
        m = len(weights)         # demand-coverage variables
        n_vars = n + m

        # Objective: minimise  -Σ w_i y_i  (= maximise weighted coverage)
        c = np.concatenate([np.zeros(n), -weights]).astype(float)

        # All variables binary
        integrality = np.ones(n_vars)
        bounds = Bounds(lb=0.0, ub=1.0)

        # ── Constraint matrix (sparse, 1 (budget) + m (coverage)) ──
        # Variable order: [x_0..x_{n-1}, y_0..y_{m-1}]
        A = lil_matrix((1 + m, n_vars), dtype=float)
        ub = np.full(1 + m, np.inf)
        lb = np.full(1 + m, -np.inf)

        # 1) Budget: Σ c_j x_j ≤ budget  →  ub[0] = budget
        A[0, :n] = costs
        ub[0] = budget

        # 2) Coverage: y_i ≤ Σ a_{ij} x_j   →   Σ a_{ij} x_j − y_i ≥ 0
        #    In ≤ form :  −Σ a_{ij} x_j + y_i ≤ 0
        #    A row offset by 1+i, column  : -a[i,j] for j in [0,n), +1 at col n+i
        #    (only set non-zero entries for efficiency)
        rows, cols = np.where(coverage > 0)
        for i, j in zip(rows, cols):
            A[1 + i, j] = -1.0          # −a_{ij}
        for i in range(m):
            A[1 + i, n + i] = 1.0       # +1 · y_i
        ub[1:] = 0.0

        try:
            res = milp(c=c.astype(float),
                       constraints=LinearConstraint(A.tocsr(), lb=lb, ub=ub),
                       integrality=integrality,
                       bounds=bounds)
            if res.success and res.x is not None:
                x = res.x[:n]
                selected = [j for j in range(n) if x[j] >= 0.5]
                if selected or n == 0:
                    return selected
            return None
        except Exception as e:
            print(f"[MCLP] milp.solve failed: {e}")
            return None

    def _solve_greedy(self, weights: "np.ndarray", costs: "np.ndarray",
                      coverage: "np.ndarray", budget: float) -> List[int]:
        """Greedy set-cover fallback (O(n·m)) when milp is unavailable/fails.

        Repeatedly picks the facility with the best (coverage_gain / cost)
        ratio until the budget is exhausted.
        """
        n = len(costs)
        m = len(weights)
        covered = np.zeros(m, dtype=bool)
        selected: List[int] = []
        remaining_budget = budget

        col_sums = coverage.sum(axis=0)  # demand count per facility (for ordering)
        order = np.argsort(-col_sums)    # most-covering first

        for j in order:
            if costs[j] > remaining_budget:
                continue
            # marginal gain: demand points newly covered by facility j
            new_cov = coverage[:, j].astype(bool) & ~covered
            gain = float(np.dot(weights, new_cov))
            if gain <= 0:
                continue
            selected.append(int(j))
            covered |= coverage[:, j] > 0
            remaining_budget -= costs[j]
            if covered.all() or remaining_budget <= 0:
                break

        return selected

    def _solve_plan(self, demand_points: List[Dict], candidates: List[Dict],
                    budget: float, facility_types: Dict[str, Dict]) -> Dict[str, Any]:
        """Solve MCLP for a single budget level.  Returns a result dict."""
        weights = np.array([self._point_weight(d) for d in demand_points], dtype=float)
        costs = np.array([self._facility_cost(c, facility_types) for c in candidates], dtype=float)
        coverage = self._build_coverage_matrix(demand_points, candidates, facility_types)

        # Effective budget: can't select more facilities than we have, and
        # can't exceed total cost of all candidates.
        eff_budget = min(budget, float(costs.sum()) if len(costs) else 0)

        selected_idx = self._solve_milp(weights, costs, coverage, eff_budget)

        solver_used = "scipy.milp"
        if selected_idx is None:
            selected_idx = self._solve_greedy(weights, costs, coverage, eff_budget)
            solver_used = "greedy_fallback"

        # Compute coverage results
        served_mask = np.zeros(len(demand_points), dtype=bool)
        per_facility_served: Dict[int, int] = {}
        for j in selected_idx:
            cov = coverage[:, j] > 0
            per_facility_served[j] = int(cov.sum())
            served_mask |= cov

        total_weighted = float(weights.sum())
        served_weight = float(weights[served_mask].sum())
        coverage_pct = round(served_weight / total_weighted * 100, 1) if total_weighted > 0 else 0.0
        total_cost = float(costs[selected_idx].sum()) if selected_idx else 0.0
        budget_used_pct = round(total_cost / budget * 100, 1) if budget > 0 else 0.0

        # Demand points NOT served by this plan (gap points)
        gap_indices = [i for i in range(len(demand_points)) if not served_mask[i]]

        return {
            "selected_indices": selected_idx,
            "total_cost": round(total_cost, 2),
            "total_served": int(served_mask.sum()),
            "total_demand": len(demand_points),
            "total_weighted": round(total_weighted, 2),
            "served_weighted": round(served_weight, 2),
            "coverage_pct": coverage_pct,
            "budget_used_pct": budget_used_pct,
            "budget": round(budget, 2),
            "gap_indices": gap_indices,
            "per_facility_served": per_facility_served,
            "solver": solver_used,
        }

    def _to_facility_feature(self, cand: Dict, plan: str, served: int) -> Dict:
        """Build a GeoJSON Feature for a selected facility."""
        ftype = str(cand.get("facility_type", cand.get("type", "wifi"))).lower()
        return {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(cand["lng"]), float(cand["lat"])]},
            "properties": {
                "plan": plan,
                "facility_type": ftype,
                "name": cand.get("name", f"{ftype} site"),
                "demand_served": int(served),
                "address": cand.get("address", ""),
                "description": cand.get("description", ""),
            },
        }

    def _to_gap_feature(self, dp: Dict) -> Dict:
        """Build a GeoJSON Feature for an uncovered demand / gap point."""
        return {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(dp["lng"]), float(dp["lat"])]},
            "properties": {
                "type": "gap",
                "name": dp.get("name", "Vùng chưa được phục vụ"),
                "demand": int(dp.get("weight", dp.get("population", dp.get("demand", 1)))),
                "address": dp.get("address", ""),
            },
        }

    def optimize(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Run the full A/B/C MCLP optimisation.

        Parameters (all optional with sensible defaults):
          budget              — total budget in VND (default 30_000_000)
          coverage_radius_km  — override for all facility radii (default: per-type)
          facility_types      — dict of {type: {cost, radius_km, label}}
          demand_points       — list of {lat,lng,weight?} (learners' locations)
          candidate_locations — list of {lat,lng,facility_type?,name?}
          center              — {lat,lng} for grid generation (default: Biên Hòa)
          region_radius_km    — radius for grid generation (default 10 km)

        Returns:
          A GeoJSON-like dict:
            {
              "type": "FeatureCollection",
              "features": [facility features tagged plan A/B/C ...],
              "plans": {A:{...}, B:{...}, C:{...}},
              "gaps": { "type":"FeatureCollection", "features":[...] },
              "summary": {...}
            }
        """
        t0 = time.monotonic()

        # ── Resolve inputs ──────────────────────────────────────────────
        budget = float(data.get("budget", 30_000_000))

        # Facility type catalog
        facility_types = dict(DEFAULT_FACILITY_TYPES)
        ft_override = data.get("facility_types")
        if isinstance(ft_override, dict):
            for k, v in ft_override.items():
                if isinstance(v, dict):
                    facility_types[k.lower()] = {
                        "cost": float(v.get("cost", DEFAULT_FACILITY_TYPES.get(k.lower(), {}).get("cost", 1_500_000))),
                        "radius_km": float(v.get("radius_km", DEFAULT_FACILITY_TYPES.get(k.lower(), {}).get("radius_km", 0.6))),
                        "label": v.get("label", DEFAULT_FACILITY_TYPES.get(k.lower(), {}).get("label", k)),
                    }

        # If a global coverage_radius_km is given, override all facility radii
        global_radius = data.get("coverage_radius_km")

        center = data.get("center") or DEFAULT_CENTER
        region_radius = float(data.get("region_radius_km", 10.0))

        # Demand points
        raw_demand = data.get("demand_points") or []
        if not raw_demand:
            # Default: use existing POIs from the DB (or grid demand points)
            raw_demand = self._default_demand_points(center, region_radius)

        demand_points = []
        for d in raw_demand:
            try:
                lat = float(d.get("lat", d.get("latitude", 0)))
                lng = float(d.get("lng", d.get("longitude", 0)))
                if lat == 0 or lng == 0:
                    continue
                demand_points.append({"lat": lat, "lng": lng, "name": d.get("name", ""),
                                     "weight": self._point_weight(d),
                                     "address": d.get("address", "")})
            except (TypeError, ValueError):
                continue
        # Cap demand points
        if len(demand_points) > MAX_DEMAND_POINTS:
            # Keep the highest-weight demand points
            demand_points.sort(key=lambda d: d["weight"], reverse=True)
            demand_points = demand_points[:MAX_DEMAND_POINTS]

        # Candidate locations
        raw_cands = data.get("candidate_locations") or []
        if not raw_cands:
            raw_cands = self._build_grid_candidates(center, region_radius, grid_step_km=1.5)

        candidates = []
        for c in raw_cands:
            try:
                lat = float(c.get("lat", c.get("latitude", 0)))
                lng = float(c.get("lng", c.get("longitude", 0)))
                if lat == 0 or lng == 0:
                    continue
                ftype = str(c.get("facility_type", c.get("type", "wifi"))).lower()
                ftype = ftype if ftype in facility_types else "wifi"
                cand = {"lat": lat, "lng": lng, "facility_type": ftype,
                        "name": c.get("name", f"{ftype} site"),
                        "cost": self._facility_cost(c, facility_types),
                        "radius_km": float(global_radius) if global_radius else facility_types[ftype]["radius_km"],
                        "address": c.get("address", ""),
                        "description": c.get("description", "")}
                if global_radius:
                    cand["radius_km"] = float(global_radius)
                candidates.append(cand)
            except (TypeError, ValueError):
                continue

        # Pre-filter to <= 200 candidates
        pre_filtered = False
        if len(candidates) > MAX_CANDIDATES:
            candidates = self._pre_filter_candidates(candidates, demand_points,
                                                      float(global_radius) if global_radius else 0.6,
                                                      facility_types)
            pre_filtered = True

        n_cands = len(candidates)
        n_demand = len(demand_points)

        if n_cands == 0 or n_demand == 0:
            return {
                "type": "FeatureCollection",
                "features": [],
                "plans": {p: {"selected": 0, "total_cost": 0, "total_served": 0,
                              "total_demand": n_demand, "coverage_pct": 0.0,
                              "budget_used_pct": 0.0, "budget": round(budget * r, 2),
                              "solver": solver_used_fallback()} for p, r in PLAN_RATIOS.items()},
                "gaps": _empty_feature_collection(),
                "summary": {
                    "budget": round(budget, 2),
                    "facility_types": list(facility_types.keys()),
                    "candidate_count": n_cands,
                    "demand_count": n_demand,
                    "pre_filtered": pre_filtered,
                    "elapsed_ms": int((time.monotonic() - t0) * 1000),
                    "error": "No demand points or candidate locations provided.",
                },
            }

        # ── Solve A / B / C plans ───────────────────────────────────────
        plan_results: Dict[str, Dict] = {}
        all_features: List[Dict] = []
        for plan_name, ratio in PLAN_RATIOS.items():
            plan_budget = budget * ratio
            result = self._solve_plan(demand_points, candidates, plan_budget, facility_types)
            plan_results[plan_name] = {
                "selected": len(result["selected_indices"]),
                "total_cost": result["total_cost"],
                "total_served": result["total_served"],
                "total_demand": result["total_demand"],
                "served_weighted": result["served_weighted"],
                "total_weighted": result["total_weighted"],
                "coverage_pct": result["coverage_pct"],
                "budget_used_pct": result["budget_used_pct"],
                "budget": round(plan_budget, 2),
                "solver": result["solver"],
            }
            # Build facility features for this plan
            for j in result["selected_indices"]:
                served = result["per_facility_served"].get(j, 0)
                feat = self._to_facility_feature(candidates[j], plan_name, served)
                feat["properties"]["cost"] = round(candidates[j]["cost"], 2)
                feat["properties"]["radius_km"] = candidates[j]["radius_km"]
                all_features.append(feat)

        # ── Gap analysis (based on the best plan C) ──────────────────────
        best_plan = plan_results["C"]
        best_result = self._solve_plan(demand_points, candidates, budget * PLAN_RATIOS["C"], facility_types)
        gap_features = [self._to_gap_feature(demand_points[i]) for i in best_result["gap_indices"]]

        gap_fc: Dict = _empty_feature_collection()
        if gap_features:
            gap_fc = {"type": "FeatureCollection", "features": gap_features}

        summary = {
            "budget": round(budget, 2),
            "facility_types": list(facility_types.keys()),
            "candidate_count": n_cands,
            "demand_count": n_demand,
            "pre_filtered": pre_filtered,
            "elapsed_ms": int((time.monotonic() - t0) * 1000),
            "best_plan": "C",
        }

        return {
            "type": "FeatureCollection",
            "features": all_features,
            "plans": plan_results,
            "gaps": gap_fc,
            "summary": summary,
        }

    def _default_demand_points(self, center: Dict, radius_km: float) -> List[Dict]:
        """Generate synthetic demand points around a centre when no real data
        is provided (used by smoke tests / local dev)."""
        lat0 = float(center.get("lat", DEFAULT_CENTER["lat"]))
        lng0 = float(center.get("lng", DEFAULT_CENTER["lng"]))
        points = []
        # 24 evenly-spaced demand points in a circle
        for k in range(24):
            angle = 2 * math.pi * k / 24
            r = radius_km * (0.3 + 0.7 * (k / 24))
            dlat = (r * math.cos(angle)) / 111.0
            dlng = (r * math.sin(angle)) / (111.0 * math.cos(math.radians(lat0)))
            points.append({
                "lat": round(lat0 + dlat, 6),
                "lng": round(lng0 + dlng, 6),
                "name": f"Điểm nhu cầu {k+1}",
                "weight": max(10, 50 - k * 2),
            })
        return points


def solver_used_fallback() -> str:
    """Used in the empty/error result to indicate no solver ran."""
    return "none"


# Singleton (mirrors the pattern used by clustering_service, vector_store, etc.)
resource_optimizer = ResourceOptimizer()
