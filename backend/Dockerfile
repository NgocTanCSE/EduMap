# ---------------------------------------------------------------------------
# Rust backend (axum/sqlx) — thay thế NestJS (backend/src toàn bộ là Rust).
#
# Biên dịch tĩnh musl (`musl-gcc` + `x86_64-unknown-linux-musl`) theo
# `backend/.cargo/config.toml` → file nhị phân không cần libpq / glibc:
#   - sqlx Postgres driver là thuần Rust (tls-rustls)
#   - file nhị phân tĩnh: không cần libpq, glibc, node hay java
#
# Build context = `rootDir: backend` của Render Blueprint — mọi dòng
# `COPY` phải khớp với thư mục `backend/`.
# ---------------------------------------------------------------------------

# ---------- STAGE 1: builder (chiếm RAM/CPU nhiều nhất, ~30-60s) ----------
FROM rust:1.96-slim AS backend-builder
# MSRV budget: edition2024 (getrandom 0.4.3) >= 1.85, time@0.3.55 >= 1.88, uuid@
# 1.29.2 >= 1.89. Current stable is 1.96x (Nov 2026) — the toolchain tag is
# the lever that keeps the crates.io index from outrunning the compiler.
WORKDIR /app/backend

# ca-certificates: rustls đọc bundle hệ thống (`/etc/ssl/certs`).
# musl-tools: trình liên kết `musl-gcc` / `musl-ar` (backend/.cargo/config.toml).
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends ca-certificates musl-tools && \
    rm -rf /var/lib/apt/lists/*

RUN rustup target add x86_64-unknown-linux-musl

# `Cargo.toml` copy trước để tận dụng cache layer (chỉ rebuild khi dependency
# thay đổi). `Cargo.lock` chưa có trong repo — `cargo fetch` tự sinh ra.
COPY Cargo.toml ./
COPY .cargo .cargo
COPY src ./src
# cần có src/main.rs/trước khi fetch dependency (cargo phải tìm target)
RUN cargo fetch --target x86_64-unknown-linux-musl

# Release build: tối ưu kích thước cho ARM host (cargo build cache).
RUN CARGO_BUILD_JOBS=2 cargo build --release --target x86_64-unknown-linux-musl

# ---------- STAGE 2: runtime (tiệt trùng, kích thước ~30-60 MB) ----------
FROM debian:bookworm-slim AS runtime
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-builder /app/backend/target/x86_64-unknown-linux-musl/release/edumap-backend /app/backend/edumap-backend

# Port mặc định của backend (Rust), trùng `BACKEND_PORT`/`3000` của Rust.
EXPOSE 3000

ENV DB_TYPE=postgres \
    DB_SYNC=false \
    PORT=3000

CMD ["/app/backend/edumap-backend"]
