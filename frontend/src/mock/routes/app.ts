/* App-shell routes: dashboard, admin, notifications, bookmarks, gamification, analytics, AI chat. */
import {
    byNewest,
    fail,
    isoFromNow,
    matchText,
    nowIso,
    num,
    ok,
    paginate,
    uid,
    type MockRoute,
} from '../core';
import {
    buildAgentReply,
    buildChatReply,
    buildDailyInsight,
    buildDataQualityReport,
    buildImpactReport as buildImpactReportBase,
    buildLearningPath,
    buildPdfTranscript,
    buildQuestionGapReport,
    buildResourceSummary,
    buildTutorReply as buildTutorReplyRaw,
} from '../ai';

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    });
}

function tokenize(text: string): string[] {
    const parts = String(text || '').match(/.{1,24}(\s|$)/g);
    return parts && parts.length > 0 ? parts : [String(text || '')];
}

function sseChat(db: any, message: string) {
    const { answer, sources } = buildChatReply(db, message);
    const chunks: string[] = [];
    chunks.push(`data: ${JSON.stringify({ meta: true, sources, degraded: false, model: 'edumap-mock' })}\n\n`);
    const tokens = tokenize(answer);
    tokens.forEach((token, idx) => {
        chunks.push(`data: ${JSON.stringify({ token, is_final: idx === tokens.length - 1 })}\n\n`);
    });
    chunks.push(`data: ${JSON.stringify({ done: true })}\n\n`);
    chunks.push('data: [DONE]\n\n');
    return sseStream(chunks);
}

function analyticsTrendPayload() {
    const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
    const sectors = [
        { name: 'CNTT & Tuyển sinh', growth_pct: 18.4, base: 42000 },
        { name: 'Kỹ thuật', growth_pct: 11.2, base: 31000 },
        { name: 'Kinh tế', growth_pct: 6.8, base: 55000 },
        { name: 'Sư phạm', growth_pct: 4.1, base: 24000 },
        { name: 'Khoa học tự nhiên', growth_pct: 8.9, base: 18000 },
    ].map((sector) => {
        const historical = years.map((year, idx) => ({
            year,
            metric_value: Math.round(sector.base * Math.pow(1 + sector.growth_pct / 100, idx * 0.45)),
        }));
        const latest = historical[historical.length - 1].metric_value;
        return {
            name: sector.name,
            growth_pct: sector.growth_pct,
            prediction_2025: Math.round(latest * (1 + sector.growth_pct / 100)),
            latest_value: latest,
            historical,
        };
    });
    const historical_data = years.map((year) => ({
        year,
        students: 300000 + (year - 2019) * 24000,
        enrollments: 120000 + (year - 2019) * 9000,
    }));
    return {
        success: true,
        status: 'success',
        generated_at: nowIso(),
        historical_data,
        sectors,
        insights: {
            average_annual_growth_pct: 9.9,
            prediction_2025_it_students: 51200,
            data_points: years.length * sectors.length,
            conclusion:
                'Nhóm ngành CNTT và kỹ thuật tiếp tục tăng trưởng nhanh nhất; nhu cầu nhân lực dự kiến tăng khoảng 18% mỗi năm trong 3 năm tới.',
            fastest_growing_sector: 'CNTT & Tuyển sinh',
            slowest_growing_sector: 'Sư phạm',
        },
        trending_skills: [
            { name: 'TypeScript', demand_score: 92, growth_pct: 24.5 },
            { name: 'Python', demand_score: 90, growth_pct: 19.1 },
            { name: 'SQL', demand_score: 86, growth_pct: 12.4 },
            { name: 'Figma', demand_score: 74, growth_pct: 9.8 },
            { name: 'AI/ML', demand_score: 88, growth_pct: 31.2 },
        ],
        trending_skills_source: 'local',
    };
}

