/* Deterministic Vietnamese AI responses for the frontend mock layer (no network calls). */
import type { MockDb } from './seed';
import { haversineKm, num } from './core';

export interface AiSource {
    id?: string;
    title: string;
    url?: string;
    type?: string;
    snippet?: string;
    score?: number;
}

interface Topic {
    key: string;
    answer: string;
    keywords: string[];
    sources: AiSource[];
}

const TOPICS: Topic[] = [
    {
        key: 'scholarship',
        keywords: ['học bổng', 'hoc bong', 'du học', 'du hoc', 'mext', 'vallet', 'koica', 'fulbright'],
        answer:
            'Dựa trên dữ liệu học bổng đang mở trong EduMap, bạn nên ưu tiên ba nhóm sau:\n\n' +
            '1. Học bổng toàn phần Chính phủ Nhật Bản (MEXT) — phù hợp nếu bạn có GPA từ 3.0/4.0 và chứng chỉ ngoại ngữ. Hạn nộp còn khoảng 45 ngày.\n' +
            '2. Học bổng Khuyến khích Học tập DNTU — dành cho sinh viên đang theo học tại trường, giá trị 15 triệu đồng.\n' +
            '3. Học bổng Nữ sinh STEM 2026 — dành cho nữ sinh từ 16 đến 22 tuổi theo đuổi lĩnh vực STEM.\n\n' +
            'Chuẩn bị hồ sơ gồm: bảng điểm, thư giới thiệu, bài luận cá nhân và chứng chỉ ngoại ngữ. Bạn có thể bấm "Kiểm tra điều kiện" trên trang học bổng để xem mức độ phù hợp với hồ sơ hiện tại.',
        sources: [],
    },
    {
        key: 'career',
        keywords: ['việc làm', 'viec lam', 'nghề', 'nghe', 'lộ trình', 'lo trinh', 'kỹ năng', 'ky nang', 'thực tập', 'thuc tap'],
        answer:
            'Với mục tiêu nghề nghiệp trong lĩnh vực công nghệ, lộ trình gợi ý gồm bốn giai đoạn:\n\n' +
            '• Nền tảng (2–3 tháng): tư duy lập trình, cấu trúc dữ liệu, Git.\n' +
            '• Chuyên môn (3–4 tháng): một ngôn ngữ chính (TypeScript hoặc Python), REST API, cơ sở dữ liệu quan hệ.\n' +
            '• Thực chiến (3 tháng): làm một dự án hoàn chỉnh và viết README rõ ràng.\n' +
            '• Tìm việc (1–2 tháng): hoàn thiện CV, luyện phỏng vấn kỹ thuật, ứng tuyển các vị trí thực tập.\n\n' +
            'Trang Việc làm đang có 8 tin tuyển dụng và 5 chương trình thực tập phù hợp với sinh viên mới ra trường. Bạn nên nộp 3–5 vị trí mỗi tuần và ghi lại phản hồi để điều chỉnh CV.',
        sources: [],
    },
    {
        key: 'map',
        keywords: ['bản đồ', 'ban do', 'gần', 'gan', 'thư viện', 'thu vien', 'trường', 'truong', 'địa điểm', 'dia diem', 'wifi'],
        answer:
            'Trên bản đồ EduMap khu vực Biên Hoà – Đồng Nai, các địa điểm học tập nổi bật gồm:\n\n' +
            '• Thư viện tỉnh Đồng Nai (10.9576, 106.8186) — phòng đọc yên tĩnh, wifi miễn phí, có ổ điện.\n' +
            '• Trung tâm Học liệu DNTU (10.9748, 106.8461) — không gian học nhóm và phòng đọc cá nhân.\n' +
            '• Cà phê Học tập An Nhiên (10.9521, 106.8421) — yên tĩnh, phù hợp học cá nhân buổi sáng.\n\n' +
            'Bạn có thể dùng công cụ "Gợi ý không gian học" để lọc theo khoảng cách, wifi, độ yên tĩnh và sức chứa.',
        sources: [],
    },
    {
        key: 'community',
        keywords: ['cộng đồng', 'cong dong', 'nhóm', 'nhom', 'chia sẻ', 'chia se', 'hỏi', 'hoi'],
        answer:
            'Cộng đồng EduMap hiện có bốn nhóm chính: Học tập THPT, CNTT & Lập trình, Du học & Học bổng và Ngoại ngữ. ' +
            'Các bài viết nổi bật gồm kinh nghiệm ôn thi THPT môn Toán, tìm đồng đội Hackathon EduMap 2026 và review học bổng MEXT.\n\n' +
            'Nếu bạn cần tìm đồng đội, hãy đăng bài trong nhóm CNTT & Lập trình kèm kỹ năng và thời gian rảnh. Nếu bạn cần tài liệu, ' +
            'mục Thư viện có 12 học liệu đã được kiểm chứng nguồn.',
        sources: [],
    },
    {
        key: 'default',
        keywords: [],
        answer:
            'Mình đã ghi nhận câu hỏi của bạn. EduMap hiện tổng hợp dữ liệu về học bổng, việc làm, thực tập, cơ hội du học, ' +
            'không gian học tập và hoạt động cộng đồng tại Việt Nam.\n\n' +
            'Bạn có thể hỏi cụ thể hơn, ví dụ: "Học bổng nào phù hợp với GPA 3.2?", "Tìm thư viện gần Đại học Công nghệ Đồng Nai" ' +
            'hoặc "Lộ trình trở thành kỹ sư backend gồm những gì?". Mình sẽ trả lời dựa trên dữ liệu đang có trong hệ thống.',
        sources: [],
    },
];

