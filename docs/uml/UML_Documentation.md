# EduMap — Comprehensive Enterprise UML Architecture Documentation

This directory contains the complete, production-grade PlantUML source specifications and rendered high-resolution architecture diagrams for the **EduMap Platform** (Smart Education & GIS Ecosystem for Đồng Nai Province & DNTU).

---

## 🗺️ Master Diagram Index (16 Architectural Diagrams)

| # | Diagram Name | File | Type | Architectural Focus |
|---|--------------|------|------|---------------------|
| 1 | **C4 Container Diagram** | [`UML_container-diagram.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_container-diagram.png) | C4 Level 2 | 5-tier vertical container architecture, ingress, microservices, databases & external SaaS gateways |
| 2 | **Backend Module Dependencies** | [`UML_backend-module-dependency.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_backend-module-dependency.png) | Component | Hub-and-spoke 3-column architecture (Core, Domain Subsystems, External Integrations) |
| 3 | **AI Service Internal Components** | [`UML_ai-service-components.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_ai-service-components.png) | Component | 3-pillar clean architecture: 12 routers, RAG pipeline, 2-tier moderation, ChromaDB volume |
| 4 | **Entity Relationship Diagram (ERD)** | [`UML_entity-relationship-diagram.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_entity-relationship-diagram.png) | Class / ERD | 85 TypeORM entities + 12 enums grouped into 7 Bounded Contexts with PostGIS spatial indexing |
| 5 | **Kubernetes Deployment Topology** | [`UML_deployment-diagram.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_deployment-diagram.png) | Deployment | 3-tier K8s `edumap-prod` cluster with Ingress, Stateless HPA, StatefulSets with PVC, Cloud Services |
| 6 | **Sequence: Authentication & Login** | [`UML_seq-auth-login.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_seq-auth-login.png) | Sequence | Redis Throttler rate limiting, single `bcrypt.compare`, secure JWT generation & refresh token flow |
| 7 | **Sequence: RAG AI Chatbot** | [`UML_seq-ai-chat.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_seq-ai-chat.png) | Sequence | Redis semantic cache check, ChromaDB similarity retrieval, Gemini 1.5 Flash prompt injection, TypeORM chat history persistence |
| 8 | **Sequence: Community Post Moderation** | [`UML_seq-community-post.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_seq-community-post.png) | Sequence | 2-tier content moderation: Tier 1 Regex/PII (<5ms) + Tier 2 Gemini Semantic, 3 audit outcomes (`APPROVED`, `AUTO_REJECTED`, `FLAGGED`) |
| 9 | **Sequence: E-Commerce Checkout** | [`UML_seq-business-checkout.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_seq-business-checkout.png) | Sequence | 2-phase ACID checkout (Postgres repeatable read), stock reservation, asynchronous IPN Webhook verification |
| 10 | **Sequence: Mentor Booking & Consultation** | [`UML_seq-mentor-booking.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_seq-mentor-booking.png) | Sequence | Gemini AI mentor matching, escrow payment verification, Jitsi Meet WebRTC room generation |
| 11 | **Sequence: Scholarship Eligibility Check** | [`UML_seq-scholarship-eligibility.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_seq-scholarship-eligibility.png) | Sequence | Multi-criteria eligibility assessment (GPA, major, district quota) + application submission phase |
| 12 | **Overall System Use Case** | [`UML_usecase-overall.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_usecase-overall.png) | Use Case | 4 primary actors (Student, Mentor, Business, Admin) + 2 SaaS actors interacting with 6 functional subsystems |
| 13 | **Mobile App Client Architecture** | [`UML_mobile-app-architecture.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_mobile-app-architecture.png) | Component | 4-layer React Native / Expo SDK 50 architecture (Presentation, Context Layer, Client Services, Infrastructure) |
| 14 | **State Machine: E-Commerce Order Lifecycle** | [`UML_state-order-lifecycle.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_state-order-lifecycle.png) | State Machine | `Cart` $\rightarrow$ `ORDER_PENDING` $\rightarrow$ `ORDER_PAID` $\rightarrow$ `ORDER_SHIPPING` $\rightarrow$ `ORDER_COMPLETED` / `ORDER_CANCELLED` with compensating saga |
| 15 | **State Machine: Mentor Booking Lifecycle** | [`UML_state-mentor-booking.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_state-mentor-booking.png) | State Machine | `Slot Selection` $\rightarrow$ `BOOKING_PENDING` $\rightarrow$ `BOOKING_CONFIRMED` $\rightarrow$ `SESSION_IN_PROGRESS` $\rightarrow$ `BOOKING_COMPLETED` / `BOOKING_CANCELLED` |
| 16 | **Activity / Data Flow: GIS Crawler Pipeline** | [`UML_crawler-gis-pipeline.png`](file:///home/ngoctan/Downloads/EduMap/docs/uml/UML_crawler-gis-pipeline.png) | Activity / Flow | 16 scripts in `crawlers/` $\rightarrow$ `aggregator.py` cleaning & dedup $\rightarrow$ PostGIS spatial indexing & ChromaDB vector ingestion |

---

## 🛠️ Prerequisites & Rendering Instructions

### Dependencies
- **Java Runtime Environment**: OpenJDK 17+
- **Graphviz (`dot`)**: Required for layout computation of class, container, and state diagrams.
- **PlantUML**: Version 2.18+ with headless configuration (`-Djava.awt.headless=true`).

### Command Line Rendering
To regenerate all diagrams or specific sections from `UML_Diagrams.puml`:

```bash
# Set memory limit and Graphviz path
export GRAPHVIZ_DOT=/tmp/graphviz-full/usr/bin/dot
export LD_LIBRARY_PATH=/tmp/graphviz-full/usr/lib/x86_64-linux-gnu:/tmp/graphviz-full/usr/lib

# Render all diagrams in UML_Diagrams.puml
java -Djava.awt.headless=true -DPLANTUML_LIMIT_SIZE=16384 -jar plantuml.jar UML_Diagrams.puml
```

---

## 🏛️ Architectural Context & Domain Design

### 1. Database Bounded Contexts (PostgreSQL 16 + PostGIS)
The entity-relationship model separates concerns across 7 distinct bounded contexts, eliminating monolithic coupling:
1. **Identity & Platform Security**: `User`, `Role`, `UserPreference`, `AuditLog`, `SupportTicket`.
2. **Geospatial & Smart Campus**: `Location`, `LocationCategory`, `MapPoint`, `WifiLocation`, `StemLab`, `MobileUnit`, `MobileUnitRoute`. Spatial columns use PostGIS `geography(Point, 4326)` with `GIST` indexes.
3. **Academic & Career Pathways**: `CareerPath`, `Job`, `Application`, `LearningMaterial`, `UserLearningHistory`.
4. **Talent & Scholarships**: `Scholarship`, `ScholarshipApplication`, `DonationCampaign`, `Donation`.
5. **Mentorship & Consultation**: `Mentor`, `Booking`, `MentorAvailability`, `MentorSession`, `MentorRelationship`.
6. **Community, Social & Engagement**: `Group`, `Post`, `Comment`, `ChatMessage`, `Event`, `EventRegistration`.
7. **Commerce, Marketplace & Gamification**: `BusinessProfile`, `Product`, `Service`, `Order`, `OrderItem`, `Transaction`, `Review`, `Badge`, `UserPoint`, `GreenChallenge`.

### 2. Multi-Source Crawler & RAG Pipeline
The data ingestion pipeline aggregates educational points of interest across Đồng Nai Province:
- **OpenStreetMap Overpass API**: Querying educational amenities with rate-limiting and mirror fallback.
- **Native Crawlers**: Public Wi-Fi hotspots, green spaces, libraries, schools, and provincial open data portals.
- **Cleansing & Deduplication**: Bounding box validation (`[10.6°N - 11.6°N, 106.7°E - 107.6°E]`) and spatial proximity deduplication (~11m radius).
- **Dual Destination ETL**:
  - **Relational Spatial**: Inserted into PostGIS tables with GiST indexing for low-latency radius queries (`ST_DWithin`).
  - **Vector Store**: Semantic chunking and 768-dimensional embedding generation stored in ChromaDB persistent collections for AI RAG chatbot retrieval.