export const appRoutes: MockRoute[] = [
    /* ---------------------------------- dashboard -------------------------------- */
    {
        method: 'GET',
        path: '/api/dashboard/overview',
        handler: (ctx) => {
            const user = ctx.user;
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            return ok({
                user: { id: user.id, full_name: user.full_name, email: user.email, avatar_url: user.avatar_url, role: user.role },
                stats: {
                    learning_materials: ctx.db.libraryResources.length,
                    skills_mastered: ctx.db.userSkills.length,
                    community_contributions: ctx.db.communityPosts.filter((p) => p.author_id === user.id).length,
                    certificates_earned: ctx.db.certificates.filter((c) => c.user_id === user.id).length,
                },
                active_goals: ctx.db.userCareers.filter((c) => c.user_id === user.id || user.role === 'admin').map((c) => ({ id: c.id, title: c.title, progress_percent: c.progress_percent, status: c.status })),
                upcoming_mentoring: ctx.db.mentorBookings
                    .filter((b) => b.student_id === user.id || user.role === 'admin')
                    .map((b) => ({ id: b.id, mentor_name: b.mentor_name, start: b.start, meeting_url: b.meeting_url })),
            });
        },
    },
    {
        method: 'GET',
        path: '/api/dashboard/insight',
        handler: (ctx) => ok(buildDailyInsight(ctx.db)),
    },
    {
        method: 'GET',
        path: '/api/dashboard/history',
        handler: (ctx) => {
            const user = ctx.user;
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const items = [
                ...ctx.db.scholarshipApplications.map((a) => ({ type: 'scholarship', title: 'Đơn học bổng', status: a.status, created_at: a.created_at })),
                ...ctx.db.internshipApplications.map((a) => ({ type: 'internship', title: 'Đơn thực tập', status: a.status, created_at: a.created_at })),
                ...ctx.db.eventRegistrations.map((r) => ({ type: 'event', title: 'Đăng ký sự kiện', status: 'registered', created_at: r.created_at })),
                ...ctx.db.greenActivities.map((g) => ({ type: 'green', title: 'Hoạt động xanh', status: 'approved', created_at: g.created_at })),
            ];
            items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            return ok(items);
        },
    },
    {
        method: 'GET',
        path: '/api/dashboard/impact',
        handler: (ctx) => ok(buildImpactReportForRoute(ctx.query.get('region') || undefined)),
    },
    {
        method: 'GET',
        path: '/api/impact-measurement/metrics',
        handler: (ctx) => ok(buildImpactReportForRoute(ctx.query.get('region') || undefined)),
    },
    {
        method: 'GET',
        path: '/api/impact-measurement/measure',
        handler: (ctx) => ok(buildImpactReportForRoute(ctx.query.get('region') || undefined)),
    },
    {
        method: 'GET',
        path: '/api/impact-measurement/auto-cached/:regionId',
        handler: (ctx) => {
            const report = buildImpactReportForRoute(ctx.params.regionId);
            return ok({ status: 'ready', region_id: ctx.params.regionId, generated_at: nowIso(), data: report, degraded: false });
        },
    },

    /* --------------------------------- notifications ----------------------------- */
    {
        method: 'GET',
        path: '/api/notifications',
        handler: (ctx) => {
            const user = ctx.user;
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const notifications = ctx.db.notifications.filter((n) => n.user_id === user.id || user.role === 'admin');
            return ok({ notifications, unread_count: notifications.filter((n) => !n.is_read).length });
        },
    },
    {
        method: ['PUT', 'POST'],
        path: '/api/notifications/:id/read',
        handler: (ctx) => {
            const item = ctx.db.notifications.find((n) => n.id === ctx.params.id);
            if (!item) return fail(404, 'Thông báo không tồn tại.');
            item.is_read = true;
            item.read_at = nowIso();
            return ok({ message: 'Đã đánh dấu đã đọc.', ...item });
        },
    },

    /* ---------------------------------- bookmarks -------------------------------- */
    {
        method: 'GET',
        path: '/api/bookmarks',
        handler: (ctx) => {
            const user = ctx.user;
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const items = ctx.db.bookmarks
                .filter((b) => b.user_id === user.id || user.role === 'admin')
                .map((b) => ({ target_type: b.target_type, target_id: b.target_id, title: b.title, created_at: b.created_at }));
            return ok({ items });
        },
    },
    {
        method: 'POST',
        path: '/api/bookmarks',
        handler: (ctx) => {
            const user = ctx.user;
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const type = String(ctx.body?.target_type || '');
            const targetId = String(ctx.body?.target_id || '');
            if (!type || !targetId) return fail(400, 'Thiếu thông tin đánh dấu.');
            const index = ctx.db.bookmarks.findIndex((b) => b.user_id === user.id && b.target_type === type && b.target_id === targetId);
            if (index >= 0) {
                ctx.db.bookmarks.splice(index, 1);
                return ok({ bookmarked: false, message: 'Đã bỏ đánh dấu.' });
            }
            ctx.db.bookmarks.unshift({
                id: uid('bm'),
                user_id: user.id,
                target_type: type,
                target_id: targetId,
                title: String(ctx.body?.title || ''),
                created_at: nowIso(),
            });
            return ok({ bookmarked: true, message: 'Đã lưu vào mục đánh dấu.' });
        },
    },

    /* -------------------------------- gamification ------------------------------- */
    {
        method: 'GET',
        path: '/api/gamification/leaderboard',
        handler: (ctx) => {
            const names = [
                ['Nguyễn Minh Khoa', 5200, 20],
                ['Ngô Gia Hân', 2450, 12],
                ['Bùi Anh Kiệt', 1980, 10],
                ['Trịnh Mai Phương', 1740, 9],
                ['Phan Bảo Ngọc', 1520, 8],
                ['Lâm Thanh Tùng', 1290, 7],
            ];
            return ok(names.map(([full_name, points, level], idx) => ({
                id: `usr-leader-${idx + 1}`,
                full_name,
                avatar_url: `https://ui-avatars.com/api/?background=0f766e&color=ffffff&name=${encodeURIComponent(String(full_name))}`,
                points,
                level,
            })));
        },
    },
    {
        method: 'GET',
        path: '/api/gamification/my-progress',
        handler: (ctx) => {
            if (!ctx.user) return fail(401, 'Vui lòng đăng nhập.');
            const points = 1240;
            const nextLevelPoints = 1600;
            return ok({
                userId: ctx.user.id,
                points,
                level: 7,
                next_level_points: nextLevelPoints,
                progress_percent: Math.round((points / nextLevelPoints) * 100),
                points_needed: nextLevelPoints - points,
                achievements: ['first_login', 'green_warrior', 'community_helper'],
                rank: 4,
                total_users: 96,
            });
        },
    },
    {
        method: 'GET',
        path: '/api/gamification/my-badges',
        handler: () => ok([
            { id: 'badge-1', name: 'Chiến binh xanh', description: 'Hoàn thành 5 hoạt động xanh.', icon: 'leaf', earned_at: isoFromNow(-30), points: 200 },
            { id: 'badge-2', name: 'Người kết nối', description: 'Kết nối với 10 thành viên.', icon: 'users', earned_at: isoFromNow(-12), points: 150 },
            { id: 'badge-3', name: 'Học giả chăm chỉ', description: 'Hoàn thành 20 giờ học.', icon: 'book', earned_at: isoFromNow(-5), points: 100 },
        ]),
    },
    {
        method: 'POST',
        path: '/api/gamification/submit-activity',
        handler: (ctx) => {
            if (!ctx.user) return fail(401, 'Vui lòng đăng nhập.');
            const points = num(ctx.body?.points, 50);
            return ok({ message: 'Ghi nhận hoạt động thành công.', points_earned: points, total_points: 1240 + points, success: true });
        },
    },
    {
        method: 'POST',
        path: '/api/gamification/grant-points',
        handler: (ctx) => ok({ message: 'Đã cộng điểm.', success: true, points: num(ctx.body?.points, 0) }),
    },
    {
        method: 'POST',
        path: '/api/gamification/grant-achievement',
        handler: () => ok({ message: 'Đã trao huy hiệu.', success: true }),
    },
    {
        method: 'GET',
        path: '/api/gamification/progress/:userId',
        handler: (ctx) => ok({ userId: ctx.params.userId, points: 1240, level: 7, next_level_points: 1600, progress_percent: 78, points_needed: 360, achievements: ['first_login'] }),
    },

    /* ---------------------------------- analytics -------------------------------- */
    {
        method: 'POST',
        path: '/api/analytics/track',
        handler: () => ok({ success: true, message: 'Đã ghi nhận sự kiện.' }),
    },
    {
        method: 'GET',
        path: '/api/analytics/stats',
        handler: (ctx) => ok({
            total_events: 18420,
            unique_users: 1240,
            page_views: 48210,
            top_pages: [
                { path: '/map', views: 12480 },
                { path: '/scholarships', views: 8120 },
                { path: '/career/jobs', views: 6210 },
                { path: '/library', views: 4180 },
            ],
            daily: [
                { date: '2026-11-02', events: 640 },
                { date: '2026-11-03', events: 712 },
                { date: '2026-11-04', events: 688 },
                { date: '2026-11-05', events: 801 },
                { date: '2026-11-06', events: 764 },
                { date: '2026-11-07', events: 690 },
                { date: '2026-11-08', events: 512 },
            ],
        }),
    },
    {
        method: 'GET',
        path: '/api/ai/analytics/stats',
        handler: () => ok(analyticsTrendPayload()),
    },

    /* ------------------------------------- AI ------------------------------------ */
    {
        method: 'GET',
        path: '/api/ai/history',
        handler: (ctx) => {
            const session = ctx.query.get('session_id');
            const items = ctx.db.aiHistory.filter((h: any) => !session || h.session_id === session);
            return ok(items);
        },
    },
    {
        method: 'DELETE',
        path: '/api/ai/history',
        handler: (ctx) => {
            ctx.db.aiHistory.length = 0;
            return ok({ message: 'Đã xoá lịch sử trò chuyện.' });
        },
    },
    {
        method: 'POST',
        path: '/api/ai/chat-stream',
        handler: (ctx) => {
            const message = String(ctx.body?.message || '');
            if (ctx.user) {
                ctx.db.aiHistory.push({ id: uid('hist'), user_id: ctx.user.id, role: 'user', content: message, created_at: nowIso(), session_id: String(ctx.body?.session_id || 'default') });
            }
            return { status: 200, stream: sseChat(ctx.db, message), headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } };
        },
    },
    {
        method: 'POST',
        path: '/api/ai/agent/chat-stream',
        handler: (ctx) => {
            const message = String(ctx.body?.message || '');
            const reply = buildAgentReply(message);
            const chunks: string[] = [];
            chunks.push(`data: ${JSON.stringify({ content: reply.content, tool_calls: reply.tool_calls, sources: reply.sources, degraded: false })}\n\n`);
            chunks.push(`data: ${JSON.stringify({ done: true })}\n\n`);
            return { status: 200, stream: sseStream(chunks), headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } };
        },
    },
    {
        method: 'POST',
        path: '/api/ai/agent/chat',
        handler: (ctx) => {
            const reply = buildAgentReply(String(ctx.body?.message || ''));
            return ok({ ...reply, degraded: false });
        },
    },
    {
        method: 'POST',
        path: '/api/ai/agent/connect',
        handler: () => ok({ connected: false, providers: [] }),
    },
    {
        method: 'POST',
        path: '/api/ai/learning-path',
        handler: (ctx) => ok(buildLearningPath(String(ctx.body?.target_role || ''), String(ctx.body?.current_level || 'beginner'))),
    },
    {
        method: 'POST',
        path: '/api/ai/pdf-transcript',
        handler: () => ok(buildPdfTranscript()),
    },
    {
        method: 'GET',
        path: '/api/ai/search',
        handler: (ctx) => {
            const q = String(ctx.query.get('q') || '');
            const items = ctx.db.libraryResources
                .filter((r) => matchText(r.title, q) || matchText(r.description, q) || matchText(r.subject, q))
                .slice(0, num(ctx.query.get('limit'), 10));
            return ok(items);
        },
    },
    {
        method: 'POST',
        path: '/api/ai/summarize',
        handler: (ctx) => ok({ summary: buildResourceSummary(String(ctx.body?.title || ctx.body?.text || 'Tài liệu EduMap')), degraded: false }),
    },

    /* --------------------------------- offline tutor ----------------------------- */
    {
        method: 'GET',
        path: '/api/offline/tutor/status',
        handler: () => ok({ model_loaded: true, model_failed: false, source: 'edumap-mock', degraded: false }),
    },
    {
        method: 'POST',
        path: '/api/offline/tutor',
        handler: (ctx) => {
            const action = String(ctx.body?.action || 'explain');
            const message = String(ctx.body?.topic || ctx.body?.message || 'Nội dung học tập');
            const base = buildTutorReplySafe(action, message);
            if (action === 'practice') {
                return ok({
                    questions: [
                        { question: `Trình bày ý chính của: ${message}`, answer: 'Nêu định nghĩa, một ví dụ và một phản ví dụ.', difficulty: 'medium' },
                        { question: `Cho ví dụ thực tế về: ${message}`, answer: 'Liên hệ với tình huống học tập hằng ngày.', difficulty: 'easy' },
                        { question: `Giải thích lại: ${message} trong 3 câu`, answer: 'Tóm tắt theo trình tự: khái niệm — cách làm — kết quả.', difficulty: 'hard' },
                    ],
                    source: base.source,
                    degraded: base.degraded,
                });
            }
            if (action === 'suggest') {
                return ok({
                    next_step: base.reply,
                    estimated_time: '25 phút',
                    resources: [
                        { title: 'Sách giáo khoa — chương liên quan' },
                        { title: 'Bộ câu hỏi ôn tập EduMap' },
                    ],
                    source: base.source,
                    degraded: base.degraded,
                });
            }
            return ok({ text: base.reply, source: base.source, degraded: base.degraded });
        },
    },

    /* ------------------------------------ admin ---------------------------------- */
    {
        method: 'GET',
        path: '/api/admin/users',
        handler: (ctx) => {
            const search = String(ctx.query.get('search') || '').trim();
            const role = ctx.query.get('role');
            const status = ctx.query.get('status');
            let items = ctx.db.adminUsers.slice();
            if (search) items = items.filter((u) => matchText(u.email, search) || matchText(u.full_name, search));
            if (role) items = items.filter((u) => u.role === role);
            if (status) items = items.filter((u) => u.status === status);
            const paged = paginate(items, ctx.query.get('page'), ctx.query.get('limit'), 10);
            return ok({ items: paged.items, meta: { total: paged.meta.total, page: paged.meta.page, limit: paged.meta.limit, totalPages: paged.meta.totalPages } });
        },
    },
    {
        method: ['PUT', 'PATCH'],
        path: '/api/admin/users/:id/status',
        handler: (ctx) => {
            const item = ctx.db.adminUsers.find((u) => u.id === ctx.params.id);
            if (!item) return fail(404, 'Người dùng không tồn tại.');
            item.status = String(ctx.body?.status || 'active');
            return ok({ message: 'Đã cập nhật trạng thái người dùng.', ...item });
        },
    },
    {
        method: 'GET',
        path: '/api/admin/dashboard',
        handler: (ctx) => ok({
            total_users: ctx.db.adminUsers.length + 86,
            active_campaigns: ctx.db.donationCampaigns.filter((c) => c.status === 'active').length + ctx.db.summerCampaigns.length,
            pending_verifications: ctx.db.adminUsers.filter((u) => u.status === 'pending').length,
            revenue_growth: '+12.4%',
            total_scholarships: ctx.db.scholarships.length,
            total_pois: ctx.db.pois.length,
            total_jobs: ctx.db.jobs.length,
            monthly_users: [820, 880, 940, 1010, 1080, 1140, 1240].map((value, idx) => ({ month: `2026-0${idx + 1}`, value })),
        }),
    },
    {
        method: 'GET',
        path: '/api/admin/question-gaps',
        handler: () => ok(buildQuestionGapReport()),
    },
    {
        method: 'POST',
        path: '/api/admin/data-quality/report',
        handler: (ctx) => ok(buildDataQualityReport(ctx.db)),
    },
    {
        method: 'GET',
        path: '/api/audit-logs',
        handler: (ctx) => {
            const items = byNewest(ctx.db.auditLogs);
            const paged = paginate(items, ctx.query.get('page'), ctx.query.get('limit'), 20);
            return ok({ items: paged.items, meta: { total: paged.meta.total, page: paged.meta.page, limit: paged.meta.limit, totalPages: paged.meta.totalPages } });
        },
    },
    {
        method: 'GET',
        path: '/api/roles',
        handler: (ctx) => ok(ctx.db.roles),
    },
    {
        method: 'POST',
        path: '/api/roles',
        handler: (ctx) => {
            const item = { id: ctx.db.roles.length + 1, name: String(ctx.body?.name || ''), description: String(ctx.body?.description || '') };
            ctx.db.roles.push(item);
            return ok({ message: 'Đã tạo vai trò.', ...item });
        },
    },
    {
        method: 'GET',
        path: '/api/admin/auto-scheduler/health',
        handler: () => ok({ status: 'ready', cached_tasks: 7, degraded: false, generated_at: nowIso() }),
    },
];

function buildImpactReportForRoute(region?: string) {
    return buildImpactReportSafe(region);
}

function buildImpactReportSafe(region?: string) {
    const names: Record<string, string> = {
        dong_nai: 'Biên Hòa, Đồng Nai',
        hcmc: 'TP. Hồ Chí Minh',
        hanoi: 'Hà Nội',
        danang: 'Đà Nẵng',
        cantho: 'Cần Thơ',
    };
    return requireImpact(region ? names[region] || region : undefined);
}

function requireImpact(region?: string) {
    const text = region || 'Biên Hòa, Đồng Nai';
    return buildImpactText(text);
}

function buildImpactText(region: string) {
    const report = buildImpactReportBase();
    report.region = region;
    return report;
}

function buildTutorReplySafe(action: unknown, message: string) {
    return buildTutorReplyRaw(String(action || 'explain'), message);
}