function normalize(value: string): string {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export function pickTopic(question: string): Topic {
    const plain = normalize(question);
    for (const topic of TOPICS) {
        if (topic.key === 'default') continue;
        if (topic.keywords.some((k) => plain.includes(normalize(k)))) return topic;
    }
    return TOPICS[TOPICS.length - 1];
}

function scholarshipSources(db: MockDb): AiSource[] {
    return db.scholarships.slice(0, 3).map((s) => ({
        id: s.id,
        title: s.title,
        url: s.apply_url,
        type: 'scholarship',
        snippet: `${s.provider} · hạn nộp ${String(s.deadline).slice(0, 10)}`,
        score: 0.86,
    }));
}

function poiSources(db: MockDb): AiSource[] {
    return db.pois.slice(0, 3).map((p) => ({
        id: p.id,
        title: p.name,
        url: `/map?poi=${p.id}`,
        type: 'poi',
        snippet: p.address,
        score: 0.82,
    }));
}

function librarySources(db: MockDb): AiSource[] {
    return db.libraryResources.slice(0, 3).map((r) => ({
        id: r.id,
        title: r.title,
        url: r.file_url,
        type: 'library',
        snippet: r.description,
        score: 0.78,
    }));
}

export function buildChatReply(db: MockDb, question: string): { answer: string; sources: AiSource[] } {
    const topic = pickTopic(question);
    if (topic.key === 'scholarship') return { answer: topic.answer, sources: scholarshipSources(db) };
    if (topic.key === 'map') return { answer: topic.answer, sources: poiSources(db) };
    if (topic.key === 'career') {
        const sources: AiSource[] = db.careerPaths.slice(0, 2).map((c) => ({
            id: c.id,
            title: c.title,
            url: `/career/roadmap`,
            type: 'career',
            snippet: c.description,
            score: 0.8,
        }));
        return { answer: topic.answer, sources: sources.concat(librarySources(db).slice(0, 1)) };
    }
    if (topic.key === 'community') return { answer: topic.answer, sources: librarySources(db) };
    return { answer: topic.answer, sources: librarySources(db).slice(0, 2) };
}

export function buildAgentReply(question: string): { content: string; tool_calls: string[]; sources: AiSource[] } {
    const plain = normalize(question);
    const tools: string[] = [];
    if (/ban do|gan|thu vien|dia diem/.test(plain)) tools.push('search_map_pois');
    if (/hoc bong|du hoc/.test(plain)) tools.push('search_scholarships');
    if (/viec lam|thuc tap|nghe/.test(plain)) tools.push('search_jobs');
    if (tools.length === 0) tools.push('search_library');

    const content =
        `Mình đã chạy ${tools.length} công cụ nội bộ để trả lời câu hỏi của bạn.\n\n` +
        'Kết quả nổi bật:\n' +
        '• 8 học bổng đang mở, gần nhất là Học bổng Đồng hành cùng Học sinh Nghèo hiếu học (còn 15 ngày).\n' +
        '• 8 tin việc làm và 5 chương trình thực tập tại Đồng Nai, TP.HCM và Hà Nội.\n' +
        '• 12 học liệu số trong Thư viện EduMap.\n\n' +
        'Bạn muốn mình đi sâu vào nhóm nào trước? Mình có thể lọc theo khu vực, mức lương hoặc điều kiện hồ sơ.';

    return {
        content,
        tool_calls: tools,
        sources: [
            { title: 'Danh sách học bổng', type: 'scholarship', url: '/scholarships', score: 0.8 },
            { title: 'Việc làm & thực tập', type: 'job', url: '/career/jobs', score: 0.76 },
        ],
    };
}

export function buildLearningPath(targetRole: string, currentLevel: string) {
    const role = targetRole || 'Kỹ sư Phần mềm';
    const level = currentLevel || 'beginner';
    const months = level === 'advanced' ? 4 : level === 'intermediate' ? 6 : 9;
    return {
        id: `lp-${normalize(role).replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
        target_role: role,
        current_level: level,
        steps: [
            { title: 'Đánh giá nền tảng hiện có', description: 'Kiểm tra kiến thức nhập môn và xác định lỗ hổng cần bù.', duration: 'Tuần 1' },
            { title: 'Học chuyên môn cốt lõi', description: `Tập trung vào các kỹ năng bắt buộc của vị trí ${role}.`, duration: '4–8 tuần' },
            { title: 'Dự án thực chiến', description: 'Xây dựng một sản phẩm nhỏ, có README và demo trực tuyến.', duration: '4 tuần' },
            { title: 'Chuẩn bị tuyển dụng', description: 'Hoàn thiện CV, luyện phỏng vấn và ứng tuyển có mục tiêu.', duration: '2 tuần' },
        ],
        resources: [
            { title: 'Giáo trình Lập trình TypeScript cơ bản', url: 'https://developer.mozilla.org/vi/docs/Web/JavaScript' },
            { title: 'Nhập môn Trí tuệ Nhân tạo', url: 'https://arxiv.org/' },
            { title: 'Cẩm nang Hướng nghiệp cho Học sinh THPT', url: 'https://edumap.vn' },
        ],
        estimated_duration: `${months} tháng`,
    };
}

export function buildPdfTranscript() {
    return {
        student_name: 'Nguyễn Văn A',
        gpa: '3.42',
        overall_grade: 'Giỏi',
        courses: [
            { course: 'Lập trình hướng đối tượng', credit: '3', grade: 'A' },
            { course: 'Cơ sở dữ liệu', credit: '3', grade: 'B+' },
            { course: 'Toán rời rạc', credit: '3', grade: 'A' },
            { course: 'Mạng máy tính', credit: '3', grade: 'B' },
            { course: 'Tiếng Anh chuyên ngành', credit: '2', grade: 'A' },
        ],
    };
}

export function buildResourceSummary(title: string) {
    return (
        `Tóm tắt: ${title}\n\n` +
        'Tài liệu trình bày các khái niệm cốt lõi theo trình tự từ cơ bản đến nâng cao, kèm ví dụ minh hoạ và bài tập thực hành. ' +
        'Phần đầu giới thiệu bối cảnh và mục tiêu; phần giữa đi vào phương pháp, công cụ và quy trình; phần cuối tổng hợp lỗi thường gặp ' +
        'và danh mục tài liệu tham khảo.\n\n' +
        'Gợi ý sử dụng: đọc chương 1–2 để nắm nền tảng, làm bài tập chương 3, sau đó áp dụng vào một dự án nhỏ. ' +
        'Nếu bạn cần bản giải thích dễ hiểu hơn, hãy dùng Language Bridge AI để rút gọn theo cấp học.'
    );
}

export function buildDailyInsight(db: MockDb) {
    const openScholarships = db.scholarships.filter((s) => s.status === 'open').length;
    return {
        motivation_message:
            'Mỗi ngày một bước nhỏ vẫn đưa bạn đến gần mục tiêu hơn. Hôm nay hãy dành 25 phút cho việc học quan trọng nhất.',
        suggested_action: `Có ${openScholarships} học bổng đang mở — hãy kiểm tra điều kiện của một học bổng phù hợp với hồ sơ của bạn.`,
    };
}

export function buildImpactReport(region = 'Biên Hòa, Đồng Nai') {
    const beforeAccess = 42.5;
    const afterAccess = 68.9;
    const beforeUsers = 18400;
    const afterUsers = 29650;
    const monthly = [
        { month: '2025-01', facilities_added: 2, cumulative: 2, beneficiaries: 18400 },
        { month: '2025-02', facilities_added: 1, cumulative: 3, beneficiaries: 20300 },
        { month: '2025-03', facilities_added: 3, cumulative: 6, beneficiaries: 22800 },
        { month: '2025-04', facilities_added: 2, cumulative: 8, beneficiaries: 25100 },
        { month: '2025-05', facilities_added: 2, cumulative: 10, beneficiaries: 27400 },
        { month: '2025-06', facilities_added: 1, cumulative: 11, beneficiaries: 29650 },
    ];
    return {
        region,
        bbox: [10.9, 10.9, 11.0, 107.0],
        population_estimate: 1250000,
        before: {
            period: '2024-07 đến 2024-12',
            access_rate: beforeAccess,
            user_count: beforeUsers,
            facility_count: 42,
            usage_count: 58200,
            synthetic_baseline: false,
        },
        after: {
            period: '2025-01 đến 2025-06',
            access_rate: afterAccess,
            user_count: afterUsers,
            facility_count: 53,
            usage_count: 91400,
            synthetic_baseline: false,
        },
        diff: {
            access_rate_delta: Number((afterAccess - beforeAccess).toFixed(1)),
            user_count_delta: afterUsers - beforeUsers,
            usage_count_delta: 91400 - 58200,
            coverage_improvement_pct: Number((((afterAccess - beforeAccess) / beforeAccess) * 100).toFixed(1)),
        },
        deployment_timeline: monthly.map((m) => ({ month: m.month, facilities_added: m.facilities_added, cumulative: m.cumulative })),
        people_in_radius: {
            before: 18400,
            after: 29650,
            delta: 11250,
            radius_km: 5,
        },
        trend: {
            monthly,
            growth_rate_pct: 61.1,
            trend: 'increasing',
        },
        impact_score: 74.6,
        confidence_interval: {
            lower: 69.2,
            upper: 80.1,
            level: 0.95,
            method: 'Wilson score interval',
        },
        causal_notes: [
            'Số người tiếp cận tăng sau khi 11 điểm truy cập mới đi vào hoạt động.',
            'Chưa loại trừ được yếu tố tăng dân số và mùa tuyển sinh.',
            'Dữ liệu "trước" lấy từ báo cáo cơ sở giáo dục, không phải khảo sát thực địa.',
        ],
        narrative:
            'Trong giai đoạn 6 tháng, tỷ lệ tiếp cận dịch vụ giáo dục tại khu vực tăng từ 42,5% lên 68,9% ' +
            '(tăng 26,4 điểm phần trăm). Số người dùng ước tính tăng thêm 11.250 người. Điểm tác động tổng hợp đạt 74,6/100, ' +
            'cho thấy can thiệp có hiệu quả rõ rệt nhưng vẫn cần khảo sát thực địa để củng cố kết luận nhân quả.',
        metadata: { source: 'edumap-mock', provider: 'template', cached: false },
        degraded: false,
    };
}

export function buildImpactCached(regionId: string) {
    const names: Record<string, string> = {
        dong_nai: 'Biên Hòa, Đồng Nai',
        hcmc: 'TP. Hồ Chí Minh',
        hanoi: 'Hà Nội',
        danang: 'Đà Nẵng',
        cantho: 'Cần Thơ',
    };
    return {
        status: 'ready',
        region_id: regionId,
        generated_at: new Date().toISOString(),
        data: buildImpactReport(names[regionId] || 'Biên Hòa, Đồng Nai'),
        degraded: false,
    };
}

export function buildQuestionGapReport() {
    const clusters = [
        {
            cluster_id: 0,
            topic: 'Học bổng và điều kiện xét tuyển',
            total_queries: 128,
            gap_count: 34,
            gap_rate: 26.6,
            top_terms: ['học bổng', 'điều kiện', 'gpa', 'hạn nộp'],
            representative_query: 'Học bổng MEXT cần GPA bao nhiêu?',
            gap_queries: ['Học bổng MEXT cần GPA bao nhiêu?', 'Có học bổng nào cho sinh viên năm 1 không?'],
            recommended_docs: ['Bảng điều kiện học bổng 2026', 'Hướng dẫn hồ sơ MEXT'],
        },
        {
            cluster_id: 1,
            topic: 'Thủ tục hành chính giáo dục',
            total_queries: 86,
            gap_count: 21,
            gap_rate: 24.4,
            top_terms: ['thủ tục', 'hồ sơ', 'xác nhận', 'bảng điểm'],
            representative_query: 'Thủ tục xin xác nhận bảng điểm như thế nào?',
            gap_queries: ['Thủ tục xin xác nhận bảng điểm như thế nào?'],
            recommended_docs: ['Quy trình xác nhận văn bằng tại Đồng Nai'],
        },
        {
            cluster_id: 2,
            topic: 'Kỹ năng và lộ trình nghề nghiệp',
            total_queries: 74,
            gap_count: 12,
            gap_rate: 16.2,
            top_terms: ['lộ trình', 'kỹ năng', 'thực tập', 'phỏng vấn'],
            representative_query: 'Lộ trình học backend cho người mới bắt đầu?',
            gap_queries: ['Lộ trình học backend cho người mới bắt đầu?'],
            recommended_docs: ['Lộ trình Kỹ sư Phần mềm (Backend)'],
        },
    ];
    return {
        status: 'success',
        degraded: false,
        generated_at: new Date().toISOString(),
        total_queries: 288,
        date_range: { start: '2026-10-09', end: '2026-11-08' },
        limit_applied: 10000,
        privacy: { user_id_hashed: true, hash_algorithm: 'sha256', ttl_days: 30 },
        clusters,
        top_gaps: [
            { query_text: 'Học bổng MEXT cần GPA bao nhiêu?', retrieved_doc_count: 0, retrieval_status: 'failed', response_quality: 0.21, created_at: '2026-11-06T09:12:00.000Z' },
            { query_text: 'Thủ tục xin xác nhận bảng điểm như thế nào?', retrieved_doc_count: 0, retrieval_status: 'failed', response_quality: 0.18, created_at: '2026-11-05T14:40:00.000Z' },
            { query_text: 'Học bổng cho sinh viên năm 1?', retrieved_doc_count: 1, retrieval_status: 'partial', response_quality: 0.29, created_at: '2026-11-04T08:05:00.000Z' },
        ],
        summary:
            'Ba nhóm chủ đề chiếm phần lớn câu hỏi chưa được trả lời tốt: điều kiện học bổng, thủ tục hành chính và lộ trình nghề nghiệp. ' +
            'Nên bổ sung tài liệu chuẩn cho hai nhóm đầu tiên.',
        cached: false,
        source: 'edumap-mock',
    };
}

export function buildDataQualityReport(db: MockDb) {
    const anomalies = db.pois.slice(0, 5).map((p, idx) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        address: p.address || null,
        city: 'Biên Hoà',
        district: null,
        source: p.source,
        updated_at: p.verified ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        anomaly_types: idx % 2 === 0 ? ['missing_phone'] : ['duplicate_candidate'],
        reasons: idx % 2 === 0 ? ['Thiếu số điện thoại liên hệ'] : ['Trùng toạ độ với điểm khác trong bán kính 50 m'],
        confidence: Number((0.72 - idx * 0.06).toFixed(2)),
        priority: idx < 2 ? 'high' : idx < 4 ? 'medium' : 'low',
        iforest_score: Number((0.61 - idx * 0.04).toFixed(2)),
    }));
    return {
        summary: {
            total_checked: db.pois.length,
            total_anomalies: anomalies.length,
            anomaly_rate: Number((anomalies.length / Math.max(1, db.pois.length)).toFixed(3)),
            by_category: { school: 2, university: 2, library: 1 },
            priority_breakdown: { high: 2, medium: 2, low: 1 },
            degraded: false,
        },
        anomalies,
        source_counts: { 'Bản đồ giáo dục EduMap': 15, 'Cộng đồng EduMap': 10 },
    };
}

export function buildGapForecast(db: MockDb, gridSizeKm = 2) {
    const features = db.pois.slice(0, 12).map((p, idx) => {
        const riskScore = Number((0.86 - idx * 0.045).toFixed(2));
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: {
                cell_id: `cell-${idx + 1}`,
                area: `${p.name} — ${p.category}`,
                gap_score: Number((0.85 - idx * 0.05).toFixed(2)),
                risk_score: riskScore,
                risk_score_pct: Number((riskScore * 100).toFixed(1)),
                risk_level: riskScore > 0.65 ? 'high' : riskScore > 0.4 ? 'medium' : 'low',
                needs_survey: idx < 4,
                point_count: 1 + (idx % 5),
                trend: idx % 2 === 0 ? 'tăng nhu cầu' : 'ổn định',
                predicted_demand: 120 - idx * 6,
                supply: 20 + idx * 3,
                category: p.category,
                priority: idx < 4 ? 'high' : idx < 8 ? 'medium' : 'low',
                reason: 'Mật độ điểm giáo dục thấp hơn nhu cầu ước tính.',
                confidence: 0.78,
            },
        };
    });
    const riskRanking = features.map((feature) => ({
        area: feature.properties.area,
        risk_level: feature.properties.risk_level,
        risk_score: feature.properties.risk_score,
        needs_survey: feature.properties.needs_survey,
    }));
    return {
        type: 'FeatureCollection',
        features,
        heat_points: features.map((feature) => ({
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0],
            intensity: feature.properties.risk_score,
        })),
        risk_ranking: riskRanking,
        trends: [
            { metric_type: 'Tuyển sinh đại học', growth_pct: 8.4, risk_score: 0.42, risk_level: 'medium' },
            { metric_type: 'Nhu cầu phòng lab', growth_pct: 12.1, risk_score: 0.68, risk_level: 'high' },
            { metric_type: 'Tỷ lệ học trực tuyến', growth_pct: 4.7, risk_score: 0.31, risk_level: 'low' },
        ],
        summary: {
            grid_size_km: gridSizeKm,
            total_cells: features.length,
            gap_cells: features.filter((f) => f.properties.priority === 'high').length,
            total_points: db.pois.length,
            poi_count: db.pois.length,
        },
        attribute_gaps: {
            phone: { pct: 34.5 },
            website: { pct: 41.2 },
            opening_hours: { pct: 58.7 },
            description: { pct: 12.4 },
        },
        metadata: {
            degraded: false,
            reason: null,
            cached: null,
            steps_ahead: 6,
            data_source: 'edumap-mock',
            solver: 'heuristic',
        },
    };
}

export function buildDataGaps(db: MockDb, category?: string) {
    const pool = category ? db.pois.filter((p) => p.category === category) : db.pois;
    const features = pool.slice(0, 15).map((p, idx) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
            id: p.id,
            cell_id: `cell-${idx + 1}`,
            area: `${p.name} — ${p.category}`,
            name: p.name,
            category: p.category,
            gap_score: Number((0.9 - idx * 0.04).toFixed(2)),
            nearest_poi_distance_km: Number((0.4 + idx * 0.35).toFixed(2)),
            missing_fields: idx % 3 === 0 ? ['phone', 'website'] : ['opening_hours'],
            priority: idx < 5 ? 'high' : 'medium',
            suggestion: 'Bổ sung thông tin liên hệ và giờ mở cửa.',
        },
    }));
    return {
        type: 'FeatureCollection',
        features,
        summary: { total_points: pool.length, poi_count: pool.length, gap_cells: features.length, total_cells: features.length, grid_size_km: 1.5 },
        metadata: { degraded: false, reason: null, cached: null, data_source: 'edumap-mock' },
    };
}

export function buildResourceOptimization(db: MockDb, budget = 30000000) {
    const planIds = ['A', 'B', 'C'];
    const features = db.pois.slice(0, 10).map((p, idx) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
            id: p.id,
            name: p.name,
            category: p.category,
            plan: planIds[idx % planIds.length],
            current_resources: 3 + (idx % 4),
            recommended_resources: 5 + (idx % 5),
            gap: 2 + (idx % 3),
            priority: idx < 3 ? 'high' : 'medium',
        },
    }));
    const coverage: Record<string, number> = { A: 62.4, B: 78.1, C: 91.6 };
    const plans: Record<string, Record<string, any>> = {};
    planIds.forEach((id) => {
        plans[id] = {
            coverage_pct: coverage[id],
            estimated_cost: Math.round(budget * ((planIds.indexOf(id) + 1) / 3)),
            facilities: features.filter((feature) => feature.properties.plan === id).length,
        };
    });
    return {
        type: 'FeatureCollection',
        features,
        plans,
        gaps: [
            { category: 'library', gap_count: 3, region: 'Trảng Dài' },
            { category: 'stem', gap_count: 2, region: 'Tân Tiến' },
        ],
        recommendations: [
            { action: 'Bổ sung 4 máy tính cho phòng tin học', target: 'Trường THCS Nguyễn Trãi', estimated_cost: 72000000, impact: 'high' },
            { action: 'Mở thêm 2 ca đọc buổi tối', target: 'Thư viện tỉnh Đồng Nai', estimated_cost: 12000000, impact: 'medium' },
        ],
        summary: { budget, total_points: db.pois.length, poi_count: db.pois.length, demand_count: 48, candidate_count: features.length, total_cells: 10, grid_size_km: 2 },
        metadata: { degraded: false, reason: null, cached: null, solver: 'greedy', data_source: 'edumap-mock' },
    };
}

export function buildSurveyPriorities(db: MockDb, topN = 10) {
    const features = db.pois.slice(0, Math.min(topN, 12)).map((p, idx) => {
        const infoValue = Number((0.92 - idx * 0.05).toFixed(2));
        const cost = Number((0.6 + idx * 0.12).toFixed(2));
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: {
                id: p.id,
                name: p.name,
                category: p.category,
                priority_score: Number((infoValue / cost).toFixed(3)),
                info_value: infoValue,
                cost_hours: cost,
                uncertainty: Number((0.8 - idx * 0.03).toFixed(2)),
                reason: 'Độ bất định cao và chi phí khảo sát thấp.',
                verification_date: '2026-11-08',
            },
        };
    });
    return {
        type: 'FeatureCollection',
        features,
        summary: { total_points: db.pois.length, poi_count: db.pois.length, candidate_count: features.length, grid_size_km: 1 },
        next_point: features[0] ? { lat: features[0].geometry.coordinates[1], lng: features[0].geometry.coordinates[0], name: features[0].properties.name, priority_score: features[0].properties.priority_score } : null,
        metadata: { degraded: false, reason: null, cached: null, data_source: 'edumap-mock' },
    };
}

export function buildClimateRisk(db: MockDb) {
    const features = db.pois.slice(0, 12).map((p, idx) => {
        const risk = Number((0.82 - idx * 0.05).toFixed(2));
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: {
                id: p.id,
                name: p.name,
                category: p.category,
                risk_score: risk,
                risk_score_pct: Number((risk * 100).toFixed(1)),
                risk_level: risk > 0.6 ? 'cao' : risk > 0.35 ? 'trung bình' : 'thấp',
                flood_risk: Number((risk * 0.9).toFixed(2)),
                weather_risk: Number((risk * 0.7).toFixed(2)),
                access_risk: Number((risk * 0.5).toFixed(2)),
                elevation_m: 6 + idx * 2,
                nearest_facility: db.pois[(idx + 1) % db.pois.length]?.name || null,
                level: risk > 0.6 ? 'high' : risk > 0.35 ? 'medium' : 'low',
                reason: 'Khu vực có nguy cơ ngập cục bộ trong mùa mưa.',
            },
        };
    });
    return {
        type: 'FeatureCollection',
        features,
        heat_points: features.map((feature) => ({
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0],
            intensity: feature.properties.risk_score,
        })),
        risk_ranking: features.map((f) => ({ id: f.properties.id, name: f.properties.name, risk_score: f.properties.risk_score, risk_level: f.properties.risk_level })),
        trends: [
            { month: '2026-06', avg_risk: 0.52 },
            { month: '2026-07', avg_risk: 0.61 },
            { month: '2026-08', avg_risk: 0.66 },
            { month: '2026-09', avg_risk: 0.71 },
            { month: '2026-10', avg_risk: 0.64 },
            { month: '2026-11', avg_risk: 0.49 },
        ],
        metadata: {
            degraded: false,
            reason: null,
            cached: null,
            flood_zones_loaded: 4,
            has_weather: false,
            season: 'mùa mưa',
            month: 11,
        },
    };
}

export function buildClimateAlternatives(db: MockDb) {
    const features = db.pois
        .filter((p) => ['library', 'university', 'college'].includes(p.category))
        .slice(0, 5)
        .map((p, idx) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: {
                id: `alt-${idx + 1}`,
                name: p.name,
                category: p.category,
                risk_score: Number((0.18 + idx * 0.03).toFixed(2)),
                safety_score: Number((0.92 - idx * 0.06).toFixed(2)),
                distance_km: Number((1.2 + idx * 0.8).toFixed(1)),
                walk_time_min: 15 + idx * 6,
                elevation_m: 12 + idx * 4,
                address: p.address,
                reason: 'Cao hơn mực nước ngập dự báo và có lộ trình tiếp cận an toàn.',
            },
        }));
    return {
        type: 'FeatureCollection',
        features,
        alternatives: features.map((f) => f.properties),
        metadata: { degraded: false, reason: null, cached: null, flood_zones_loaded: 4, has_weather: false },
    };
}

export function buildVisionDetect(
    db: MockDb,
    lat: number,
    lng: number,
    bbox: [number, number, number, number] = [lng - 0.004, lat - 0.004, lng + 0.004, lat + 0.004],
    labels: string[] = ['school building', 'sports field', 'classroom block'],
) {
    const usedLabels = labels.length ? labels : ['school building'];
    const detections = [0, 1, 2].map((idx) => {
        const dLat = lat + (idx - 1) * 0.0012;
        const dLng = lng + (idx - 1) * 0.0014;
        const known = db.pois.find((p) => haversineKm(p.lat, p.lng, dLat, dLng) < 0.15);
        return {
            label: usedLabels[idx % usedLabels.length],
            score: Number(((0.82 - idx * 0.09) * 100).toFixed(1)),
            bbox: [120 + idx * 40, 90 + idx * 30, 220 + idx * 40, 190 + idx * 30],
            lat: dLat,
            lng: dLng,
            match: known ? 'known' : 'new',
            status: known ? 'known' : 'new',
            nearest_poi: known ? known.name : null,
            nearest_poi_id: known ? known.id : null,
            nearest_poi_distance_m: known ? Math.round(haversineKm(known.lat, known.lng, dLat, dLng) * 1000) : null,
        };
    });
    return {
        bbox,
        detections,
        image_size: { width: 1024, height: 1024 },
        tile: { zoom: 18, tiles: 16, source: 'carto' },
        model: 'google/owlv2-base-patch16-ensemble',
        degraded: false,
        reason: null,
        cached: false,
        metadata: { degraded: false, reason: null, cached: false, provider: 'edumap-mock' },
    };
}

export function buildRouteExplain(routes: any[], preferences: any) {
    const primary = Array.isArray(routes) && routes.length > 0 ? routes[0] : null;
    if (!primary) {
        return { explanation: 'Không có lộ trình nào để giải thích.', reason: 'empty_routes', degraded: true };
    }
    const safety = num(primary.safetyScore, 0);
    const flood = Array.isArray(primary.floodWarnings) ? primary.floodWarnings.length : 0;
    const distanceKm = num(primary.distance, 0) / 1000;
    return {
        explanation:
            `Lộ trình chính dài ${distanceKm.toFixed(1)} km với điểm an toàn ${Math.round(safety)}/100. ` +
            (flood > 0 ? `Có ${flood} cảnh báo ngập trên tuyến, đã được cân nhắc khi chọn đường. ` : 'Không phát hiện cảnh báo ngập trên tuyến. ') +
            `Hệ số ưu tiên an toàn đang đặt ở ${preferences?.safetyWeight ?? 0.3}. ` +
            'Tuyến được chọn vì cân bằng giữa thời gian di chuyển và mức rủi ro thấp hơn các phương án còn lại.',
        reason: 'template',
        provider: 'edumap-mock',
        degraded: false,
    };
}

export function buildNlSearch(db: MockDb, query: string) {
    const plain = normalize(query);
    const matched = db.pois.filter(
        (p) => normalize(p.name).includes(plain) || normalize(p.address).includes(plain) || normalize(p.category).includes(plain),
    );
    const results = (matched.length > 0 ? matched : db.pois.slice(0, 5)).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        description: p.description,
        address: p.address,
        rating_avg: p.rating_avg,
        score: 0.9,
    }));
    const intent =
        /báo|bao|hỏng|hong|sự cố|su co/.test(plain)
            ? 'report_form'
            : /ở đâu|o dau|là gì|la gi|bao nhiêu|bao nhieu/.test(plain)
              ? 'geo_query'
              : 'geo_recommend';
    return {
        query,
        results,
        total: results.length,
        intent: { intent, confidence: 0.87, keywords: [query] },
        degraded: false,
    };
}

export function buildSimplify(text: string, difficulty: string) {
    const level = difficulty || 'middle';
    const label =
        level === 'elementary' ? 'lớp 1–3' : level === 'high' ? 'THPT' : level === 'college' ? 'đại học' : 'THCS';
    return {
        simplified:
            `Giải thích theo mức ${label}: ${text}\n\n` +
            'Nói ngắn gọn: nội dung trên gồm một ý chính và hai ý hỗ trợ. Ý chính cho biết vấn đề là gì; hai ý sau giải thích vì sao và cần làm gì tiếp theo. ' +
            'Nếu gặp từ chuyên môn, hãy đọc phần "Thuật ngữ được giải thích" bên dưới.',
        explained_terms: {
            'AI': 'Trí tuệ nhân tạo — máy tính học từ dữ liệu để đưa ra dự đoán.',
            'GPA': 'Điểm trung bình tích luỹ của quá trình học.',
            'STEM': 'Nhóm môn Khoa học, Công nghệ, Kỹ thuật và Toán.',
        },
        degraded: false,
        reason: null,
        difficulty: level,
        cached: false,
        created_at: new Date().toISOString(),
    };
}

export function buildTranslate(text: string, targetLanguage: string) {
    return {
        translated:
            targetLanguage === 'en'
                ? `Translation (English): ${text}`
                : targetLanguage === 'ja'
                  ? `翻訳（日本語）: ${text}`
                  : `Bản dịch (${targetLanguage}): ${text}`,
        detected_source: 'vi',
        degraded: false,
        reason: null,
        target_language: targetLanguage || 'en',
        cached: false,
        created_at: new Date().toISOString(),
    };
}

export function buildTts(text: string, language: string) {
    return {
        audio_base64: null,
        audio_format: 'mp3',
        duration_ms: Math.max(1500, Math.round(String(text || '').length * 55)),
        provider: 'browser-fallback',
        degraded: true,
        reason: 'Trình duyệt sẽ đọc văn bản bằng Web Speech API.',
        language: language || 'vi',
        cached: false,
        created_at: new Date().toISOString(),
    };
}

export function buildTutorReply(action: string, message: string) {
    const templates: Record<string, string> = {
        explain: `Giải thích: ${message}\n\nĐể hiểu nội dung này, hãy chia thành ba phần: (1) định nghĩa, (2) ví dụ cụ thể, (3) bài tập tự kiểm tra. Hãy bắt đầu từ định nghĩa ngắn gọn, sau đó nối với ví dụ gần gũi trong đời sống học tập.`,
        practice: `Bài luyện tập: ${message}\n\n1. Tóm tắt nội dung trong 3 câu.\n2. Nêu một ví dụ và một phản ví dụ.\n3. Giải thích lại cho một bạn cùng lớp trong 2 phút.`,
        suggest: `Gợi ý học tập cho: ${message}\n\n• Học 25 phút, nghỉ 5 phút (Pomodoro).\n• Ghi chú bằng sơ đồ tư duy sau mỗi chương.\n• Tự đặt 3 câu hỏi và trả lời không nhìn tài liệu.\n• Ôn lại sau 1 ngày, 1 tuần và 1 tháng.`,
    };
    return {
        reply: templates[action] || templates.explain,
        source: 'template',
        degraded: false,
    };
}

export function buildResourceMatch(db: MockDb) {
    const resources = db.exchangeResources.filter((r) => r.status === 'available').slice(0, 4);
    const requests = db.exchangeRequests.filter((r) => r.status === 'open').slice(0, 4);
    const ranked: any[] = [];
    for (const resource of resources) {
        for (const request of requests) {
            if (resource.type !== request.need_type) continue;
            ranked.push({
                resource_id: resource.id,
                request_id: request.id,
                match_score: 82,
                explanation: 'Cùng loại tài nguyên, vị trí gần và tình trạng đáp ứng yêu cầu tối thiểu.',
                match_reasons: ['Cùng loại tài nguyên', 'Khoảng cách dưới 10 km', 'Tình trạng tốt hơn mức yêu cầu'],
                next_steps: ['Liên hệ người cung cấp để xác nhận', 'Chọn thời gian nhận tại điểm hẹn'],
                scheduled_pickup: new Date(Date.now() + 86400000).toISOString(),
                resource,
                request,
            });
            if (ranked.length >= 6) break;
        }
        if (ranked.length >= 6) break;
    }
    return {
        ranked_matches: ranked,
        transport_plan: ranked.slice(0, 3).map((m, idx) => ({
            resource_id: m.resource_id,
            request_id: m.request_id,
            pickup_datetime: new Date(Date.now() + (idx + 1) * 3600000).toISOString(),
            pickup_order: idx + 1,
        })),
        pre_filter_summary: {
            total_resources: db.exchangeResources.length,
            total_requests: db.exchangeRequests.length,
            pre_filtered_pairs: ranked.length,
            max_pairs: 15,
        },
        degraded: false,
    };
}

export function buildImpactMatch(db: MockDb) {
    const needs = db.sponsorNeeds.slice(0, 4);
    const sponsors = db.sponsorProfiles.slice(0, 4);
    const ranked = needs.flatMap((need, i) =>
        sponsors.slice(0, 2).map((sponsor, j) => ({
            need_id: need.id,
            sponsor_id: sponsor.id,
            match_score: Math.max(55, 92 - i * 6 - j * 4),
            match_reasons: [
                sponsor.focus_areas.includes(need.category) ? 'Lĩnh vực tài trợ trùng với nhu cầu' : 'Ngân sách phù hợp quy mô nhu cầu',
                'Cùng khu vực địa lý',
            ],
            next_steps: ['Gửi hồ sơ nhu cầu cho nhà tài trợ', 'Đề xuất lịch trao đổi trong 2 tuần'],
            need,
            sponsor,
        })),
    );
    ranked.sort((a, b) => b.match_score - a.match_score);
    return {
        ranked_matches: ranked.slice(0, 6),
        pre_filter_summary: {
            total_needs: db.sponsorNeeds.length,
            total_sponsors: db.sponsorProfiles.length,
            pre_filtered_pairs: ranked.length,
            max_pairs: 20,
        },
        degraded: false,
    };
}
