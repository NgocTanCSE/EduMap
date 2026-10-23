# EduMap — Comprehensive Enterprise UML Architecture Documentation

This directory contains the complete, production-grade PlantUML source specifications and rendered high-resolution architecture diagrams for the **EduMap Platform** (Smart Education & GIS Ecosystem for Đồng Nai Province & DNTU).

---

## 🗺️ Master Diagram Index (33 Diagrams Total: 16 Existing + 17 New)

### Existing Architecture Diagrams (16)

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
| 16 | **Activity / Data Flow: GIS Crawler Pipeline** | [`UML_crawler-gis-pipeline.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/UML_crawler-gis-pipeline.png) | Activity / Flow | 16 scripts in `crawlers/` $\rightarrow$ `aggregator.py` cleaning & dedup $\rightarrow$ PostGIS spatial indexing & ChromaDB vector ingestion |

---

### New Business Process & Lifecycle Diagrams (17)

#### Activity Diagrams (12)

| # | Diagram Name | File | Type | Business Process Focus |
|---|--------------|------|------|------------------------|
| 17 | **Activity: User Registration & Onboarding** | [`activity-user-registration.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-user-registration.png) | Activity | Guest $\rightarrow$ role selection $\rightarrow$ form validation $\rightarrow$ bcrypt password hashing $\rightarrow$ create user (TypeORM) $\rightarrow$ send verification email (BullMQ) $\rightarrow$ verify token $\rightarrow$ email_verified=true $\rightarrow$ role grant $\rightarrow$ welcome badge +50pts (Gamification) $\rightarrow$ onboarding setup $\rightarrow$ role-based dashboard |
| 18 | **Activity: AI Chat RAG Pipeline** | [`activity-ai-chat-rag.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-ai-chat-rag.png) | Activity | Client sends query $\rightarrow$ NestJS gateway validates JWT $\rightarrow$ context assembly (TypeORM, Redis recent history) $\rightarrow$ FastAPI AI service $\rightarrow$ Redis cache check (TTL 5min) $\rightarrow$ ChromaDB vector similarity search (HNSW, k=5) $\rightarrow$ prompt assembly with system prompt $\rightarrow$ Gemini 1.5 Flash LLM (temperature=0.3) $\rightarrow$ cache storage $\rightarrow$ chat history persistence $\rightarrow$ response rendered with sources + follow-up suggestions |
| 19 | **Activity: Scholarship Application & AI Eligibility** | [`activity-scholarship-application.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-scholarship-application.png) | Activity | Student browse scholarships $\rightarrow$ fill application form (PDF/CV upload to MinIO) $\rightarrow$ form validation $\rightarrow$ create application (status='pending') $\rightarrow$ AI scoring worker picks up (BullMQ) $\rightarrow$ PyMuPDF text extraction $\rightarrow$ cross-reference eligibility criteria vs. student profile (GPA, major, region) $\rightarrow$ compute aiMatchScore (0-100%) $\rightarrow$ AI timeout safeguard (15min) $\rightarrow$ push to review queue $\rightarrow$ admin review (sort by aiMatchScore desc) $\rightarrow$ approve/reject with audit log $\rightarrow$ email notification $\rightarrow$ if accepted: escrow payment $\rightarrow$ fund release $\rightarrow$ certificate issuance |
| 20 | **Activity: Mentor Booking & Escrow Payment** | [`activity-mentor-booking.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-mentor-booking.png) | Activity | Student search mentors $\rightarrow$ AI match recommendation (hybrid weighted scoring) $\rightarrow$ view mentor profile & availability $\rightarrow$ select slot $\rightarrow$ book via modal confirmation $\rightarrow$ escrow payment (2-phase: PENDING $\rightarrow$ SUCCESS/FAILED) $\rightarrow$ email confirmation $\rightarrow$ Jitsi Meet room creation (JWT token) $\rightarrow$ calendar integration (Zoho) $\rightarrow$ 1h pre-session reminder $\rightarrow$ session in progress $\rightarrow$ session completion $\rightarrow$ mutual rating $\rightarrow$ escrow release $\rightarrow$ gamification rewards (badge + points) $\rightarrow$ certificate issuance (if applicable) |
| 21 | **Activity: Community Post Creation & AI Moderation** | [`activity-community-moderation.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-community-moderation.png) | Activity | Author writes post $\rightarrow$ attach media $\rightarrow$ POST to NestJS gateway $\rightarrow$ JWT validation $\rightarrow$ forward to AI service $\rightarrow$ Tier 1 Regex/PII screening (<5ms) $\rightarrow$ Tier 2 Gemini semantic analysis (confidence 0-1) $\rightarrow$ decision matrix: APPROVED / AUTO_REJECTED / SEND_TO_HUMAN_REVIEW $\rightarrow$ if approved: insert (status='active') + search index + group notification $\rightarrow$ if rejected: error response + audit log $\rightarrow$ gamification points (+10) |
| 22 | **Activity: E-Commerce Checkout & Payment** | [`activity-business-checkout.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-business-checkout.png) | Activity | Client checkout $\rightarrow$ select payment method (COD/BANK_TRANSFER/WALLET) $\rightarrow$ POST to NestJS $\rightarrow$ TypeORM transaction (repeatable-read) $\rightarrow$ stock reservation (SELECT FOR UPDATE) $\rightarrow$ create order (status='PENDING') + order_items + transaction (status='PENDING') $\rightarrow$ commit transaction $\rightarrow$ Phase 2A: online payment (gateway redirect, IPN webhook, HMAC verification) OR Phase 2B: COD $\rightarrow$ fulfillment (vendor pack, shipping tracking, escrow release) $\rightarrow$ completion or compensating saga (stock restore) |
| 23 | **Activity: Green Challenge Participation** | [`activity-green-challenge.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-green-challenge.png) | Activity | Browse challenges $\rightarrow$ join challenge $\rightarrow$ daily activity logging $\rightarrow$ AI photo verification (CV image classification, fraud detection) $\rightarrow$ confidence > 0.85: auto-approved / 0.5-0.85: human review / < 0.5: rejected $\rightarrow$ carbon_saved_kg calculation $\rightarrow$ gamification engine (badge rules, leaderboard) $\rightarrow$ streak tracking $\rightarrow$ milestone checks $\rightarrow$ certificate issuance $\rightarrow$ share achievement |
| 24 | **Activity: Gamification Award Engine** | [`activity-gamification-award.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-gamification-award.png) | Activity | Event published from any module (learning, community, mentor, commerce, green, WS) $\rightarrow$ anti-cheat validation (duplicate detection, rate limit) $\rightarrow$ update user_points (Redis sorted set + PostgreSQL) $\rightarrow$ level calculation (sqrt formula) $\rightarrow$ badge rules engine (30+ badge types) $\rightarrow$ leaderboard engine (real-time rank) $\rightarrow$ streak tracking (daily login) $\rightarrow$ milestone engine $\rightarrow$ notification dispatch (in-app, push, email) $\rightarrow$ UI update (badge shelf, profile) |
| 25 | **Activity: Notification Dispatch & Routing** | [`activity-notification-dispatch.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-notification-dispatch.png) | Activity | Event from any source (registration, booking, order, badge, scholarship, WS, green, post) $\rightarrow$ create Notification record $\rightarrow$ fetch user preferences $\rightarrow$ channel priority (push > email > in-app) $\rightarrow$ if blocked: in-app only $\rightarrow$ if allowed: queue (BullMQ email, Socket.IO push) $\rightarrow$ Push channel: Socket.IO foreground or FCM background $\rightarrow$ Email channel: SendGrid/SMTP with retry (3x exponential backoff) + bounce handling $\rightarrow$ In-app channel: WebSocket broadcast $\rightarrow$ anti-flood & batching $\rightarrow$ client receives (toast, notification dropdown) |
| 26 | **Activity: Workshop Registration & Certificate** | [`activity-workshop-registration.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-workshop-registration.png) | Activity | Organizer creates event (geocode to PostGIS, map point) $\rightarrow$ publish event $\rightarrow$ student browses on map $\rightarrow$ register $\rightarrow$ capacity check (waitlist if full) $\rightarrow$ generate QR ticket $\rightarrow$ send confirmation + calendar invite $\rightarrow$ pre-event reminders (24h, 1h) $\rightarrow$ event day check-in (QR scan) $\rightarrow$ post-event feedback $\rightarrow$ certificate issuance (PDF + blockchain hash + verify_code QR) $\rightarrow$ gamification (badge + points) $\rightarrow$ client (download, verify, share) |
| 27 | **Activity: Donation & Impact Tracking** | [`activity-donation.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-donation.png) | Activity | Donor browses campaigns on map $\rightarrow$ select donation type (money/items) $\rightarrow$ enter amount $\rightarrow$ select payment method $\rightarrow$ POST to NestJS $\rightarrow$ create Donation (status='pending') + Transaction $\rightarrow$ redirect to payment gateway $\rightarrow$ gateway IPN webhook (HMAC verification) $\rightarrow$ success: update status, upload receipt, transparency report $\rightarrow$ failure: update status, allow retry $\rightarrow$ impact tracking (milestones at 25%/50%/75%/100%) $\rightarrow$ gamification (badge + points) $\rightarrow$ transparency report download |
| 28 | **Activity: AI Mentor Matching** | [`activity-ai-mentor-matching.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/activity-ai-mentor-matching.png) | Activity | Student opens mentor discovery $\rightarrow$ select major/topic $\rightarrow$ enter goals $\rightarrow$ POST to NestJS $\rightarrow$ fetch student profile (MBTI, skills, history) + mentor list $\rightarrow$ send to AI service $\rightarrow$ feature extraction (embeddings, personality vectors) $\rightarrow$ weighted multi-dimensional similarity scoring $\rightarrow$ constraint filtering (verified, availability, location, budget) $\rightarrow$ top-K ranking (K=10) $\rightarrow$ explainability score $\rightarrow$ cache in Redis (TTL 1h) $\rightarrow$ client displays recommendations $\rightarrow$ feedback loop (rating → ML retraining) |

#### State Machine Diagrams (5)

| # | Diagram Name | File | Type | Lifecycle States |
|---|--------------|------|------|---------------------|
| 29 | **State: Scholarship Application** | [`state-scholarship-application.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/state-scholarship-application.png) | State Machine | `SUBMITTED` $\rightarrow$ `AI_PROCESSING` $\rightarrow$ (AI_FAILED $\leftrightarrow$ retry) $\rightarrow$ `AWAITING_REVIEW` $\rightarrow$ `ACCEPTED`/`REJECTED` $\rightarrow$ `AWARD_DISBURSED` $\rightarrow$ `COMPLETED` |
| 30 | **State: User Account Lifecycle** | [`state-user-account-lifecycle.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/state-user-account-lifecycle.png) | State Machine | `REGISTERED` $\rightarrow$ `VERIFIED` $\rightarrow$ `ACTIVE` $\leftrightarrow$ `LOGIN` (with MFA_PENDING sub-state) $\rightarrow$ `SUSPENDED`/`LOCKED`/`DEACTIVATED` $\rightarrow$ termination |
| 31 | **State: Green Activity Moderation** | [`state-green-activity-moderation.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/state-green-activity-moderation.png) | State Machine | `SUBMITTED` $\rightarrow$ `AI_VALIDATING` $\rightarrow$ `AI_APPROVED`/`AI_FLAGGED`/`AI_REJECTED` $\rightarrow$ `MANUAL_REVIEW` $\rightarrow$ `POINTS_AWARDED` $\rightarrow$ `REJECTED_RECOVERY` $\rightarrow$ retry $\rightarrow$ completion |
| 32 | **State: Event Registration & Attendance** | [`state-event-registration.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/state-event-registration.png) | State Machine | `EVENT_CREATED` $\rightarrow$ `EVENT_PUBLISHED` (with REGISTERED/WAITLISTED sub-states) $\rightarrow$ `EVENT_ONGOING` $\rightarrow$ `CHECKED_IN` $\rightarrow$ `EVENT_COMPLETED` $\rightarrow$ `POST_EVENT` $\rightarrow` `CERTIFICATE_ISSUED` (or `EVENT_CANCELLED`) |
| 33 | **State: Post Content Moderation** | [`state-post-moderation.png`](file:///home/ngoctan/Downloads/EduMap/docs/all-documents/state-post-moderation.png) | State Machine | `DRAFT` $\rightarrow$ `SUBMITTED_FOR_REVIEW` (Tier 1 Regex/PII $\rightarrow$ Tier 2 Gemini) $\rightarrow$ `AUTO_APPROVED`/`PENDING_HUMAN_REVIEW`/`AUTO_REJECTED` $\rightarrow` `APPEAL_SUBMITTED` $\rightarrow` `PUBLISHED`/`DEFINITIVELY_REJECTED`/`ACCOUNT_FLAGGED` |

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

### Extended Diagrams Rendering

The **17 new diagrams** (12 Activity + 5 State Machine) are in individual `.puml` files and also bundled in `UML_Diagrams_Extended.puml`:

```bash
# Render individual extended diagrams (12 activity + 5 state)
java -Djava.awt.headless=true -DPLANTUML_LIMIT_SIZE=8192 -jar plantuml.jar activity-*.puml state-*.puml

# OR render all 17 from the combined file
java -Djava.awt.headless=true -DPLANTUML_LIMIT_SIZE=8192 -jar plantuml.jar UML_Diagrams_Extended.puml
```

All new diagrams use `skinparam linetype ortho` for sharp, orthogonal (angular) line routing — no curved/sigmoid lines.

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
