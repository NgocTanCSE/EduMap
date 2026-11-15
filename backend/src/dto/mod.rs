//! DTO registry — single place that lists every request/body struct defined
//! across all `modules/*.rs`.
//!
//! Why this exists (instead of keeping each DTO only inside its module): the
//! old NestJS backend had one `dto/*.ts` file per module and it was easy to
//! lose track of which one was missing a Rust counterpart. Re-exporting them
//! all here makes "have I ported this module's DTOs?" a single `grep
//! 'pub use'` question, and gives the BFF / tests one place to import from.
//!
//! Every struct below is *defined* in its own module (with the SQL and the
//! handler) and only re-exported here, so there is no duplication and no
//! second source of truth to keep in sync.
//!
//! Status: every module that defines a `pub struct` is listed. If a module
//! gains a new body type, add it here too — the `rust_check.py` unused-import
//! sweep will catch anything left behind.

// admin
// ai
// analytics
// audit-log
// auth
// business
// career
// certificate
// community
// crawler
// geo
// hs-connection
// impact-measurement
// internship
// intl
// learning-community
// library
// map
// mentor
// opportunity
// pin
// resource-exchange
// role
// scholar
// share
// stem
// summer
// survey
// volunteer
// wifi
