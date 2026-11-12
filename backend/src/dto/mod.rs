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
pub use crate::modules::admin::{AdminStats, AdminUserQuery, ContentQuery, QuestionGapsQuery, UpdateUserStatusForm};
// ai
pub use crate::modules::ai::{ChatHistoryRow, ChatMessage, ChatStreamRequest, SearchQuery, SpeechRequest};
// analytics
pub use crate::modules::analytics::{EducationStatsQuery, StatsQuery, TrackEventBody};
// audit-log
pub use crate::modules::audit_log::AuditLogQuery;
// auth
pub use crate::modules::auth::{
    ChangePasswordForm, ForgotPasswordForm, GoogleForm, LoginForm, PreferenceRow, PreferencesForm,
    ProfileForm, RefreshForm, RegisterForm, ResetPasswordForm, TokenPayload, UserOut, UserRow,
    VerifyTwoFactorForm,
};
// business
pub use crate::modules::business::{
    CartAddForm, CheckoutForm, CreateProductForm, CreateServiceForm, ProfileForm as BusinessProfileForm, ReviewForm,
    UpdateProductForm, UpdateServiceForm,
};
// career
pub use crate::modules::career::{
    ApplyJobForm, CreateCareerPathForm, CreateJobForm, CreateUserCareerForm, CreateUserSkillForm,
    Roadmap, SearchJobsQuery, UpdateApplicationStatusForm, UpdateJobForm, UpdateUserCareerForm,
    UpdateUserSkillForm,
};
// certificate
pub use crate::modules::certificate::IssueCertificateBody;
// community
pub use crate::modules::community::{
    CommentsQuery, CreateCommentRequest, CreateGroupRequest, CreatePostRequest, PostsQuery,
};
// crawler
pub use crate::modules::crawler::{CrawlHistoryEntry, CrawlStatus, EmptyQuery, TriggerBody};
// geo
pub use crate::modules::geo::{SatelliteTilesQuery, VisionDetectBody};
// hs-connection
pub use crate::modules::hs_connection::{
    AnswerQuestionForm, ConnectForm, CreateQuestionForm, GetQuestionsQuery,
    RegisterCampusTourForm, RespondForm,
};
// impact-measurement
pub use crate::modules::impact_measurement::ImpactQuery;
// internship
pub use crate::modules::internship::{ApplyForm, CreateInternshipForm, InternshipListQuery, InternshipNearbyQuery};
// intl
pub use crate::modules::intl::{
    AlumniListQuery, AlumniNearbyQuery, CreateAlumniForm, CreateProgramForm, ProgramListQuery,
};
// learning-community
pub use crate::modules::learning_community::{CreateSpotForm, RecommendSpotsQuery, SpotNearbyQuery};
// library
pub use crate::modules::library::{CreateResourceForm, ResourceListQuery, ResourceSearchQuery};
// map
pub use crate::modules::map::{
    AiAnalysisForm, BaylonBounds, ClimateAlternativesForm, ClimateRiskQuery, CreatePoiForm,
    DataGapsQuery, DistanceTableQuery, FeaturedPin, FloodZonesQuery, GapForecastQuery,
    NearestRoadQuery, NlSearchQuery, PoiBoundsQuery, ResourceOptQuery, RouteQuery,
    SafeRoutePreferences, SafeRouteQuery, SurveyQuery, TrafficSegmentsQuery,
};
// mentor
pub use crate::modules::mentor::{
    AvailabilityForm, BookingSlot, BookMentorForm, MentorsQuery, RecommendQuery, RegisterMentorForm,
    SlotsQuery, UpdateBookingStatusForm,
};
// opportunity
pub use crate::modules::opportunity::{MatchQuery, OpportunitiesQuery, OpportunityBody};
// pin
pub use crate::modules::pin::{CreatePinRequest, PinListQuery, UpdatePinRequest};
// resource-exchange
pub use crate::modules::resource_exchange::{
    CreateResource, CreateResourceRequest, ListQuery, MatchesQuery, ResourceMatchRank,
    ResourceQuery, ResourceRequestQuery,
};
// role
pub use crate::modules::role::CreateRole;
// scholar
pub use crate::modules::scholar::{ApplyScholarshipRequest, CreateScholarshipRequest, EligibilityRequest, ScholarshipListQuery};
// share
pub use crate::modules::share::{BorrowRequest, CreateItem, ItemsQuery};
// stem
pub use crate::modules::stem::{BookLab, NearbyQuery, RegisterLab};
// summer
pub use crate::modules::summer::{CreateActivityForm, CreateCampaignForm, DailyReportQuery, RegisterForm as SummerRegisterForm, StatusForm};
// survey
pub use crate::modules::survey::{CreateSurveyForm, FormatQuery, SubmitResponseForm};
// volunteer
pub use crate::modules::volunteer::{LogActivityForm, PaginationQuery};
// wifi
pub use crate::modules::wifi::{NearbyQuery as WifiNearbyQuery, ReportForm, SpeedTestForm};