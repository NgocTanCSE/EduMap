/* Auth + config routes for the frontend mock layer. */
import {
    DEMO_USER,
    bearerToken,
    createAccessToken,
    createRefreshToken,
    fail,
    getDb,
    ok,
    persistDb,
    userFromToken,
    type MockRoute,
    type MockUser,
} from '../core';

const ROLE_PROFILES: Record<string, { email: string; full_name: string; major: string }> = {
    student: { email: 'hocsinh@edumap.vn', full_name: 'Nguyễn Văn An', major: 'Khoa học Máy tính' },
    parent: { email: 'phuhuynh@edumap.vn', full_name: 'Trần Thị Mai', major: 'Phụ huynh học sinh' },
    teacher: { email: 'giaovien@edumap.vn', full_name: 'Phạm Quốc Hưng', major: 'Sư phạm STEM' },
    mentor: { email: 'mentor@edumap.vn', full_name: 'Nguyễn Minh Khoa', major: 'Kỹ thuật phần mềm' },
    school_rep: { email: 'truong@edumap.vn', full_name: 'Đại diện Trường THCS Nguyễn Trãi', major: 'Quản trị giáo dục' },
    employer: { email: 'hr@cmc.com.vn', full_name: 'Phòng Nhân sự CMC Đồng Nai', major: 'Tuyển dụng' },
    donor: { email: 'esg@cmc.com.vn', full_name: 'Quỹ CMC vì Cộng đồng', major: 'Tài trợ giáo dục' },
    admin: { email: 'admin@edumap.vn', full_name: 'Quản trị viên EduMap', major: 'Quản trị hệ thống giáo dục' },
    moderator: { email: 'moderator@edumap.vn', full_name: 'Kiểm duyệt viên EduMap', major: 'Kiểm duyệt nội dung' },
};

function userForRole(role: string): MockUser {
    const profile = ROLE_PROFILES[role] || ROLE_PROFILES.student;
    return {
        ...DEMO_USER,
        id: role === 'admin' ? DEMO_USER.id : `usr-demo-${role}`,
        email: profile.email,
        full_name: profile.full_name,
        role,
        major: profile.major,
    };
}

function authPayload(user: MockUser) {
    return {
        access_token: createAccessToken(user),
        refresh_token: createRefreshToken(user),
        userId: user.id,
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        fullName: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url,
        phone: user.phone,
        bio: user.bio,
        major: user.major,
        date_of_birth: user.date_of_birth,
    };
}

function profilePayload(user: MockUser) {
    return {
        userId: user.id,
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        fullName: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url,
        phone: user.phone,
        bio: user.bio,
        major: user.major,
        date_of_birth: user.date_of_birth,
        is_verified: true,
        created_at: '2026-01-05T02:00:00.000Z',
    };
}

function roleFromBody(body: any): string {
    const raw = String(body?.role || body?.userRole || '').trim();
    return raw || 'admin';
}

