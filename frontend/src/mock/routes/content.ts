/* Content routes: education, careers, community, civic features. */
import {
    byNewest,
    fail,
    haversineKm,
    isoFromNow,
    matchText,
    nowIso,
    num,
    ok,
    pageData,
    paginate,
    uid,
    type MockContext,
    type MockRoute,
} from '../core';
import { buildResourceSummary } from '../ai';

function findById(items: Array<Record<string, any>>, id: string) {
    return items.find((item) => String(item.id) === String(id));
}

function notFound(label: string) {
    return fail(404, `${label} không tồn tại trong dữ liệu mô phỏng.`);
}

function requireUser(ctx: MockContext) {
    return ctx.user || null;
}

function publicUser(role = 'student', name = 'Học sinh EduMap') {
    return {
        id: `usr-${role}`,
        full_name: name,
        avatar_url: `https://ui-avatars.com/api/?background=0f766e&color=ffffff&name=${encodeURIComponent(name)}`,
        role,
    };
}

function ticketCode(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function svgQr(value: string) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`;
}

export const contentRoutes: MockRoute[] = [
    /* ------------------------------- scholarships ------------------------------- */
    {
        method: 'GET',
        path: '/api/scholarships',
        handler: (ctx) => {
            const q = String(ctx.query.get('q') || ctx.query.get('search') || '').trim();
            const status = ctx.query.get('status');
            let items = byNewest(ctx.db.scholarships);
            if (q) items = items.filter((s) => matchText(s.title, q) || matchText(s.provider, q) || matchText(s.location, q));
            if (status) items = items.filter((s) => s.status === status);
            return ok(pageData(items, ctx.query.get('page'), ctx.query.get('limit'), 10));
        },
    },
    {
        method: 'GET',
        path: '/api/scholarships/me/applications',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const items = ctx.db.scholarshipApplications
                .filter((a) => a.user_id === user.id || user.role === 'admin')
                .map((a) => ({ ...a, scholarship: findById(ctx.db.scholarships, a.scholarship_id) || null }));
            return ok(items);
        },
    },
    {
        method: 'GET',
        path: '/api/scholarships/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.scholarships, ctx.params.id);
            if (!item) return notFound('Học bổng');
            return ok({ ...item, scholarships: undefined, requirements: item.requirements || [] });
        },
    },
    {
        method: 'POST',
        path: '/api/scholarships/:id/check-eligibility',
        handler: (ctx) => {
            const item = findById(ctx.db.scholarships, ctx.params.id);
            if (!item) return notFound('Học bổng');
            const gpa = num(ctx.body?.gpa, 3.3);
            const needed = num(String(item.eligibility_criteria || '').match(/GPA\s*[≥>=]+\s*(\d(?:\.\d)?)/)?.[1], 3.0);
            const eligible = gpa >= needed;
            return ok({
                is_eligible: eligible,
                eligible,
                match_score: eligible ? 86 : 48,
                gpa: gpa,
                gpa_required: needed,
                message: eligible
                    ? 'Hồ sơ của bạn đáp ứng điều kiện cơ bản của học bổng này.'
                    : `Hồ sơ cần GPA tối thiểu ${needed} để đáp ứng điều kiện.`,
                missing_criteria: eligible ? [] : [`GPA tối thiểu ${needed}`],
            });
        },
    },
    {
        method: 'POST',
        path: '/api/scholarships/:id/apply',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để nộp đơn.');
            const item = findById(ctx.db.scholarships, ctx.params.id);
            if (!item) return notFound('Học bổng');
            const application = {
                id: uid('app-sch'),
                scholarship_id: item.id,
                user_id: user.id,
                status: 'pending',
                created_at: nowIso(),
                personal_statement: String(ctx.body?.personal_statement || ''),
                cv_url: String(ctx.body?.cv_url || ''),
            };
            ctx.db.scholarshipApplications.unshift(application);
            return ok({ message: 'Nộp đơn học bổng thành công.', application, data: application });
        },
    },
    {
        method: 'POST',
        path: '/api/scholarships',
        handler: (ctx) => {
            const item = { id: uid('sch'), status: 'open', created_at: nowIso(), ...(ctx.body || {}) };
            ctx.db.scholarships.unshift(item);
            return ok({ message: 'Đã tạo học bổng.', ...item });
        },
    },
    {
        method: 'PUT',
        path: '/api/scholarships/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.scholarships, ctx.params.id);
            if (!item) return notFound('Học bổng');
            Object.assign(item, ctx.body || {});
            return ok({ message: 'Đã cập nhật học bổng.', ...item });
        },
    },

    /* -------------------------------- internships ------------------------------- */
    {
        method: 'GET',
        path: '/api/internships',
        handler: (ctx) => {
            const q = String(ctx.query.get('q') || '').trim();
            const field = String(ctx.query.get('field') || '').trim();
            let items = byNewest(ctx.db.internships);
            if (q) items = items.filter((i) => matchText(i.title, q) || matchText(i.description, q) || matchText(i.company?.full_name, q));
            if (field) items = items.filter((i) => i.field === field);
            return ok(pageData(items, ctx.query.get('page'), ctx.query.get('limit'), 10));
        },
    },
    {
        method: 'GET',
        path: '/api/internships/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.internships, ctx.params.id);
            if (!item) return notFound('Cơ hội thực tập');
            return ok(item);
        },
    },
    {
        method: 'POST',
        path: '/api/internships/:id/apply',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để ứng tuyển.');
            const item = findById(ctx.db.internships, ctx.params.id);
            if (!item) return notFound('Cơ hội thực tập');
            if (!String(ctx.body?.coverLetter || '').trim()) return fail(400, 'Vui lòng nhập thư giới thiệu.');
            const application = { id: uid('app-int'), internship_id: item.id, user_id: user.id, status: 'submitted', created_at: nowIso(), cover_letter: String(ctx.body.coverLetter) };
            ctx.db.internshipApplications.unshift(application);
            return ok({
                success: true,
                tracking_id: ticketCode('INT'),
                status: 'submitted',
                message: 'Ứng tuyển thành công. Nhà tuyển dụng sẽ phản hồi trong 5–7 ngày làm việc.',
                application,
            });
        },
    },

    /* ---------------------------------- career ---------------------------------- */
    {
        method: 'GET',
        path: '/api/career/paths',
        handler: (ctx) => {
            const field = ctx.query.get('field');
            const items = field ? ctx.db.careerPaths.filter((p) => matchText(p.field, field)) : ctx.db.careerPaths;
            return ok(items);
        },
    },
    {
        method: 'GET',
        path: '/api/career/paths/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.careerPaths, ctx.params.id);
            if (!item) return notFound('Lộ trình nghề nghiệp');
            return ok(item);
        },
    },
    {
        method: 'GET',
        path: '/api/career/roadmap/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.careerPaths, ctx.params.id);
            if (!item) return notFound('Lộ trình nghề nghiệp');
            const userCareer = ctx.db.userCareers.find((c) => c.career_path_id === item.id);
            return ok({
                career_path_id: item.id,
                title: item.title,
                roadmap: item.roadmap || [],
                skills_required: item.skills_required || [],
                progress_percent: userCareer?.progress_percent ?? 0,
            });
        },
    },
    {
        method: 'GET',
        path: '/api/career/jobs',
        handler: (ctx) => {
            const q = String(ctx.query.get('q') || ctx.query.get('keyword') || '').trim();
            const location = String(ctx.query.get('location') || '').trim();
            const type = String(ctx.query.get('type') || ctx.query.get('job_type') || '').trim();
            let items = byNewest(ctx.db.jobs);
            if (q) items = items.filter((j) => matchText(j.title, q) || matchText(j.company_name, q) || (j.skills || []).some((s: string) => matchText(s, q)));
            if (location) items = items.filter((j) => matchText(j.location, location));
            if (type) items = items.filter((j) => j.job_type === type);
            const paged = paginate(items, ctx.query.get('page'), ctx.query.get('limit'), 20);
            return ok({ jobs: paged.items, total: paged.meta.total, page: paged.meta.page, limit: paged.meta.limit, totalPages: paged.meta.totalPages });
        },
    },
    {
        method: 'GET',
        path: '/api/career/jobs/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.jobs, ctx.params.id);
            if (!item) return notFound('Tin tuyển dụng');
            return ok(item);
        },
    },
    {
        method: 'POST',
        path: '/api/career/jobs',
        handler: (ctx) => {
            const item = { id: uid('job'), status: 'open', created_at: nowIso(), posted_at: nowIso(), source: 'EduMap', ...(ctx.body || {}) };
            ctx.db.jobs.unshift(item);
            return ok({ message: 'Đã đăng tin tuyển dụng.', ...item });
        },
    },
    {
        method: 'GET',
        path: '/api/career/user-skills',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            return ok(ctx.db.userSkills.filter((s) => s.user_id === user.id || user.role === 'admin'));
        },
    },
    {
        method: 'POST',
        path: '/api/career/user-skills',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const item = { id: uid('uskill'), user_id: user.id, skill_name: String(ctx.body?.skill_name || ctx.body?.name || ''), level: String(ctx.body?.level || 'beginner'), years_experience: num(ctx.body?.years_experience, 0), created_at: nowIso() };
            ctx.db.userSkills.unshift(item);
            return ok({ message: 'Đã thêm kỹ năng.', ...item });
        },
    },
    {
        method: 'DELETE',
        path: '/api/career/user-skills/:id',
        handler: (ctx) => {
            const index = ctx.db.userSkills.findIndex((s) => s.id === ctx.params.id);
            if (index === -1) return notFound('Kỹ năng');
            ctx.db.userSkills.splice(index, 1);
            return ok({ message: 'Đã xoá kỹ năng.' });
        },
    },
    {
        method: 'GET',
        path: '/api/career/user-careers',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            return ok(ctx.db.userCareers.filter((c) => c.user_id === user.id || user.role === 'admin'));
        },
    },
    {
        method: 'POST',
        path: '/api/career/user-careers',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const career = findById(ctx.db.careerPaths, String(ctx.body?.career_path_id || ''));
            const item = {
                id: uid('ucareer'),
                user_id: user.id,
                career_path_id: String(ctx.body?.career_path_id || ''),
                title: String(ctx.body?.title || career?.title || ''),
                status: 'in_progress',
                progress_percent: 0,
                target_date: String(ctx.body?.target_date || isoFromNow(180).slice(0, 10)),
                created_at: nowIso(),
            };
            ctx.db.userCareers.unshift(item);
            return ok({ message: 'Đã thêm mục tiêu nghề nghiệp.', ...item });
        },
    },
    {
        method: 'POST',
        path: '/api/career/applications',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const item = { id: uid('app-job'), user_id: user.id, status: 'submitted', created_at: nowIso(), ...(ctx.body || {}) };
            ctx.db.jobApplications.unshift(item);
            return ok({ message: 'Nộp hồ sơ ứng tuyển thành công.', ...item });
        },
    },
    {
        method: 'GET',
        path: '/api/career/applications',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            return ok(ctx.db.jobApplications.filter((a) => a.user_id === user.id || user.role === 'admin'));
        },
    },
    {
        method: 'GET',
        path: '/api/career/ai-advice',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            return ok({
                advice:
                    'Dựa trên kỹ năng hiện có (JavaScript, SQL, Figma), bạn phù hợp nhất với vị trí Kỹ sư Phần mềm (Backend) và Chuyên viên Phân tích dữ liệu. ' +
                    'Trong 3 tháng tới, hãy bổ sung System Design và PostgreSQL, đồng thời hoàn thành một dự án có triển khai thực tế để tăng độ tin cậy của CV.',
                strengths: ['Nền tảng lập trình', 'Làm việc với dữ liệu'],
                gaps: ['System Design', 'Kinh nghiệm triển khai'],
                next_steps: ['Hoàn thành khoá System Design', 'Xây dựng 1 dự án full-stack', 'Luyện phỏng vấn kỹ thuật'],
                degraded: false,
            });
        },
    },
    {
        method: 'POST',
        path: '/api/career/suggest',
        handler: (ctx) => {
            const skills = new Set(ctx.db.userSkills.map((s) => String(s.skill_name || '').toLowerCase()));
            const scored = ctx.db.careerPaths.map((path) => {
                const required: string[] = path.skills_required || [];
                const overlap = required.filter((s) => skills.has(s.toLowerCase())).length;
                return {
                    ...path,
                    match_score: Math.min(96, 55 + Math.round((overlap / Math.max(1, required.length)) * 40)),
                    match_reasons: overlap > 0 ? [`Bạn đã có ${overlap}/${required.length} kỹ năng yêu cầu`] : ['Phù hợp với mục tiêu nghề nghiệp đã chọn'],
                };
            });
            scored.sort((a, b) => b.match_score - a.match_score);
            return ok({ top_suggestions: scored.slice(0, 3), total: scored.length, degraded: false });
        },
    },
    {
        method: 'POST',
        path: '/api/career/upload-resume',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            return ok({
                message: 'Đã phân tích CV.',
                file_name: String(ctx.body?.file_name || 'cv.pdf'),
                extracted_skills: ['JavaScript', 'SQL', 'Figma'],
                experience_years: 2,
                suggested_roles: ['Kỹ sư Phần mềm (Backend)', 'Chuyên viên Phân tích dữ liệu'],
                degraded: false,
            });
        },
    },

    /* ----------------------------------- events --------------------------------- */
    {
        method: 'GET',
        path: '/api/events',
        handler: (ctx) => ok(byNewest(ctx.db.events)),
    },
    {
        method: 'GET',
        path: '/api/events/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.events, ctx.params.id);
            if (!item) return notFound('Sự kiện');
            return ok(item);
        },
    },
    {
        method: 'POST',
        path: '/api/events',
        handler: (ctx) => {
            const item = { id: uid('evt'), registered_count: 0, status: 'upcoming', created_at: nowIso(), ...(ctx.body || {}) };
            ctx.db.events.unshift(item);
            return ok({ message: 'Đã tạo sự kiện.', ...item });
        },
    },
    {
        method: 'POST',
        path: '/api/events/:id/register',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để đăng ký.');
            const item = findById(ctx.db.events, ctx.params.id);
            if (!item) return notFound('Sự kiện');
            const existing = ctx.db.eventRegistrations.find((r) => r.event_id === item.id && r.user_id === user.id);
            if (existing) return ok({ message: 'Bạn đã đăng ký sự kiện này.', event_title: item.title, ticket_code: existing.ticket_code, ticket_qr: existing.ticket_qr, start_date: item.start_date, location: item.location, address: item.address });
            const code = ticketCode('EVT');
            const registration = { id: uid('evtreg'), event_id: item.id, user_id: user.id, ticket_code: code, ticket_qr: svgQr(code), created_at: nowIso() };
            ctx.db.eventRegistrations.unshift(registration);
            item.registered_count = num(item.registered_count, 0) + 1;
            return ok({
                message: 'Đăng ký sự kiện thành công.',
                event_title: item.title,
                ticket_code: code,
                ticket_qr: registration.ticket_qr,
                start_date: item.start_date,
                location: item.location,
                address: item.address,
            });
        },
    },

    /* -------------------------------- opportunities ------------------------------ */
    {
        method: 'GET',
        path: '/api/opportunities',
        handler: (ctx) => {
            const type = ctx.query.get('type');
            const field = ctx.query.get('field');
            const q = String(ctx.query.get('q') || '').trim();
            let items = byNewest(ctx.db.opportunities);
            if (type && type !== 'all') items = items.filter((o) => o.type === type || o.category === type);
            if (field) items = items.filter((o) => matchText(o.field, field));
            if (q) items = items.filter((o) => matchText(o.title, q) || matchText(o.description, q));
            const includeAll = ctx.query.get('paginate') === 'true';
            return includeAll ? ok(pageData(items, ctx.query.get('page'), ctx.query.get('limit'), 20)) : ok(items);
        },
    },
    {
        method: 'POST',
        path: '/api/opportunities/match',
        handler: (ctx) => {
            const profile = ctx.body || {};
            const gpa = num(profile.gpa, 3.3);
            const interests: string[] = Array.isArray(profile.interests) ? profile.interests : ['CNTT'];
            const matches = ctx.db.opportunities.slice(0, 6).map((opp, idx) => {
                const gpaRequired = opp.gpa_requirement;
                const eligible = gpaRequired === null || gpaRequired === undefined || gpa >= num(gpaRequired);
                const score = Math.max(45, Math.min(97, 92 - idx * 5 + (eligible ? 5 : -18)));
                return {
                    id: opp.id,
                    title: opp.title,
                    organization: opp.organization,
                    type: opp.type,
                    url: opp.url,
                    deadline: opp.deadline,
                    region: opp.region,
                    match_score: score,
                    confidence: eligible ? 0.86 : 0.58,
                    confidence_level: eligible ? 'high' : 'medium',
                    is_eligible: eligible,
                    extracted_criteria: {
                        gpa_required: gpaRequired,
                        deadline: opp.deadline,
                        field: opp.field,
                        region: opp.region,
                    },
                    match_reasons: eligible
                        ? ['Điều kiện GPA phù hợp', `Lĩnh vực ${opp.field} trùng với mối quan tâm`]
                        : ['Cần bổ sung điều kiện GPA'],
                    checklist: eligible
                        ? ['Bảng điểm', 'Thư giới thiệu', 'Bài luận cá nhân']
                        : [`Nâng GPA lên tối thiểu ${gpaRequired}`, 'Bảng điểm', 'Bài luận cá nhân'],
                };
            });
            return ok({
                user_id: ctx.user?.id || 'usr-demo-student',
                matches,
                total: matches.length,
                filtered_count: matches.length,
                degraded: false,
                reason: null,
                profile: { gpa, interests },
            });
        },
    },
    {
        method: 'GET',
        path: '/api/opportunities/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.opportunities, ctx.params.id);
            if (!item) return notFound('Cơ hội');
            return ok(item);
        },
    },
    {
        method: 'POST',
        path: '/api/opportunities/:id/team-finding',
        handler: (ctx) => {
            const item = findById(ctx.db.opportunities, ctx.params.id);
            if (!item) return notFound('Cơ hội');
            item.is_team_finding_open = !item.is_team_finding_open;
            return ok(item);
        },
    },

    /* ---------------------------------- library --------------------------------- */
    {
        method: 'GET',
        path: '/api/library/search',
        handler: (ctx) => {
            const q = String(ctx.query.get('q') || '').trim();
            const subject = ctx.query.get('subject');
            const type = ctx.query.get('type');
            let items = byNewest(ctx.db.libraryResources);
            if (q) items = items.filter((r) => matchText(r.title, q) || matchText(r.author, q) || matchText(r.description, q));
            if (subject && subject !== 'Tất cả') items = items.filter((r) => r.subject === subject);
            if (type) items = items.filter((r) => r.type === type);
            const paged = paginate(items, ctx.query.get('page'), ctx.query.get('limit'), 12);
            return ok({ items: paged.items, meta: paged.meta, total: paged.meta.total });
        },
    },
    {
        method: 'GET',
        path: '/api/library/resources/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.libraryResources, ctx.params.id);
            if (!item) return notFound('Học liệu');
            item.view_count = num(item.view_count, 0) + 1;
            return ok({ ...item, related: ctx.db.libraryResources.filter((r) => r.subject === item.subject && r.id !== item.id).slice(0, 3) });
        },
    },
    {
        method: 'GET',
        path: '/api/library/resources/:id/summary',
        handler: (ctx) => {
            const item = findById(ctx.db.libraryResources, ctx.params.id);
            if (!item) return notFound('Học liệu');
            return ok({ resource_id: item.id, summary: buildResourceSummary(item.title), key_points: ['Khái niệm cốt lõi', 'Ví dụ minh hoạ', 'Bài tập thực hành'], degraded: false });
        },
    },

    /* --------------------------------- mentoring -------------------------------- */
    {
        method: 'GET',
        path: '/api/mentoring/mentors',
        handler: (ctx) => {
            const specialty = ctx.query.get('specialty');
            const items = specialty ? ctx.db.mentors.filter((m) => matchText(m.specialty, specialty) || (m.specialties || []).some((s: string) => matchText(s, specialty))) : ctx.db.mentors;
            return ok(items);
        },
    },
    {
        method: 'GET',
        path: '/api/mentoring/mentors/recommend/:id',
        handler: (ctx) => {
            const items = ctx.db.mentors.map((m, idx) => ({
                ...m,
                match_score: Math.max(60, 95 - idx * 6),
                match_reasons: ['Chuyên môn phù hợp mục tiêu', 'Có kinh nghiệm thực tế'],
            }));
            return ok({ user_id: ctx.params.id, recommendations: items.slice(0, 4), degraded: false });
        },
    },
    {
        method: 'GET',
        path: '/api/mentoring/mentors/:id/slots',
        handler: (ctx) => {
            const mentor = findById(ctx.db.mentors, ctx.params.id);
            if (!mentor) return notFound('Cố vấn');
            const date = ctx.query.get('date') || nowIso().slice(0, 10);
            const slots = ['09:00', '10:30', '14:00', '15:30', '19:00'].map((time, idx) => ({
                id: `slot-${idx + 1}`,
                start: `${date}T${time}:00.000Z`,
                end: `${date}T${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:${time.slice(3)}:00.000Z`,
                available: idx !== 2,
            }));
            return ok({ mentor_id: mentor.id, date, slots });
        },
    },
    {
        method: 'GET',
        path: '/api/mentoring/mentors/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.mentors, ctx.params.id);
            if (!item) return notFound('Cố vấn');
            return ok(item);
        },
    },
    {
        method: 'POST',
        path: '/api/mentoring/book',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const mentor = findById(ctx.db.mentors, String(ctx.body?.mentorId || ''));
            if (!mentor) return notFound('Cố vấn');
            const booking = {
                id: uid('booking'),
                mentor_id: mentor.id,
                mentor_name: mentor.user?.full_name || 'Cố vấn EduMap',
                student_id: user.id,
                start: String(ctx.body?.slot?.start || isoFromNow(1)),
                end: String(ctx.body?.slot?.end || isoFromNow(1)),
                status: 'pending',
                meeting_url: 'https://meet.google.com/edumap-demo',
                created_at: nowIso(),
            };
            ctx.db.mentorBookings.unshift(booking);
            return ok({ message: 'Đặt lịch thành công. Cố vấn sẽ xác nhận sớm.', ...booking });
        },
    },
    {
        method: 'GET',
        path: '/api/mentoring/me/bookings',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            return ok(ctx.db.mentorBookings.filter((b) => b.student_id === user.id || user.role === 'admin'));
        },
    },
    {
        method: 'PATCH',
        path: '/api/mentoring/bookings/:id/status',
        handler: (ctx) => {
            const item = findById(ctx.db.mentorBookings, ctx.params.id);
            if (!item) return notFound('Lịch cố vấn');
            item.status = String(ctx.body?.status || 'confirmed');
            return ok({ message: 'Đã cập nhật trạng thái.', ...item });
        },
    },

    /* --------------------------------- community -------------------------------- */
    {
        method: 'GET',
        path: '/api/community/posts',
        handler: (ctx) => {
            const q = String(ctx.query.get('q') || '').trim();
            const groupId = ctx.query.get('group_id') || ctx.query.get('groupId');
            let items = byNewest(ctx.db.communityPosts).filter((p) => p.status === 'published');
            if (q) items = items.filter((p) => matchText(p.title, q) || matchText(p.content, q));
            if (groupId) items = items.filter((p) => p.group_id === groupId);
            return ok(pageData(items, ctx.query.get('page'), ctx.query.get('limit'), 10));
        },
    },
    {
        method: 'POST',
        path: '/api/community/posts',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để đăng bài.');
            const group = findById(ctx.db.communityGroups, String(ctx.body?.group_id || ''));
            const post = {
                id: uid('post'),
                title: String(ctx.body?.title || 'Bài viết mới'),
                content: String(ctx.body?.content || ''),
                author_id: user.id,
                group_id: String(ctx.body?.group_id || 'group-1'),
                like_count: 0,
                comment_count: 0,
                status: 'published',
                created_at: nowIso(),
                author: { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url, role: user.role },
                group: group ? { id: group.id, name: group.name, description: group.description } : undefined,
            };
            ctx.db.communityPosts.unshift(post);
            return ok({ message: 'Đã đăng bài.', ...post });
        },
    },
    {
        method: 'GET',
        path: '/api/community/posts/:id/comments',
        handler: (ctx) => {
            const post = findById(ctx.db.communityPosts, ctx.params.id);
            if (!post) return notFound('Bài viết');
            const items = ctx.db.communityComments.filter((c) => c.post_id === post.id);
            return ok(pageData(items, ctx.query.get('page'), ctx.query.get('limit'), 20));
        },
    },
    {
        method: 'POST',
        path: '/api/community/posts/:id/comments',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để bình luận.');
            const post = findById(ctx.db.communityPosts, ctx.params.id);
            if (!post) return notFound('Bài viết');
            if (!String(ctx.body?.content || '').trim()) return fail(400, 'Nội dung bình luận không được để trống.');
            const comment = {
                id: uid('cmt'),
                post_id: post.id,
                author_id: user.id,
                content: String(ctx.body.content),
                like_count: 0,
                status: 'published',
                created_at: nowIso(),
                author: { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url, role: user.role },
            };
            ctx.db.communityComments.push(comment);
            post.comment_count = num(post.comment_count, 0) + 1;
            return ok({ message: 'Đã gửi bình luận.', ...comment });
        },
    },
    {
        method: 'POST',
        path: '/api/community/posts/:id/like',
        handler: (ctx) => {
            const post = findById(ctx.db.communityPosts, ctx.params.id);
            if (!post) return notFound('Bài viết');
            post.like_count = num(post.like_count, 0) + 1;
            return ok({ liked: true, like_count: post.like_count, ...post });
        },
    },
    {
        method: 'GET',
        path: '/api/community/posts/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.communityPosts, ctx.params.id);
            if (!item) return notFound('Bài viết');
            return ok(item);
        },
    },
    {
        method: 'GET',
        path: '/api/community/groups',
        handler: (ctx) => ok(ctx.db.communityGroups),
    },

    /* ----------------------------------- wifi ----------------------------------- */
    {
        method: 'GET',
        path: '/api/wifi/locations/nearby',
        handler: (ctx) => {
            const lat = num(ctx.query.get('lat'), 10.9576);
            const lng = num(ctx.query.get('lng'), 106.8186);
            const radiusKm = num(ctx.query.get('radius') || ctx.query.get('radiusKm'), 5);
            const items = ctx.db.wifiLocations
                .map((w) => {
                    const coords = w.coordinates?.coordinates || w.location?.coordinates || [w.lng, w.lat];
                    return { ...w, distance_km: Number(haversineKm(lat, lng, num(coords?.[1]), num(coords?.[0])).toFixed(2)) };
                })
                .filter((w) => w.distance_km <= radiusKm)
                .sort((a, b) => a.distance_km - b.distance_km);
            return ok(items);
        },
    },
    {
        method: 'GET',
        path: '/api/wifi/locations',
        handler: (ctx) => ok(byNewest(ctx.db.wifiLocations)),
    },
    {
        method: 'POST',
        path: '/api/wifi/locations/:id/speed-test',
        handler: (ctx) => {
            const item = findById(ctx.db.wifiLocations, ctx.params.id);
            if (!item) return notFound('Điểm wifi');
            const jitter = Math.round((Math.random() - 0.5) * 8);
            return ok({
                wifi_id: item.id,
                download_mbps: Math.max(8, num(item.speed_mbps, 30) + jitter),
                upload_mbps: Math.max(4, Math.round(num(item.speed_mbps, 30) * 0.35)),
                latency_ms: 18 + Math.abs(jitter),
                tested_at: nowIso(),
            });
        },
    },
    {
        method: 'POST',
        path: '/api/wifi/locations',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const item = {
                id: uid('wifi'),
                name: String(ctx.body?.name || 'Điểm wifi mới'),
                description: String(ctx.body?.description || ''),
                ssid: String(ctx.body?.ssid || 'EduMap-Wifi'),
                password: String(ctx.body?.password || ''),
                is_free: ctx.body?.is_free !== false,
                speed_mbps: num(ctx.body?.speed_mbps, 30),
                provider: String(ctx.body?.provider || 'Cộng đồng EduMap'),
                address: String(ctx.body?.address || ''),
                location: ctx.body?.location || null,
                coordinates: { type: 'Point', coordinates: [num(ctx.body?.lng, 106.8186), num(ctx.body?.lat, 10.9576)] },
                rating_avg: 0,
                rating_count: 0,
                verified: false,
                is_verified: false,
                reported_by: user.id,
                created_at: nowIso(),
            };
            ctx.db.wifiLocations.unshift(item);
            return ok({ message: 'Đã thêm điểm wifi. Cảm ơn đóng góp của bạn!', ...item });
        },
    },

    /* ----------------------------------- green ---------------------------------- */
    {
        method: 'GET',
        path: '/api/green/challenges',
        handler: (ctx) => {
            const status = ctx.query.get('status');
            const items = status ? ctx.db.greenChallenges.filter((c) => c.status === status) : ctx.db.greenChallenges;
            return ok(byNewest(items));
        },
    },
    {
        method: 'POST',
        path: '/api/green/activities',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const challenge = findById(ctx.db.greenChallenges, String(ctx.body?.challenge_id || ''));
            const activity = {
                id: uid('greenact'),
                user_id: user.id,
                challenge_id: challenge?.id || String(ctx.body?.challenge_id || ''),
                carbon_saved_kg: num(challenge?.carbon_saved_kg, num(ctx.body?.carbon_saved_kg, 5)),
                points_earned: num(challenge?.points, num(ctx.body?.points_earned, 50)),
                created_at: nowIso(),
            };
            ctx.db.greenActivities.unshift(activity);
            return ok({ message: 'Ghi nhận hoạt động xanh thành công.', ...activity });
        },
    },

    /* ---------------------------------- surveys --------------------------------- */
    {
        method: 'GET',
        path: '/api/surveys',
        handler: (ctx) => ok(byNewest(ctx.db.surveys)),
    },
    {
        method: 'GET',
        path: '/api/surveys/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.surveys, ctx.params.id);
            if (!item) return notFound('Khảo sát');
            return ok(item);
        },
    },
    {
        method: 'POST',
        path: '/api/surveys/:id/submit',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để thực hiện khảo sát.');
            const item = findById(ctx.db.surveys, ctx.params.id);
            if (!item) return notFound('Khảo sát');
            const response = { id: uid('surveyres'), survey_id: item.id, user_id: user.id, answers: ctx.body?.answers || {}, created_at: nowIso() };
            ctx.db.surveyResponses.unshift(response);
            return ok({ message: 'Cảm ơn bạn đã hoàn thành khảo sát.', success: true, response });
        },
    },

    /* ------------------------------------ stem ---------------------------------- */
    {
        method: 'GET',
        path: '/api/stem/labs',
        handler: (ctx) => ok(byNewest(ctx.db.stemLabs)),
    },
    {
        method: 'POST',
        path: '/api/stem/labs/:id/book',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const lab = findById(ctx.db.stemLabs, ctx.params.id);
            if (!lab) return notFound('Phòng STEM');
            const booking = { id: uid('labbk'), lab_id: lab.id, user_id: user.id, date: String(ctx.body?.date || isoFromNow(3).slice(0, 10)), purpose: String(ctx.body?.purpose || ''), status: 'pending', created_at: nowIso() };
            ctx.db.stemBookings.unshift(booking);
            return ok({ message: 'Đã gửi yêu cầu đặt phòng STEM.', ...booking });
        },
    },

    /* ----------------------------------- summer --------------------------------- */
    {
        method: 'GET',
        path: '/api/summer/campaigns',
        handler: (ctx) => ok(byNewest(ctx.db.summerCampaigns)),
    },
    {
        method: 'GET',
        path: '/api/summer/campaigns/:id/daily-report',
        handler: (ctx) => {
            const item = findById(ctx.db.summerCampaigns, ctx.params.id);
            if (!item) return notFound('Chiến dịch');
            const date = ctx.query.get('date') || nowIso().slice(0, 10);
            return ok({
                campaign_id: item.id,
                date,
                volunteers_present: 42,
                students_reached: 168,
                hours_logged: 126,
                activities: [
                    { name: 'Lớp ôn Toán', students: 48, note: 'Ôn tập chương hàm số' },
                    { name: 'Lớp tiếng Anh giao tiếp', students: 52, note: 'Chủ đề nghề nghiệp' },
                    { name: 'Hoạt động STEM', students: 68, note: 'Lắp ráp robot đơn giản' },
                ],
                notes: 'Thời tiết thuận lợi, tỷ lệ tham gia cao hơn kế hoạch.',
            });
        },
    },
    {
        method: 'POST',
        path: '/api/summer/campaigns/:id/register',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để đăng ký.');
            const item = findById(ctx.db.summerCampaigns, ctx.params.id);
            if (!item) return notFound('Chiến dịch');
            const registration = { id: uid('summerreg'), campaign_id: item.id, user_id: user.id, status: 'pending', created_at: nowIso() };
            ctx.db.summerRegistrations.unshift(registration);
            return ok({ message: 'Đăng ký tham gia chiến dịch thành công.', ...registration });
        },
    },
    {
        method: 'POST',
        path: '/api/summer/campaigns',
        handler: (ctx) => {
            const item = { id: uid('summer'), status: 'planning', created_at: nowIso(), ...(ctx.body || {}) };
            ctx.db.summerCampaigns.unshift(item);
            return ok({ message: 'Đã tạo chiến dịch.', ...item });
        },
    },
    {
        method: 'POST',
        path: '/api/summer/campaigns/:id/activities',
        handler: (ctx) => ok({ message: 'Đã thêm hoạt động cho chiến dịch.', campaign_id: ctx.params.id, ...(ctx.body || {}) }),
    },

    /* --------------------------------- volunteers -------------------------------- */
    {
        method: 'GET',
        path: '/api/volunteers/activities',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const items = byNewest(
                ctx.db.volunteerActivities.filter((a) => a.user_id === user.id || user.role === 'admin'),
                'date',
            );
            return ok({ activities: items, total_hours: items.reduce((sum, a) => sum + num(a.hours, 0), 0) });
        },
    },
    {
        method: 'POST',
        path: '/api/volunteers/activities',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const item = {
                id: uid('vol'),
                user_id: user.id,
                title: String(ctx.body?.title || ''),
                description: String(ctx.body?.description || ''),
                campaign_name: String(ctx.body?.campaign_name || ''),
                hours: num(ctx.body?.hours, 0),
                date: String(ctx.body?.date || nowIso().slice(0, 10)),
                status: 'pending',
                created_at: nowIso(),
            };
            ctx.db.volunteerActivities.unshift(item);
            return ok({ message: 'Đã ghi nhận hoạt động tình nguyện.', ...item });
        },
    },

    /* ---------------------------------- donations -------------------------------- */
    {
        method: 'GET',
        path: '/api/donations/campaigns',
        handler: (ctx) => ok(byNewest(ctx.db.donationCampaigns)),
    },
    {
        method: 'GET',
        path: '/api/donations/campaigns/:id/donors',
        handler: (ctx) => {
            const item = findById(ctx.db.donationCampaigns, ctx.params.id);
            if (!item) return notFound('Chiến dịch quyên góp');
            return ok(ctx.db.donationDonors.filter((d) => d.campaign_id === item.id));
        },
    },
    {
        method: 'GET',
        path: '/api/donations/campaigns/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.donationCampaigns, ctx.params.id);
            if (!item) return notFound('Chiến dịch quyên góp');
            return ok(item);
        },
    },
    {
        method: 'POST',
        path: '/api/donations',
        handler: (ctx) => {
            const campaignId = String(ctx.body?.campaign_id || ctx.body?.campaignId || '');
            const item = findById(ctx.db.donationCampaigns, campaignId);
            if (!item) return notFound('Chiến dịch quyên góp');
            const amount = num(ctx.body?.amount, 0);
            if (amount <= 0) return fail(400, 'Số tiền quyên góp phải lớn hơn 0.');
            item.current_amount = num(item.current_amount, 0) + amount;
            const donor = {
                id: uid('donor'),
                campaign_id: item.id,
                donor_name: ctx.body?.is_anonymous ? 'Ẩn danh' : String(ctx.body?.donor_name || ctx.user?.full_name || 'Nhà hảo tâm'),
                amount,
                is_anonymous: Boolean(ctx.body?.is_anonymous),
                created_at: nowIso(),
            };
            ctx.db.donationDonors.unshift(donor);
            return ok({
                status: 'success',
                message: 'Cảm ơn tấm lòng của bạn!',
                transaction_id: ticketCode('DON'),
                campaign: { id: item.id, title: item.title, current_amount: item.current_amount, target_amount: item.target_amount },
            });
        },
    },

    /* ------------------------------------ share ---------------------------------- */
    {
        method: 'GET',
        path: '/api/share/items',
        handler: (ctx) => {
            const category = ctx.query.get('category');
            const items = category ? ctx.db.sharedItems.filter((i) => i.category === category) : ctx.db.sharedItems;
            return ok(byNewest(items));
        },
    },
    {
        method: 'POST',
        path: '/api/share/items',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để chia sẻ.');
            const item = {
                id: uid('share'),
                name: String(ctx.body?.name || ''),
                category: String(ctx.body?.category || 'books'),
                description: String(ctx.body?.description || ''),
                status: 'available',
                owner_id: user.id,
                created_at: nowIso(),
                owner: { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url },
            };
            ctx.db.sharedItems.unshift(item);
            return ok({ message: 'Đã đăng tài liệu chia sẻ.', ...item });
        },
    },
    {
        method: 'POST',
        path: '/api/share/items/:id/request',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để mượn.');
            const item = findById(ctx.db.sharedItems, ctx.params.id);
            if (!item) return notFound('Tài liệu');
            const request = { id: uid('sharereq'), item_id: item.id, requester_id: user.id, message: String(ctx.body?.message || ''), status: 'pending', created_at: nowIso(), item };
            ctx.db.shareRequests.unshift(request);
            return ok({ message: 'Đã gửi yêu cầu mượn.', ...request });
        },
    },
    {
        method: 'GET',
        path: '/api/share/requests',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const requests = ctx.db.shareRequests
                .filter((r) => r.requester_id === user.id)
                .map((r) => ({ ...r, item: findById(ctx.db.sharedItems, r.item_id) || r.item }));
            return ok(requests);
        },
    },

    /* ----------------------------------- storage --------------------------------- */
    {
        method: 'GET',
        path: '/api/storage/my-files',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            return ok(ctx.db.files.filter((f) => f.user_id === user.id));
        },
    },
    {
        method: 'POST',
        path: '/api/storage/upload',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const name = String(ctx.body?.file?.name || ctx.body?.file_name || ctx.body?.name || 'tai-lieu.pdf');
            const file = {
                id: uid('file'),
                user_id: user.id,
                original_name: name,
                file_url: `https://edumap.vn/files/${encodeURIComponent(name)}`,
                mime_type: String(ctx.body?.file?.type || ctx.body?.mime_type || 'application/pdf'),
                size_kb: num(ctx.body?.file?.size ? Math.round(ctx.body.file.size / 1024) : ctx.body?.size_kb, 240),
                created_at: nowIso(),
            };
            ctx.db.files.unshift(file);
            return ok({ message: 'Tải lên thành công.', ...file });
        },
    },
    {
        method: 'DELETE',
        path: '/api/storage/:id',
        handler: (ctx) => {
            const index = ctx.db.files.findIndex((f) => f.id === ctx.params.id);
            if (index === -1) return notFound('Tập tin');
            ctx.db.files.splice(index, 1);
            return ok({ message: 'Đã xoá tập tin.' });
        },
    },

    /* --------------------------------- hackathons -------------------------------- */
    {
        method: 'GET',
        path: '/api/hackathons',
        handler: (ctx) => ok(byNewest(ctx.db.hackathons)),
    },
    {
        method: 'GET',
        path: '/api/hackathons/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.hackathons, ctx.params.id);
            if (!item) return notFound('Hackathon');
            const teams = ctx.db.hackathonTeams.filter((t) => t.hackathon_id === item.id);
            return ok({ ...item, teams });
        },
    },
    {
        method: 'POST',
        path: '/api/hackathons/register',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để đăng ký.');
            if (!String(ctx.body?.team_name || '').trim()) return fail(400, 'Tên đội là bắt buộc.');
            const team = {
                id: uid('team'),
                team_name: String(ctx.body.team_name),
                hackathon_id: String(ctx.body?.hackathon_id || ''),
                members: Array.isArray(ctx.body?.members) ? ctx.body.members : [user.full_name],
                owner_id: user.id,
                status: 'registered',
                created_at: nowIso(),
            };
            ctx.db.hackathonTeams.unshift(team);
            return ok({ message: 'Đăng ký đội thi thành công.', ...team });
        },
    },
    {
        method: 'POST',
        path: '/api/hackathons/teams/:id/submit',
        handler: (ctx) => {
            const team = findById(ctx.db.hackathonTeams, ctx.params.id);
            if (!team) return notFound('Đội thi');
            team.status = 'submitted';
            return ok({ message: 'Nộp sản phẩm thành công.', repo_url: String(ctx.body?.repoUrl || ''), demo_video: String(ctx.body?.demoVideo || ''), ...team });
        },
    },

    /* ------------------------------------ intl ----------------------------------- */
    {
        method: 'GET',
        path: '/api/intl/alumni/nearby',
        handler: (ctx) => {
            const lat = num(ctx.query.get('lat'), 35.6895);
            const lng = num(ctx.query.get('lng'), 139.6917);
            const items = ctx.db.alumni.map((a) => {
                const coords = a.location?.coordinates || [lng, lat];
                return { ...a, distance_km: Number(haversineKm(lat, lng, num(coords[1]), num(coords[0])).toFixed(1)) };
            }).sort((a, b) => a.distance_km - b.distance_km);
            return ok(items);
        },
    },
    {
        method: 'GET',
        path: '/api/intl/alumni',
        handler: (ctx) => ok(byNewest(ctx.db.alumni)),
    },
    {
        method: 'POST',
        path: '/api/intl/alumni',
        handler: (ctx) => {
            const item = { id: uid('alum'), status: 'pending', created_at: nowIso(), ...(ctx.body || {}) };
            ctx.db.alumni.unshift(item);
            return ok({ message: 'Đã thêm hồ sơ cựu du học sinh.', ...item });
        },
    },
    {
        method: 'GET',
        path: '/api/intl/programs',
        handler: (ctx) => {
            const type = ctx.query.get('type');
            const country = ctx.query.get('country');
            let items = byNewest(ctx.db.intlPrograms);
            if (type) items = items.filter((p) => p.type === type);
            if (country) items = items.filter((p) => matchText(p.host_country, country));
            return ok(items);
        },
    },
    {
        method: 'POST',
        path: '/api/intl/programs',
        handler: (ctx) => {
            const item = { id: uid('intl'), created_at: nowIso(), ...(ctx.body || {}) };
            ctx.db.intlPrograms.unshift(item);
            return ok({ message: 'Đã tạo chương trình quốc tế.', ...item });
        },
    },

    /* ------------------------------- learning spaces ----------------------------- */
    {
        method: 'GET',
        path: '/api/learning-spaces/recommend',
        handler: (ctx) => {
            const lat = num(ctx.query.get('lat'), 10.9576);
            const lng = num(ctx.query.get('lng'), 106.8186);
            const radius = num(ctx.query.get('radius'), 15);
            const minRating = num(ctx.query.get('min_rating'), 0);
            const quietnessMin = num(ctx.query.get('quietness_min'), 0);
            const needWifi = ctx.query.get('has_wifi') === 'true';
            const limit = num(ctx.query.get('limit'), 10);
            const spots = ctx.db.learningSpots
                .map((spot) => {
                    const coords = spot.location?.coordinates || [lng, lat];
                    const distanceKm = Number(haversineKm(lat, lng, num(coords[1]), num(coords[0])).toFixed(2));
                    return { spot, distanceKm };
                })
                .filter(({ spot, distanceKm }) => distanceKm <= radius && num(spot.rating_avg) >= minRating && num(spot.quietness) >= quietnessMin && (!needWifi || spot.has_wifi))
                .sort((a, b) => a.distanceKm - b.distanceKm)
                .slice(0, limit)
                .map(({ spot, distanceKm }, idx) => ({
                    spot,
                    score: Number((96 - idx * 4 - distanceKm).toFixed(1)),
                    distance_km: distanceKm,
                    open_now: true,
                    ranking_reason: 'Gần vị trí của bạn, đáp ứng tiêu chí wifi và độ yên tĩnh.',
                    matching_criteria: {
                        distance: Number((1 - Math.min(1, distanceKm / Math.max(1, radius))).toFixed(2)),
                        rating: num(spot.rating_avg) / 5,
                        wifi: spot.has_wifi ? 1 : 0,
                        quietness: num(spot.quietness) / 5,
                        open_now: 1,
                        capacity: Math.min(1, num(spot.total_capacity) / 300),
                    },
                }));
            return ok({ spots, total: spots.length, center: { lat, lng }, radius_km: radius, degraded: false });
        },
    },
    {
        method: 'POST',
        path: '/api/learning-spaces/explain',
        handler: (ctx) => ok({ explanation: 'Không gian này được gợi ý vì gần bạn, có wifi và độ yên tĩnh cao.', degraded: false }),
    },

    /* --------------------------------- certificates ------------------------------ */
    {
        method: 'GET',
        path: '/api/certificates/portfolio',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            return ok(ctx.db.certificates.filter((c) => c.user_id === user.id || user.role === 'admin'));
        },
    },
    {
        method: 'GET',
        path: '/api/certificates/verify/:code',
        handler: (ctx) => {
            const item = ctx.db.certificates.find((c) => c.verify_code === ctx.params.code);
            if (!item) return ok({ valid: false, message: 'Không tìm thấy chứng nhận với mã này.' });
            return ok({ valid: true, verified: true, certificate: item, message: 'Chứng nhận hợp lệ.' });
        },
    },
    {
        method: 'GET',
        path: '/api/certificates/download/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.certificates, ctx.params.id.replace(/\.pdf$/i, ''));
            if (!item) return notFound('Chứng nhận');
            return ok({ message: 'Bản mô phỏng không tạo tệp PDF thật.', certificate: item, download_url: null });
        },
    },

    /* -------------------------------- hs connection ------------------------------ */
    {
        method: 'GET',
        path: '/api/hs-connection/requests',
        handler: (ctx) => {
            const base = [
                { id: 'usr-student-1', full_name: 'Ngô Gia Hân', avatar_url: 'https://ui-avatars.com/api/?name=Gia+Han', level: 12, points: 2450, bio: 'Học sinh THPT yêu thích Toán.' },
                { id: 'usr-student-2', full_name: 'Bùi Anh Kiệt', avatar_url: 'https://ui-avatars.com/api/?name=Anh+Kiet', level: 10, points: 1980, bio: 'Lập trình viên nghiệp dư.' },
                { id: 'usr-mentor-1', full_name: 'Nguyễn Minh Khoa', avatar_url: 'https://ui-avatars.com/api/?name=Minh+Khoa', level: 20, points: 5200, bio: 'Kỹ sư phần mềm, cố vấn nghề nghiệp.' },
            ];
            return ok({
                friends: base.slice(0, 1).map((u) => ({ ...u, connection_id: 'conn-1' })),
                requests: base.slice(1, 2).map((u) => ({ ...u, connection_id: 'conn-2' })),
                suggestions: base.slice(2).map((u) => ({ ...u, connection_id: 'conn-3' })),
            });
        },
    },
    {
        method: 'POST',
        path: '/api/hs-connection/connect/:id',
        handler: (ctx) => ok({ message: 'Đã gửi lời mời kết nối.', connection_id: uid('conn'), receiver_id: ctx.params.id, status: 'pending' }),
    },
    {
        method: 'POST',
        path: '/api/hs-connection/network/respond',
        handler: (ctx) => ok({ message: 'Đã phản hồi lời mời kết nối.', status: String(ctx.body?.status || 'accepted') }),
    },
];

export { publicUser, findById, notFound, requireUser };
