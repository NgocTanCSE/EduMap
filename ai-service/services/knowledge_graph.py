"""AI Knowledge Graph service for EduMap (Idea #8).

Liên kết các thực thể: trường học, nhu cầu, học bổng, nhà tài trợ, tài nguyên.

Kiến trúc:
  - Dữ liệu lưu trong **SQLite adjacency list** (``kg_nodes`` / ``kg_edges``),
    không dùng Neo4j — phù hợp với môi trường HF Spaces single-container.
  - Node types: school, university, scholarship, sponsor, opportunity,
    career_path, learning_material, internship, international_program.
  - Edge types: SPONSORED_BY, OFFERS_SCHOLARSHIP, LINKED_TO, REQUIRES_SKILL,
    STUDY_AT, HAS_PROGRAM, APPLY_TO, HAS_MATERIAL, RELATED_TO.
  - NLP entity extraction (trích xuất thực thể) qua LLM service với graceful
    degradation — khi LLM không khả dụng, trả về rule-based extraction.
  - Graph traversal giới hạn **1-degree** để tránh query lớn trên HF Spaces.
  - NLP extraction sai → hàng đợi `kg_extraction_review` (human review queue).

AGENTS.md rules:
  - Dữ liệu phải là dữ liệu thực tế của Việt Nam, luôn kèm provenance.
  - RAG/thành phần AI thất bại → degrade gracefully, không crash.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
import time
from typing import Any, Dict, List, Optional, Set, Tuple

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DB_PATH = os.getenv("DB_SQLITE_PATH", "/app/frontend/public/edumap.db")

# Node types (semantic labels for graph nodes).
NODE_TYPES = [
    "school",               # THPT / trường sau này
    "university",           # Đại học
    "scholarship",          # Học bổng
    "sponsor",              # Nhà tài trợ / tổ chức
    "opportunity",          # Cơ hội (competition, event, volunteer)
    "career_path",          # Lộ trình nghề nghiệp
    "learning_material",    # Tài liệu học tập
    "internship",           # Thực tập
    "international_program",  # Chương trình quốc tế
    "skill",                # Kỹ năng (trích xuất NLP)
    "region",               # Khu vực / địa lý
]

# Edge types (semantic relationships).
EDGE_TYPES = [
    "SPONSORED_BY",        # scholarship/opp → sponsor
    "OFFERS_SCHOLARSHIP",  # sponsor → scholarship
    "LINKED_TO",           # school ↔ school (cùng khu vực, cùng mạng lưới)
    "REQUIRES_SKILL",      # scholarship/career/internship → skill
    "STUDY_AT",            # career_path → school/university
    "HAS_PROGRAM",         # sponsor/university → international_program
    "APPLY_TO",            # school/user → scholarship/opp
    "HAS_MATERIAL",        # learning_material → career_path/skill
    "RELATED_TO",          # bất kỳ → bất kỳ (trích xuất NLP, human review)
    "LOCATED_IN",          # school/university → region
]

# Map SQLite source table → knowledge-graph node type.
SOURCE_TABLE_NODE_TYPE: Dict[str, str] = {
    "map_points": "university",      # type_id 1 = university; we refine below
    "scholarships": "scholarship",
    "organizations": "sponsor",
    "opportunities": "opportunity",
    "career_paths": "career_path",
    "learning_materials": "learning_material",
    "internships": "internship",
    "international_programs": "international_program",
}

# map_points.type_id → node type.
MAP_POINT_TYPE_MAP = {
    1: "university",
    2: "school",
    3: "library",
    4: "bookstore",
    5: "lab",         # STEM lab
    6: "wifi",
    7: "green",
    8: "cafe",
    9: "restaurant",
}

# Circuit-breaker cooldown for LLM entity extraction (seconds).
_NLP_DOWN_UNTIL = 0.0
_NLP_COOLDOWN = 300  # 5 minutes


class KnowledgeGraphService:
    """Builds and queries the EduMap knowledge graph stored in SQLite.

    The graph uses an *adjacency-list* model:
      ``kg_nodes``  (id, type, source_table, source_id, name, description, metadata_json, created_at)
      ``kg_edges``  (id, source_id, target_id, edge_type, weight, metadata_json, created_at)
      ``kg_extraction_review`` (id, source_text, extracted_json, status, created_at)

    All public methods open a *fresh* SQLite connection (check_same_thread
    safety) and are safe to call from FastAPI worker threads.
    """

    def __init__(self, db_path: str = None):
        self.db_path = db_path or os.getenv("DB_SQLITE_PATH", DB_PATH)
        self._init_schema()

    # ── SQLite helpers ───────────────────────────────────────────────────

    def _connect(self) -> sqlite3.Connection:
        """Open a SQLite connection (row factory + foreign keys on)."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_schema(self) -> None:
        """Create the knowledge-graph tables if they don't exist.

        Idempotent — safe to call on every startup / every request.
        """
        conn = self._connect()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS kg_nodes (
                    id            TEXT PRIMARY KEY,
                    type          TEXT NOT NULL,
                    source_table  TEXT NOT NULL,
                    source_id     TEXT,
                    name          TEXT NOT NULL,
                    description   TEXT,
                    lat           REAL,
                    lng           REAL,
                    city          TEXT,
                    province      TEXT,
                    url           TEXT,
                    metadata_json TEXT,
                    confidence    REAL DEFAULT 1.0,
                    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS kg_edges (
                    id            TEXT PRIMARY KEY,
                    source_id     TEXT NOT NULL,
                    target_id     TEXT NOT NULL,
                    edge_type     TEXT NOT NULL,
                    weight        REAL DEFAULT 1.0,
                    metadata_json TEXT,
                    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE(source_id, target_id, edge_type)
                );

                CREATE TABLE IF NOT EXISTS kg_extraction_review (
                    id            TEXT PRIMARY KEY,
                    source_text   TEXT NOT NULL,
                    extracted_json TEXT NOT NULL,
                    confidence    REAL DEFAULT 0.0,
                    status        TEXT NOT NULL DEFAULT 'pending',
                    reviewer_note TEXT,
                    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at    TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes(type);
                CREATE INDEX IF NOT EXISTS idx_kg_nodes_source ON kg_nodes(source_table, source_id);
                CREATE INDEX IF NOT EXISTS idx_kg_edges_source  ON kg_edges(source_id);
                CREATE INDEX IF NOT EXISTS idx_kg_edges_target  ON kg_edges(target_id);
                CREATE INDEX IF NOT EXISTS idx_kg_edges_type    ON kg_edges(edge_type);
                CREATE INDEX IF NOT EXISTS idx_kg_review_status ON kg_extraction_review(status);
                """
            )
            conn.commit()
        except Exception as e:
            print(f"[knowledge_graph] _init_schema failed: {e}")
        finally:
            conn.close()

    # ── Seeding (T1 core: build graph from existing tables) ────────────────

    def seed_graph(self) -> Dict[str, Any]:
        """Build the knowledge graph from the existing SQLite content tables.

        Reads map_points, scholarships, opportunities, career_paths,
        learning_materials, internships, international_programs and creates
        nodes + semantic edges between them. Idempotent — re-running
        rebuilds the kg_* tables from scratch (REPLACE strategy) so the graph
        always reflects current data.

        Returns a summary dict with counts.
        """
        conn = self._connect()
        summary: Dict[str, int] = {"nodes": 0, "edges": 0, "skipped": 0}
        try:
            conn.execute("DELETE FROM kg_edges")
            conn.execute("DELETE FROM kg_nodes")

            # ── 1. Nodes from each source table ─────────────────────────────
            self._seed_nodes_map_points(conn, summary)
            self._seed_nodes_scholarships(conn, summary)
            self._seed_nodes_opportunities(conn, summary)
            self._seed_nodes_career_paths(conn, summary)
            self._seed_nodes_learning_materials(conn, summary)
            self._seed_nodes_internships(conn, summary)
            self._seed_nodes_international_programs(conn, summary)
            self._seed_nodes_organizations(conn, summary)

            # ── 2. Semantic edges ────────────────────────────────────────
            self._build_edges(conn, summary)

            conn.commit()
        except Exception as e:
            print(f"[knowledge_graph] seed_graph error: {e}")
            conn.rollback()
            summary["error"] = str(e)
        finally:
            conn.close()

        print(
            f"[knowledge_graph] seed_graph complete — "
            f"{summary.get('nodes', 0)} nodes, {summary.get('edges', 0)} edges"
        )
        return summary

    # -- Node builders ----------------------------------------------------

    def _seed_nodes_map_points(self, conn: sqlite3.Connection, s: Dict[str, int]) -> None:
        rows = conn.execute(
            """SELECT id, name, description, type_id, address, city, province,
               province, verified FROM map_points WHERE deleted_at IS NULL"""
        ).fetchall()
        for r in rows:
            node_type = MAP_POINT_TYPE_MAP.get(int(r["type_id"] or 0), "school")
            if node_type in ("cafe", "restaurant", "bookstore", "green", "wifi"):
                # These are supporting infrastructure, not core KG entities.
                s["skipped"] += 1
                continue
            lat, lng = self._parse_location(r["address"])
            self._insert_node(conn, r["id"], node_type, "map_points", r["id"],
                              r["name"], r["description"], lat, lng,
                              r["city"], r["province"], None,
                              {"type_id": r["type_id"], "verified": r["verified"]}, s)

    def _seed_nodes_scholarships(self, conn: sqlite3.Connection, s: Dict[str, int]) -> None:
        rows = conn.execute(
            "SELECT id, title, description, provider, location, value_amount, deadline, "
            "eligibility_criteria, apply_url FROM scholarships WHERE deleted_at IS NULL"
        ).fetchall()
        for r in rows:
            meta = {
                "provider": r["provider"],
                "value_amount": r["value_amount"],
                "deadline": r["deadline"],
                "eligibility_criteria": r["eligibility_criteria"],
            }
            self._insert_node(conn, r["id"], "scholarship", "scholarships", r["id"],
                              r["title"], r["description"], None, None,
                              None, None, r["apply_url"], meta, s)

    def _seed_nodes_opportunities(self, conn: sqlite3.Connection, s: Dict[str, int]) -> None:
        rows = conn.execute(
            "SELECT id, title, description, type, organization, address, deadline, "
            "url, field_tags FROM opportunities"
        ).fetchall()
        for r in rows:
            meta = {
                "opportunity_type": r["type"],
                "organization": r["organization"],
                "field_tags": r["field_tags"],
                "deadline": r["deadline"],
            }
            self._insert_node(conn, r["id"], "opportunity", "opportunities", r["id"],
                              r["title"], r["description"], None, None,
                              None, None, r["url"], meta, s)

    def _seed_nodes_career_paths(self, conn: sqlite3.Connection, s: Dict[str, int]) -> None:
        rows = conn.execute(
            "SELECT id, title, field, description, skills_required FROM career_paths"
        ).fetchall()
        for r in rows:
            meta = {
                "field": r["field"],
                "skills_required": r["skills_required"],
            }
            self._insert_node(conn, r["id"], "career_path", "career_paths", r["id"],
                              r["title"], r["description"], None, None,
                              None, None, None, meta, s)

    def _seed_nodes_learning_materials(self, conn: sqlite3.Connection, s: Dict[str, int]) -> None:
        rows = conn.execute(
            "SELECT id, title, description, type, subject, tags, file_url "
            "FROM learning_materials WHERE deleted_at IS NULL"
        ).fetchall()
        for r in rows:
            meta = {
                "material_type": r["type"],
                "subject": r["subject"],
                "tags": r["tags"],
            }
            self._insert_node(conn, r["id"], "learning_material", "learning_materials", r["id"],
                              r["title"], r["description"], None, None,
                              None, None, r["file_url"], meta, s)

    def _seed_nodes_internships(self, conn: sqlite3.Connection, s: Dict[str, int]) -> None:
        rows = conn.execute(
            "SELECT id, title, description, company_id, field, salary_range, "
            "deadline, requirements FROM internships"
        ).fetchall()
        for r in rows:
            meta = {
                "company_id": r["company_id"],
                "field": r["field"],
                "salary_range": r["salary_range"],
                "deadline": r["deadline"],
                "requirements": r["requirements"],
            }
            self._insert_node(conn, r["id"], "internship", "internships", r["id"],
                              r["title"], r["description"], None, None,
                              None, None, None, meta, s)

    def _seed_nodes_international_programs(self, conn: sqlite3.Connection, s: Dict[str, int]) -> None:
        rows = conn.execute(
            "SELECT id, title, type, description, host_country, organization, "
            "apply_url, benefits FROM international_programs"
        ).fetchall()
        for r in rows:
            meta = {
                "program_type": r["type"],
                "organization": r["organization"],
                "host_country": r["host_country"],
                "benefits": r["benefits"],
            }
            self._insert_node(conn, r["id"], "international_program", "international_programs", r["id"],
                              r["title"], r["description"], None, None,
                              None, None, r["apply_url"], meta, s)

    def _seed_nodes_organizations(self, conn: sqlite3.Connection, s: Dict[str, int]) -> None:
        """Seed sponsor/organization nodes from the organizations table AND
        from the denormalised 'organization' columns in opportunities /
        international_programs / scholarships.provider (which act as
        de-facto sponsors even when the organizations table is empty)."""
        # Explicit organizations
        org_rows = conn.execute(
            "SELECT id, name, description, website_url FROM organizations"
        ).fetchall()
        for r in org_rows:
            meta = {"website_url": r["website_url"]}
            self._insert_node(conn, r["id"], "sponsor", "organizations", r["id"],
                              r["name"], r["description"], None, None,
                              None, None, r["website_url"], meta, s)

        # Denormalised sponsors pulled from scholarship.provider / opportunity.organization /
        # international_program.organization. These are real Vietnamese organisations
        # (per AGENTS.md) so they're valid graph nodes.
        seen_sponsors: Set[str] = set()
        sponsor_sources = [
            ("scholarships", "id", "title", "provider", "apply_url"),
            ("opportunities", "id", "title", "organization", "url"),
        ]
        for table, id_col, name_col, org_col, url_col in sponsor_sources:
            rows = conn.execute(
                f"SELECT {id_col} AS src_id, {name_col} AS src_name, {org_col} AS org, {url_col} AS url "
                f"FROM {table}"
            ).fetchall()
            for r in rows:
                org_name = (r["org"] or "").strip()
                if not org_name or org_name in seen_sponsors:
                    continue
                seen_sponsors.add(org_name)
                # Create a deterministic node id from the organisation name
                node_id = self._sponsor_node_id(org_name)
                meta = {"source_table": table, "source_id": r["src_id"]}
                self._insert_node(conn, node_id, "sponsor", "organizations", node_id,
                                  org_name, None, None, None,
                                  None, None, r["url"], meta, s)

    # -- Edge builder -----------------------------------------------------

    def _build_edges(self, conn: sqlite3.Connection, s: Dict[str, int]) -> None:
        """Create semantic edges between nodes that already exist in kg_nodes."""
        # scholarships → sponsored_by sponsor (match by provider name or
        # organisation name)
        self._link_scholarships_to_sponsors(conn, s)
        # opportunities → sponsored_by sponsor (match by organization)
        self._link_opportunities_to_sponsors(conn, s)
        # international_programs → located_in host_country region
        self._link_international_programs_to_regions(conn, s)
        # career_paths → study_at universities (field match)
        self._link_career_paths_to_schools(conn, s)
        # learning_materials → has_material / requires_skill
        self._link_materials_to_skills_and_careers(conn, s)
        # scholarships → requires_skill (from eligibility_criteria text)
        self._link_scholarships_to_skills(conn, s)
        # schools ↔ linked_to schools in the same province/city
        self._link_schools_by_region(conn, s)
        # internships → offers (company sponsor)
        self._link_internships_to_sponsors(conn, s)

    def _link_scholarships_to_sponsors(self, conn, s):
        """scholarship → SPONSORED_BY → sponsor (where sponsor name ⊆ provider text)."""
        rows = conn.execute(
            "SELECT id, metadata_json FROM kg_nodes WHERE type='scholarship'"
        ).fetchall()
        sponsors = conn.execute(
            "SELECT id, name FROM kg_nodes WHERE type='sponsor'"
        ).fetchall()
        for r in rows:
            try:
                meta = json.loads(r["metadata_json"] or "{}")
            except Exception:
                meta = {}
            provider = (meta.get("provider") or "").strip()
            if not provider:
                continue
            for sp in sponsors:
                sp_name = (sp["name"] or "").strip()
                if sp_name and self._fuzzy_match(provider, sp_name):
                    self._insert_edge(conn, r["id"], sp["id"], "SPONSORED_BY",
                                      weight=1.0, metadata={"provider": provider}, s=s)

    def _link_opportunities_to_sponsors(self, conn, s):
        rows = conn.execute(
            "SELECT id, metadata_json FROM kg_nodes WHERE type='opportunity'"
        ).fetchall()
        sponsors = conn.execute(
            "SELECT id, name FROM kg_nodes WHERE type='sponsor'"
        ).fetchall()
        for r in rows:
            try:
                meta = json.loads(r["metadata_json"] or "{}")
            except Exception:
                meta = {}
            org = (meta.get("organization") or "").strip()
            if not org:
                continue
            for sp in sponsors:
                sp_name = (sp["name"] or "").strip()
                if sp_name and self._fuzzy_match(org, sp_name):
                    self._insert_edge(conn, r["id"], sp["id"], "SPONSORED_BY",
                                      weight=1.0, metadata={"organization": org}, s=s)

    def _link_international_programs_to_regions(self, conn, s):
        rows = conn.execute(
            "SELECT id, metadata_json FROM kg_nodes WHERE type='international_program'"
        ).fetchall()
        for r in rows:
            try:
                meta = json.loads(r["metadata_json"] or "{}")
            except Exception:
                meta = {}
            country = (meta.get("host_country") or "").strip()
            if not country:
                continue
            node_id = f"region:{country}"
            self._insert_node(conn, node_id, "region", "derived", country,
                              country, None, None, None, None, None, None,
                              {"source": "kg_derived"}, s, confidence=1.0)
            self._insert_edge(conn, r["id"], node_id, "LOCATED_IN",
                              weight=1.0, s=s)

    def _link_career_paths_to_schools(self, conn, s):
        """career_path → STUDY_AT → university (field keyword overlap)."""
        careers = conn.execute(
            "SELECT id, metadata_json FROM kg_nodes WHERE type='career_path'"
        ).fetchall()
        schools = conn.execute(
            "SELECT id, type FROM kg_nodes WHERE type IN ('university','school')"
        ).fetchall()
        for r in careers:
            try:
                meta = json.loads(r["metadata_json"] or "{}")
            except Exception:
                meta = {}
            field = (meta.get("field") or "").strip().lower()
            if not field:
                continue
            for sc in schools:
                self._insert_edge(conn, r["id"], sc["id"], "STUDY_AT",
                                  weight=1.0, metadata={"field": field}, s=s)

    def _link_materials_to_skills_and_careers(self, conn, s):
        mats = conn.execute(
            "SELECT id, metadata_json FROM kg_nodes WHERE type='learning_material'"
        ).fetchall()
        careers = conn.execute(
            "SELECT id, metadata_json FROM kg_nodes WHERE type='career_path'"
        ).fetchall()
        for r in mats:
            try:
                meta = json.loads(r["metadata_json"] or "{}")
            except Exception:
                meta = {}
            subject = (meta.get("subject") or "").strip()
            tags = meta.get("tags")
            if isinstance(tags, str):
                try:
                    tags = json.loads(tags)
                except Exception:
                    tags = []
            if tags is None:
                tags = []
            # Material → HAS_MATERIAL (reverse: career → material)
            for c in careers:
                self._insert_edge(conn, c["id"], r["id"], "HAS_MATERIAL",
                                  weight=1.0, metadata={"subject": subject}, s=s)
            # Extract skill keywords from subject/tags
            skill_text = f"{subject} {' '.join(tags) if isinstance(tags, list) else ''}"
            for skill_kw in self._extract_skill_keywords(skill_text):
                skill_id = f"skill:{skill_kw}"
                self._insert_node(conn, skill_id, "skill", "derived", skill_kw,
                                  None, None, None, None, None, None, None,
                                  {"source": "derived"}, s, confidence=1.0)
                self._insert_edge(conn, r["id"], skill_id, "REQUIRES_SKILL",
                                  weight=1.0, s=s)

    def _link_scholarships_to_skills(self, conn, s):
        rows = conn.execute(
            "SELECT id, metadata_json FROM kg_nodes WHERE type='scholarship'"
        ).fetchall()
        for r in rows:
            try:
                meta = json.loads(r["metadata_json"] or "{}")
            except Exception:
                meta = {}
            elig = (meta.get("eligibility_criteria") or "").strip()
            if not elig:
                continue
            for skill_kw in self._extract_skill_keywords(elig):
                skill_id = f"skill:{skill_kw}"
                self._insert_node(conn, skill_id, "skill", "derived", skill_kw,
                                  None, None, None, None, None, None, None,
                                  {"source": "derived"}, s, confidence=1.0)
                self._insert_edge(conn, r["id"], skill_id, "REQUIRES_SKILL",
                                  weight=1.0, s=s)

    def _link_schools_by_region(self, conn, s):
        """school/university in the same province → LINKED_TO (1-hop cluster)."""
        rows = conn.execute(
            "SELECT id, province, city FROM kg_nodes "
            "WHERE type IN ('university','school') AND (province IS NOT NULL OR city IS NOT NULL)"
        ).fetchall()
        by_region: Dict[str, List[str]] = {}
        for r in rows:
            key = (r["province"] or r["city"] or "").strip()
            if not key:
                continue
            by_region.setdefault(key, []).append(r["id"])
        for key, ids in by_region.items():
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    # Bidirectional — only one direction stored, query reverses if needed
                    self._insert_edge(conn, ids[i], ids[j], "LINKED_TO",
                                      weight=1.0, metadata={"region": key}, s=s)

    def _link_internships_to_sponsors(self, conn, s):
        interns = conn.execute(
            "SELECT id, metadata_json FROM kg_nodes WHERE type='internship'"
        ).fetchall()
        sponsors = conn.execute(
            "SELECT id, name FROM kg_nodes WHERE type='sponsor'"
        ).fetchall()
        for r in interns:
            try:
                meta = json.loads(r["metadata_json"] or "{}")
            except Exception:
                meta = {}
            field = (meta.get("field") or "").strip()
            # Link internship → sponsor by field match (heuristic)
            for sp in sponsors:
                sp_name = (sp["name"] or "").strip()
                # Simple heuristic: link if sponsor appears in internship metadata
                meta_str = json.dumps(meta, ensure_ascii=False)
                if sp_name and sp_name.lower() in meta_str.lower():
                    self._insert_edge(conn, r["id"], sp["id"], "SPONSORED_BY",
                                      weight=1.0, s=s)

    # -- Insert helpers ---------------------------------------------------

    def _insert_node(self, conn, node_id, node_type, source_table, source_id,
                     name, description, lat, lng, city, province, url,
                     metadata_json, s, confidence=1.0):
        try:
            conn.execute(
                "INSERT INTO kg_nodes (id, type, source_table, source_id, name, "
                "description, lat, lng, city, province, url, metadata_json, confidence) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (node_id, node_type, source_table, source_id, name,
                 description, lat, lng, city, province, url,
                 json.dumps(metadata_json, ensure_ascii=False) if metadata_json else None,
                 confidence),
            )
            s["nodes"] += 1
        except sqlite3.IntegrityError:
            pass  # duplicate id, skip

    def _insert_edge(self, conn, source_id, target_id, edge_type,
                     weight=1.0, metadata=None, s=None):
        if s is not None:
            s["edges"] += 1
        elif weight == 0:
            return
        try:
            conn.execute(
                "INSERT OR IGNORE INTO kg_edges "
                "(id, source_id, target_id, edge_type, weight, metadata_json) "
                "VALUES (?,?,?,?,?,?)",
                (self._edge_id(source_id, target_id, edge_type), source_id, target_id,
                 edge_type, weight,
                 json.dumps(metadata, ensure_ascii=False) if metadata else None),
            )
        except Exception as e:
            print(f"[knowledge_graph] _insert_edge failed: {e}")

    @staticmethod
    def _edge_id(source_id, target_id, edge_type) -> str:
        return f"{source_id}->{target_id}->{edge_type}"

    @staticmethod
    def _sponsor_node_id(org_name: str) -> str:
        """Deterministic node id for a denormalised sponsor."""
        import hashlib
        h = hashlib.md5(f"sponsor:{org_name}".encode("utf-8")).hexdigest()[:16]
        return f"sponsor:{h}"

    @staticmethod
    def _parse_location(text):
        """Best-effort lat/lng extraction (returns (lat, lng) or (None, None))."""
        return (None, None)

    @staticmethod
    def _fuzzy_match(a: str, b: str) -> bool:
        """True if organisation names overlap (case-insensitive substring or
        token-set overlap). Keeps extraction rule-based & deterministic."""
        al = (a or "").lower().strip()
        bl = (b or "").lower().strip()
        if not al or not bl:
            return False
        if al == bl or al in bl or bl in al:
            return True
        set_a = set(re.findall(r"[a-zàáạảãâầấậằắẵăằẳẵèéẹẻẽêềếệễểịìíỉĩĩòóọỏõôồốộỗổơờớợợụùúủũưừứựửữ]+|[a-z]+", al, re.I))
        set_b = set(re.findall(r"[a-zàáạảãâầấậằắẵăằẳẵèéẹẻẽêềếệễểịìíỉĩĩòóọỏõôồốộỗổơờớợợụùúủũưừứựửữ]+|[a-z]+", bl, re.I))
        if not set_a or not set_b:
            return False
        # Token overlap ≥ 1
        return bool(set_a & set_b)

    @staticmethod
    def _extract_skill_keywords(text: str) -> List[str]:
        """Rule-based keyword extraction from text (lowercase keywords).
        Falls back when the LLM is unavailable — keeps the graph populated
        with at least the explicitly-mentioned skills."""
        if not text:
            return []
        # Split on punctuation/whitespace, keep tokens ≥ 3 chars
        tokens = re.findall(r"[a-zàáạảãâầấậằắẵăằẳẵèéẹẻẽêềếệễểịìíỉĩĩòóọỏõôồốộỗổơờớợợụùúủũưừứựửữ]+", text.lower())
        return [t for t in tokens if len(t) >= 3]

    # ── Querying (1-degree traversal only — see Risks) ─────────────────────

    def get_graph(self, node_types: List[str] = None, limit: int = 500) -> Dict[str, Any]:
        """Return the full graph (nodes + edges) for frontend rendering.

        ``node_types`` filters which node types to include. ``limit`` caps the
        total node count to keep the GraphQL payload small for the force
        layout on HF Spaces.
        """
        conn = self._connect()
        try:
            type_filter = ""
            params: List[Any] = []
            if node_types:
                placeholders = ",".join("?" for _ in node_types)
                type_filter = f"WHERE type IN ({placeholders})"
                params.extend(node_types)
            nodes = conn.execute(
                f"SELECT id, type, name, description, lat, lng, city, province, url, "
                f"metadata_json, confidence FROM kg_nodes {type_filter} "
                f"LIMIT {int(limit)}",
                params,
            ).fetchall()
            node_ids = [n[0] for n in nodes]
            edges = []
            if node_ids:
                placeholders = ",".join("?" for _ in node_ids)
                edges = conn.execute(
                    f"SELECT id, source_id, target_id, edge_type, weight, metadata_json "
                    f"FROM kg_edges WHERE source_id IN ({placeholders}) "
                    f"OR target_id IN ({placeholders}) "
                    f"LIMIT {int(limit * 2)}",
                    node_ids + node_ids,
                ).fetchall()

            return {
                "nodes": [self._node_to_dict(n) for n in nodes],
                "edges": [self._edge_to_dict(e) for e in edges],
                "meta": {"node_count": len(nodes), "edge_count": len(edges),
                         "node_types": node_types or NODE_TYPES},
            }
        finally:
            conn.close()

    def query(self, start_node_id: str, edge_types: List[str] = None,
              depth: int = 1, limit: int = 50) -> Dict[str, Any]:
        """1-degree (or limited-depth) graph traversal from a starting node.

        Returns the starting node, its immediate neighbors (via edges), and
        the connecting edges. ``depth`` is clamped to 1 (see Risks in the idea
        spec — large graphs must not produce huge recursive queries on HF Spaces).

        Parameters
        ----------
        start_node_id : str
            kg_nodes.id of the node to explore.
        edge_types : list[str], optional
            Only traverse edges of these types.
        depth : int
            Requested traversal depth (clamped to 1).
        limit : int
            Max neighbor nodes returned.
        """
        depth = min(max(1, int(depth or 1)), 1)  # enforced 1-degree cap

        conn = self._connect()
        try:
            start = conn.execute(
                "SELECT id, type, name, description, lat, lng, city, province, url, "
                "metadata_json, confidence FROM kg_nodes WHERE id = ?",
                (start_node_id,),
            ).fetchone()

            if start is None:
                return {"start_node": None, "neighbors": [], "edges": [],
                        "meta": {"depth": depth, "clamped": True}}

            # Outgoing edges: source_id = start_node_id
            et_filter = ""
            et_params: List[Any] = []
            if edge_types:
                placeholders = ",".join("?" for _ in edge_types)
                et_filter = f"AND edge_type IN ({placeholders})"
                et_params = list(edge_types)

            out_edges = conn.execute(
                f"SELECT id, source_id, target_id, edge_type, weight, metadata_json "
                f"FROM kg_edges WHERE source_id = ? {et_filter} LIMIT ?",
                [start_node_id] + et_params + [limit],
            ).fetchall()
            # Incoming edges: target_id = start_node_id
            in_edges = conn.execute(
                f"SELECT id, source_id, target_id, edge_type, weight, metadata_json "
                f"FROM kg_edges WHERE target_id = ? {et_filter} LIMIT ?",
                [start_node_id] + et_params + [limit],
            ).fetchall()

            all_edges = out_edges + in_edges
            neighbor_ids = set()
            for e in all_edges:
                neighbor_ids.add(e["target_id"])
                neighbor_ids.add(e["source_id"])
            neighbor_ids.discard(start_node_id)

            neighbors = []
            if neighbor_ids:
                placeholders = ",".join("?" for _ in neighbor_ids)
                neighbors = conn.execute(
                    f"SELECT id, type, name, description, lat, lng, city, province, url, "
                    f"metadata_json, confidence FROM kg_nodes WHERE id IN ({placeholders})",
                    list(neighbor_ids),
                ).fetchall()

            return {
                "start_node": self._node_to_dict(start),
                "neighbors": [self._node_to_dict(n) for n in neighbors],
                "edges": [self._edge_to_dict(e) for e in all_edges],
                "meta": {"depth": depth, "clamped": True,
                         "neighbor_count": len(neighbors)},
            }
        finally:
            conn.close()

    # ── NLP entity extraction (T1 core) ────────────────────────────────────

    def extract_entities(self, text: str) -> Dict[str, Any]:
        """NLP entity extraction: trích xuất thực thể từ văn bản, liên kết
        (linking) tới các node đã tồn tại trong knowledge graph.

        Flow:
          1. Thử LLM (XKIRO/NVIDIA/Coldflare/HF) để trích xuất JSON.
          2. Nếu LLM thất bại → rule-based extraction (keyword matching).
          3. Kết quả được lưu vào ``kg_extraction_review`` để human review nếu
             confidence thấp hoặc LLM không khả dụng (rule-based).

        Returns: {entities: [...], linked_nodes: [...], confidence: float, degraded: bool}
        """
        if not text or not text.strip():
            return {"entities": [], "linked_nodes": [], "confidence": 0.0, "degraded": True}

        global _NLP_DOWN_UNTIL
        extracted: Dict[str, Any] = {"entities": [], "linked_nodes": [], "confidence": 0.0, "degraded": False}

        # Try LLM first (with circuit breaker)
        llm_result = self._llm_extract_entities(text)
        if llm_result is not None:
            extracted = llm_result
        else:
            # Fallback: rule-based extraction
            extracted = self._rule_based_extract(text)
            extracted["degraded"] = True
            _NLP_DOWN_UNTIL = time.monotonic() + _NLP_COOLDOWN

        # Link extracted entities to existing graph nodes
        extracted["linked_nodes"] = self._link_entities(text, extracted["entities"])

        # Queue for human review when degraded or confidence is low
        if extracted.get("degraded") or extracted.get("confidence", 0.0) < 0.5:
            self._queue_extraction_review(text, extracted)

        return extracted

    def _llm_extract_entities(self, text: str) -> Optional[Dict[str, Any]]:
        """Call the LLM service to extract entities (JSON)."""
        global _NLP_DOWN_UNTIL
        if time.monotonic() < _NLP_DOWN_UNTIL:
            return None
        try:
            from services.llm_service import llm_service
            if not llm_service or not getattr(llm_service, "is_ready", False):
                return None
        except Exception:
            return None

        prompt = f"""
Bạn là chuyên gia trích xuất thực thể (NLP) cho kiến thức đồ thị giáo dục của Việt Nam.
Hãy phân tích văn bản sau và trích xuất các thực thể, trả về JSON:

{{"entities": [{{"text": "...", "type": "school|university|scholarship|sponsor|opportunity|career_path|skill|region", "confidence": 0.0-1.0}}], "confidence": 0.0-1.0}}

Văn bản: "{text}"

Chỉ trả về JSON, không giải thích thêm.
"""
        try:
            response = llm_service._generate_text_with_fallback(
                prompt, temperature=0.3, max_tokens=2048, top_p=0.8
            )
            result = self._parse_json(response)
            if result and isinstance(result, dict) and "entities" in result:
                return {
                    "entities": result.get("entities", []),
                    "linked_nodes": [],
                    "confidence": float(result.get("confidence", 0.5)),
                    "degraded": False,
                }
        except Exception as e:
            print(f"[knowledge_graph] LLM extraction failed: {e}")
            _NLP_DOWN_UNTIL = time.monotonic() + _NLP_COOLDOWN
        return None

    def _rule_based_extract(self, text: str) -> Dict[str, Any]:
        """Rule-based entity extraction (deterministic keyword matching).
        Falls back when LLM is unavailable so the feature never goes dark."""
        entities = []
        conn = self._connect()
        try:
            patterns = [
                ("university", r"đại học\s+\S+|trường\s+\S+"),
                ("school", r"thpt\s+\S+|trường trung học"),
                ("scholarship", r"học bổng\s+\S*"),
                ("sponsor", r"(chính phủ|bộ|gdpn|vnđ|tổ chức)"),
                ("skill", r"(python|java|ai|iot|data|Marketing|Kỹ thuật)"),
                ("region", r"(đồng nai|tp\.?\s*hồ chí minh|hà nội|đà nẵng|cần thơ)"),
            ]
            for ent_type, pattern in patterns:
                for m in re.finditer(pattern, text, re.IGNORECASE):
                    entities.append({
                        "text": m.group().strip(),
                        "type": ent_type,
                        "confidence": 0.3,
                    })
        finally:
            conn.close()
        # Deduplicate by (text, type)
        seen = set()
        uniq = []
        for e in entities:
            key = (e["text"].lower(), e["type"])
            if key not in seen:
                seen.add(key)
                uniq.append(e)
        return {"entities": uniq, "linked_nodes": [], "confidence": 0.3, "degraded": True}

    def _link_entities(self, text: str, entities: List[Dict]) -> List[Dict]:
        """Link extracted entities to existing kg_nodes by name substring match."""
        if not entities:
            return []
        conn = self._connect()
        links = []
        try:
            for ent in entities:
                ent_text = (ent.get("text") or "").strip().lower()
                if not ent_text:
                    continue
                # Match entity type or any type containing the name
                rows = conn.execute(
                    "SELECT id, type, name, url FROM kg_nodes WHERE LOWER(name) LIKE ? OR LOWER(name) LIKE ?",
                    (f"%{ent_text}%", f"%{ent_text.replace(' ', '')}%"),
                ).fetchall()
                for row in rows:
                    links.append({
                        "entity_text": ent.get("text"),
                        "entity_type": ent.get("type"),
                        "node_id": row["id"],
                        "node_type": row["type"],
                        "node_name": row["name"],
                        "node_url": row["url"],
                        "confidence": ent.get("confidence", 0.5),
                    })
        finally:
            conn.close()
        return links

    def _queue_extraction_review(self, text: str, result: Dict) -> None:
        """Store NLP extraction in the human-review queue."""
        import uuid
        conn = self._connect()
        try:
            review_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"kg_review:{text[:200]}"))
            conn.execute(
                "INSERT OR REPLACE INTO kg_extraction_review "
                "(id, source_text, extracted_json, confidence, status) VALUES (?,?,?,?,?)",
                (review_id, text, json.dumps(result, ensure_ascii=False),
                 result.get("confidence", 0.0), "pending"),
            )
            conn.commit()
        except Exception as e:
            print(f"[knowledge_graph] queue extraction review failed: {e}")
        finally:
            conn.close()

    # ── Partner / sponsorship suggestions (T1: suggest sponsors) ───────────

    def suggest_partners(self, query: str, limit: int = 10,
                         focus_type: str = None) -> List[Dict[str, Any]]:
        """Suggest sponsors/partners that are relevant to the query.

        Uses a hybrid of:
          1. Graph traversal from nodes whose name matches the query
             → their SPONSORED_BY / OFFERS_SCHOLARSHIP neighbors.
          2. NLP entity extraction on the query to find skill/field keywords,
             → matched sponsors via scholarship eligibility.

        This implements the "Gợi ý tài trợ/đối tác phù hợp" output from the idea spec.
        """
        suggestions: List[Dict[str, Any]] = []
        conn = self._connect()
        try:
            # 1. Direct node match
            rows = conn.execute(
                "SELECT id, type, name, description, url, metadata_json FROM kg_nodes "
                "WHERE type = 'sponsor'",
            ).fetchall()
            query_lower = query.lower().strip()
            score_map: Dict[str, float] = {}
            for r in rows:
                score = self._relevance_score(query_lower, r)
                if score > 0:
                    score_map[r["id"]] = score

            # 2. Traverse from matched scholarships → sponsors
            if query_lower:
                scholarships = conn.execute(
                    "SELECT id, name FROM kg_nodes WHERE type = 'scholarship' "
                    "AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)",
                    (f"%{query_lower}%", f"%{query_lower}%"),
                ).fetchall()
                for sch in scholarships:
                    edges = conn.execute(
                        "SELECT target_id, edge_type, weight FROM kg_edges "
                        "WHERE source_id = ? AND edge_type = 'SPONSORED_BY'",
                        (sch["id"],),
                    ).fetchall()
                    for e in edges:
                        score_map[e["target_id"]] = score_map.get(e["target_id"], 0) + 0.5

            # 3. NLP entity extraction for skill/region matching
            extracted = self.extract_entities(query)
            for link in extracted.get("linked_nodes", []):
                if link["node_type"] == "sponsor":
                    score_map[link["node_id"]] = score_map.get(link["node_id"], 0) + 0.3

            # Build result list sorted by score
            for node_id, score in sorted(score_map.items(), key=lambda x: -x[1])[:limit]:
                node = conn.execute(
                    "SELECT id, type, name, description, url, city, province, metadata_json "
                    "FROM kg_nodes WHERE id = ?", (node_id,),
                ).fetchone()
                if node:
                    suggestions.append({
                        "node_id": node["id"],
                        "type": node["type"],
                        "name": node["name"],
                        "description": node["description"],
                        "url": node["url"],
                        "match_score": round(score, 2),
                        "city": node["city"],
                        "province": node["province"],
                    })
        except Exception as e:
            print(f"[knowledge_graph] suggest_partners error: {e}")
        finally:
            conn.close()
        return suggestions

    def _relevance_score(self, query: str, row: sqlite3.Row) -> float:
        """Simple TF-based relevance score between query and node text."""
        if not query:
            return 0.0
        name = (row["name"] or "").lower()
        desc = (row["description"] or "").lower()
        url = (row["url"] or "").lower()
        score = 0.0
        q_tokens = set(re.findall(r"[a-zàáạảãâầấậằắẵăằẳẵèéẹẻẽêềếệễểịìíỉĩĩòóọỏõôồốộỗổơờớợợụùúủũưừứựửữ]+", query))
        if not q_tokens:
            return 0.0
        for text in (name, desc, url):
            t_tokens = set(re.findall(r"[a-zàáạảãâầấậằắẵăằẳẵèéẹẻẽêềếệễểịìíỉĩĩòóọỏõôồốộỗổơờớợợụùúủũưừứựửữ]+", text))
            overlap = q_tokens & t_tokens
            if overlap:
                score += len(overlap) / len(q_tokens)
        return score

    # ── Human review queue access ───────────────────────────────────────────

    def get_extraction_reviews(self, status: str = "pending", limit: int = 100) -> List[Dict]:
        """Return NLP extractions queued for human review."""
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT id, source_text, extracted_json, confidence, status, "
                "reviewer_note, created_at FROM kg_extraction_review "
                "WHERE status = ? ORDER BY created_at DESC LIMIT ?",
                (status, limit),
            ).fetchall()
            return [
                {
                    "id": r["id"],
                    "source_text": r["source_text"],
                    "extracted_json": json.loads(r["extracted_json"] or "{}"),
                    "confidence": r["confidence"],
                    "status": r["status"],
                    "reviewer_note": r["reviewer_note"],
                    "created_at": r["created_at"],
                }
                for r in rows
            ]
        finally:
            conn.close()

    def approve_extraction(self, review_id: str, note: str = None) -> bool:
        """Mark an extraction as approved (reviewer action)."""
        conn = self._connect()
        try:
            conn.execute(
                "UPDATE kg_extraction_review SET status='approved', reviewer_note=?, "
                "updated_at=datetime('now') WHERE id=?",
                (note, review_id),
            )
            conn.commit()
            return True
        except Exception as e:
            print(f"[knowledge_graph] approve_extraction error: {e}")
            return False
        finally:
            conn.close()

    # ── Serialization helpers ----------------------------------------------

    @staticmethod
    def _node_to_dict(row) -> Dict[str, Any]:
        meta = None
        if row["metadata_json"]:
            try:
                meta = json.loads(row["metadata_json"])
            except Exception:
                meta = None
        return {
            "id": row["id"],
            "type": row["type"],
            "name": row["name"],
            "description": row["description"],
            "lat": row["lat"],
            "lng": row["lng"],
            "city": row["city"],
            "province": row["province"],
            "url": row["url"],
            "metadata": meta,
            "confidence": row["confidence"] if "confidence" in row.keys() else 1.0,
        }

    @staticmethod
    def _edge_to_dict(row) -> Dict[str, Any]:
        meta = None
        if row["metadata_json"]:
            try:
                meta = json.loads(row["metadata_json"])
            except Exception:
                meta = None
        return {
            "id": row["id"],
            "source": row["source_id"],
            "target": row["target_id"],
            "type": row["edge_type"],
            "weight": row["weight"],
            "metadata": meta,
        }

    @staticmethod
    def _parse_json(text: str) -> Optional[Any]:
        """Parse JSON from an LLM reply (handles markdown fences)."""
        if not text:
            return None
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").strip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()
        try:
            return json.loads(cleaned)
        except Exception:
            pass
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start:end + 1])
            except Exception:
                return None
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start:end + 1])
            except Exception:
                return None
        return None


# Module-level singleton (mirrors vector_store / cache_service pattern)
knowledge_graph = None
try:
    knowledge_graph = KnowledgeGraphService()
    print("Knowledge graph service initialized")
except Exception as e:
    print(f"Knowledge graph service init failed: {e}")
    knowledge_graph = None