export const authRoutes: MockRoute[] = [
    {
        method: 'POST',
        path: '/api/auth/dev-login',
        handler: (ctx) => {
            const role = roleFromBody(ctx.body);
            const user = userForRole(role);
            const payload = authPayload(user);
            return ok({
                message: 'Đăng nhập chế độ dữ liệu mô phỏng thành công.',
                ...payload,
                user: profilePayload(user),
            });
        },
    },
    {
        method: 'POST',
        path: '/api/auth/login',
        handler: (ctx) => {
            const email = String(ctx.body?.email || '').trim();
            const password = String(ctx.body?.password || '');
            if (!email || !password) return fail(400, 'Vui lòng nhập email và mật khẩu.');
            if (password.length < 6) return fail(401, 'Email hoặc mật khẩu không chính xác.');
            const known = Object.values(ROLE_PROFILES).find((p) => p.email.toLowerCase() === email.toLowerCase());
            const user: MockUser = known
                ? userForRole(Object.keys(ROLE_PROFILES).find((k) => ROLE_PROFILES[k] === known) || 'student')
                : { ...DEMO_USER, id: 'usr-demo-student', email, full_name: email.split('@')[0], role: 'student' };
            return ok({ message: 'Đăng nhập thành công.', ...authPayload(user), user: profilePayload(user) });
        },
    },
    {
        method: 'POST',
        path: '/api/auth/google',
        handler: (ctx) => {
            const email = String(ctx.body?.email || 'google.user@edumap.vn');
            const role = roleFromBody(ctx.body);
            const user = userForRole(role);
            user.email = email;
            user.full_name = String(ctx.body?.full_name || user.full_name);
            if (ctx.body?.avatar_url) user.avatar_url = String(ctx.body.avatar_url);
            return ok({ message: 'Đăng nhập Google thành công.', ...authPayload(user), user: profilePayload(user) });
        },
    },
    {
        method: 'POST',
        path: '/api/auth/refresh',
        handler: (ctx) => {
            const token = bearerToken(ctx.headers) || String(ctx.body?.refreshToken || '');
            const user = userFromToken(token) || userForRole('admin');
            return ok({ message: 'Làm mới phiên đăng nhập thành công.', ...authPayload(user) });
        },
    },
    {
        method: 'GET',
        path: '/api/auth/profile',
        handler: (ctx) => {
            const user = ctx.user || userFromRoleHeader(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            return ok(profilePayload(user));
        },
    },
    {
        method: 'PATCH',
        path: '/api/auth/profile',
        handler: (ctx) => {
            const user = ctx.user || userFromRoleHeader(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const updated: MockUser = {
                ...user,
                full_name: String(ctx.body?.full_name || user.full_name),
                phone: String(ctx.body?.phone ?? user.phone ?? ''),
                bio: String(ctx.body?.bio ?? user.bio ?? ''),
                avatar_url: String(ctx.body?.avatar_url ?? user.avatar_url ?? ''),
                major: String(ctx.body?.major ?? user.major ?? ''),
                date_of_birth: String(ctx.body?.date_of_birth ?? user.date_of_birth ?? ''),
            };
            const record = getDb().adminUsers.find((u) => u.id === updated.id);
            if (record) {
                record.full_name = updated.full_name;
                persistDb();
            }
            return ok({ message: 'Cập nhật hồ sơ thành công.', ...profilePayload(updated) });
        },
    },
    {
        method: 'GET',
        path: '/api/auth/preferences',
        handler: (ctx) => {
            if (!ctx.user) return fail(401, 'Vui lòng đăng nhập.');
            return ok({
                language: 'vi',
                theme: 'light',
                notifications_enabled: true,
                privacy_level: 'public',
                notification_settings: JSON.stringify({ email: true, in_app: true, push: false }),
            });
        },
    },
    {
        method: 'PATCH',
        path: '/api/auth/preferences',
        handler: (ctx) => {
            if (!ctx.user) return fail(401, 'Vui lòng đăng nhập.');
            return ok({ message: 'Đã lưu cài đặt.', ...(ctx.body || {}) });
        },
    },
    {
        method: 'POST',
        path: '/api/auth/forgot-password',
        handler: (ctx) => {
            const email = String(ctx.body?.email || '').trim();
            if (!email) return fail(400, 'Vui lòng nhập email.');
            return ok({ message: `Nếu ${email} tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.` });
        },
    },
    {
        method: 'POST',
        path: '/api/auth/reset-password',
        handler: (ctx) => {
            if (!ctx.body?.token) return fail(400, 'Mã đặt lại mật khẩu không hợp lệ.');
            if (String(ctx.body?.newPassword || '').length < 6) return fail(400, 'Mật khẩu mới phải có ít nhất 6 ký tự.');
            return ok({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' });
        },
    },
    {
        method: 'POST',
        path: '/api/auth/change-password',
        handler: (ctx) => {
            if (!ctx.user) return fail(401, 'Vui lòng đăng nhập.');
            if (String(ctx.body?.newPassword || '').length < 6) return fail(400, 'Mật khẩu mới phải có ít nhất 6 ký tự.');
            return ok({ message: 'Đổi mật khẩu thành công.' });
        },
    },
    {
        method: 'GET',
        path: '/api/config',
        handler: () => ok({ config: { googleClientId: '', environment: 'mock', features: { mockApi: true } } }),
    },
];

function userFromRoleHeader(ctx: { headers: Headers }): MockUser | null {
    const decoded = userFromToken(bearerToken(ctx.headers));
    if (decoded) return decoded;
    const stored = getDb().adminUsers.find((u) => u.id === DEMO_USER.id);
    if (stored) {
        return { ...DEMO_USER, full_name: stored.full_name, role: stored.role };
    }
    return null;
}

export const authHelpers = { userForRole, authPayload, profilePayload };
