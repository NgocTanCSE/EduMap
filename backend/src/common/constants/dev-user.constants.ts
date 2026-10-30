/**
 * Deterministic identifiers for the "dev user" — the fallback account used on
 * HF Spaces (free / production) when a runtime-created user (e.g. via Google
 * login) has been lost after a container restart but the JWT remains valid
 * (same JWT_SECRET → JwtAuthGuard still passes).
 *
 * On HF Spaces the SQLite file is bundled in the Docker image and reverts to
 * that image on every restart. Users created at runtime via Google OAuth are
 * written to the container's ephemeral filesystem and disappear on restart.
 * Their JWTs, however, are still signed with the same secret and remain valid,
 * so `JwtAuthGuard` lets the request through — but `userRepo.findOne()` then
 * returns null, producing a 404 "Người dùng không tồn tại".
 *
 * The dev user is seeded into `edumap.db` at build time AND re-seeded by
 * `ensureSqliteSchema()` on every boot, so its UUID is always stable.
 */

/** Fixed UUID for the dev user (matches the seeded row in edumap.db). */
export const DEV_USER_UUID = 'f379e1c3-81a0-46d0-905a-2472667ad129';

/** Email for the dev user (used as a fallback lookup key). */
export const DEV_USER_EMAIL = 'dev@edumap.com';
