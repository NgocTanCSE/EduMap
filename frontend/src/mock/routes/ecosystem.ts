/* Ecosystem routes: marketplace, payment, resource exchange, impact match, knowledge graph, language bridge, speech. */
import {
    byNewest,
    fail,
    matchText,
    nowIso,
    num,
    ok,
    uid,
    type MockContext,
    type MockRoute,
} from '../core';
import {
    buildImpactMatch,
    buildResourceMatch,
    buildSimplify,
    buildTranslate,
    buildTts,
} from '../ai';

function findById(items: Array<Record<string, any>>, id: string) {
    return items.find((item) => String(item.id) === String(id));
}

function notFound(label: string) {
    return fail(404, `${label} không tồn tại trong dữ liệu mô phỏng.`);
}

function requireUser(ctx: MockContext) {
    return ctx.user;
}

function allProducts(ctx: MockContext) {
    return ctx.db.businessProfiles.flatMap((profile) =>
        (profile.products || []).map((product: Record<string, any>) => ({ ...product, businessName: profile.name })),
    );
}

function allServices(ctx: MockContext) {
    return ctx.db.businessProfiles.flatMap((profile) =>
        (profile.services || []).map((service: Record<string, any>) => ({ ...service, businessName: profile.name })),
    );
}

function findProduct(ctx: MockContext, id: string) {
    return allProducts(ctx).find((product) => String(product.id) === String(id)) || null;
}

function findService(ctx: MockContext, id: string) {
    return allServices(ctx).find((service) => String(service.id) === String(id)) || null;
}

function cartFor(ctx: MockContext) {
    const user = requireUser(ctx);
    if (!user) return [];
    return ctx.db.cart
        .filter((item) => item.user_id === user.id)
        .map((item) => ({
            id: item.id,
            quantity: num(item.quantity, 1),
            productId: item.productId ?? null,
            serviceId: item.serviceId ?? null,
            product: item.productId ? findProduct(ctx, item.productId) : null,
            service: item.serviceId ? findService(ctx, item.serviceId) : null,
        }));
}

function cartTotal(ctx: MockContext) {
    return cartFor(ctx).reduce((total, item) => {
        const unit = item.product ? num(item.product.price) : item.service ? num(item.service.price) : 0;
        return total + unit * num(item.quantity, 1);
    }, 0);
}

function normalise(value: unknown) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export const ecosystemRoutes: MockRoute[] = [
    /* --------------------------------- marketplace ------------------------------- */
    {
        method: 'GET',
        path: '/api/business',
        handler: (ctx) => ok(ctx.db.businessProfiles),
    },
    {
        method: 'GET',
        path: '/api/business/products',
        handler: (ctx) => ok(allProducts(ctx)),
    },
    {
        method: 'GET',
        path: '/api/business/services',
        handler: (ctx) => ok(allServices(ctx)),
    },
    {
        method: 'GET',
        path: '/api/business/cart',
        handler: (ctx) => {
            if (!requireUser(ctx)) return fail(401, 'Vui lòng đăng nhập để xem giỏ hàng.');
            return ok(cartFor(ctx));
        },
    },
    {
        method: 'POST',
        path: '/api/business/cart',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để thêm vào giỏ hàng.');
            const itemId = String(ctx.body?.itemId || '');
            const itemType = String(ctx.body?.itemType || 'product');
            const quantity = Math.max(1, Math.trunc(num(ctx.body?.quantity, 1)));
            const product = itemType === 'service' ? null : findProduct(ctx, itemId);
            const service = itemType === 'service' ? findService(ctx, itemId) : null;
            if (!product && !service) return notFound('Sản phẩm hoặc dịch vụ');
            const existing = ctx.db.cart.find(
                (item) =>
                    item.user_id === user.id &&
                    ((product && String(item.productId) === String(product.id)) ||
                        (service && String(item.serviceId) === String(service.id))),
            );
            if (existing) {
                existing.quantity = num(existing.quantity, 1) + quantity;
            } else {
                ctx.db.cart.push({
                    id: uid('cart'),
                    user_id: user.id,
                    quantity,
                    productId: product ? product.id : null,
                    serviceId: service ? service.id : null,
                    created_at: nowIso(),
                });
            }
            return ok({ message: 'Đã thêm vào giỏ hàng.', items: cartFor(ctx) });
        },
    },
    {
        method: 'DELETE',
        path: '/api/business/cart/:id',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            const index = ctx.db.cart.findIndex(
                (item) => String(item.id) === String(ctx.params.id) && item.user_id === user.id,
            );
            if (index === -1) return notFound('Mục trong giỏ hàng');
            ctx.db.cart.splice(index, 1);
            return ok({ message: 'Đã xóa mục khỏi giỏ hàng.', items: cartFor(ctx) });
        },
    },
    {
        method: 'POST',
        path: '/api/business/checkout',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để đặt hàng.');
            const items = cartFor(ctx);
            if (items.length === 0) return fail(400, 'Giỏ hàng đang trống.');
            const totalAmount = cartTotal(ctx);
            const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
            const transactionId = `TXN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
            ctx.db.orders.push({
                id: orderId,
                user_id: user.id,
                transaction_id: transactionId,
                items,
                total_amount: totalAmount,
                shipping_address: String(ctx.body?.shippingAddress || ''),
                payment_method: String(ctx.body?.paymentMethod || 'COD'),
                payment_status: ctx.body?.paymentMethod === 'BANK_TRANSFER' ? 'pending' : 'cod',
                status: 'confirmed',
                created_at: nowIso(),
            });
            ctx.db.cart = ctx.db.cart.filter((item) => item.user_id !== user.id);
            return ok({
                message: 'Đặt hàng thành công.',
                orderId,
                transactionId,
                totalAmount,
            });
        },
    },
    {
        method: 'GET',
        path: '/api/business/orders',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập.');
            return ok(byNewest(ctx.db.orders.filter((order) => order.user_id === user.id || user.role === 'admin')));
        },
    },
    {
        method: 'POST',
        path: '/api/payment/process/:transactionId',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để thanh toán.');
            const key = String(ctx.params.transactionId || '');
            const order = ctx.db.orders.find(
                (row) => String(row.transaction_id) === key || String(row.id) === key,
            );
            if (!order) return notFound('Giao dịch');
            order.payment_status = 'paid';
            order.payment_method = String(ctx.body?.method || order.payment_method || 'BANK_TRANSFER');
            order.paid_at = nowIso();
            return ok({
                success: true,
                message: 'Thanh toán mô phỏng thành công.',
                transaction_id: order.transaction_id,
                order_id: order.id,
                status: 'paid',
            });
        },
    },
    {
        method: 'POST',
        path: '/api/payment/checkout',
        handler: (ctx) => {
            const user = requireUser(ctx);
            if (!user) return fail(401, 'Vui lòng đăng nhập để thanh toán.');
            const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
            const transactionId = `TXN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
            const totalAmount = num(ctx.body?.amount, cartTotal(ctx));
            ctx.db.orders.push({
                id: orderId,
                user_id: user.id,
                transaction_id: transactionId,
                items: [],
                total_amount: totalAmount,
                shipping_address: '',
                payment_method: String(ctx.body?.paymentMethod || 'BANK_TRANSFER'),
                payment_status: 'pending',
                status: 'confirmed',
                created_at: nowIso(),
            });
            return ok({ message: 'Đã tạo giao dịch mô phỏng.', orderId, transactionId, totalAmount });
        },
    },

    /* ------------------------------- resource exchange --------------------------- */
    {
        method: 'GET',
        path: '/api/resource-exchange/resources',
        handler: (ctx) => {
            const type = ctx.query.get('type') || '';
            const status = ctx.query.get('status') || '';
            const location = ctx.query.get('location') || '';
            const items = byNewest(
                ctx.db.exchangeResources.filter(
                    (resource) =>
                        (!type || resource.type === type) &&
                        (!status || resource.status === status) &&
                        (!location || matchText(resource.location, location)),
                ),
            );
            return ok({ items, meta: { total: items.length } });
        },
    },
    {
        method: 'GET',
        path: '/api/resource-exchange/resources/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.exchangeResources, ctx.params.id);
            return item ? ok(item) : notFound('Nguồn lực');
        },
    },
    {
        method: 'POST',
        path: '/api/resource-exchange/resources',
        handler: (ctx) => {
            if (!requireUser(ctx)) return fail(401, 'Vui lòng đăng nhập để đăng nguồn lực.');
            const body = ctx.body || {};
            const item = {
                id: uid('res'),
                type: String(body.type || 'book'),
                title: String(body.title || ''),
                description: String(body.description || ''),
                condition: num(body.condition, 5),
                location: String(body.location || ''),
                lat: body.lat ?? null,
                lng: body.lng ?? null,
                available_from: body.available_from || null,
                cost: num(body.cost, 0),
                contact_method: String(body.contact_method || ''),
                status: 'available',
                is_verified: false,
                tags: Array.isArray(body.tags) ? body.tags : [],
                metadata: body.metadata || {},
                created_at: nowIso(),
                updated_at: nowIso(),
            };
            ctx.db.exchangeResources.unshift(item);
            return ok(item, 201);
        },
    },
    {
        method: 'GET',
        path: '/api/resource-exchange/requests',
        handler: (ctx) => {
            const needType = ctx.query.get('need_type') || '';
            const status = ctx.query.get('status') || '';
            const location = ctx.query.get('location') || '';
            const items = byNewest(
                ctx.db.exchangeRequests.filter(
                    (request) =>
                        (!needType || request.need_type === needType) &&
                        (!status || request.status === status) &&
                        (!location || matchText(request.location, location)),
                ),
            );
            return ok({ items, meta: { total: items.length } });
        },
    },
    {
        method: 'GET',
        path: '/api/resource-exchange/requests/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.exchangeRequests, ctx.params.id);
            return item ? ok(item) : notFound('Yêu cầu');
        },
    },
    {
        method: 'POST',
        path: '/api/resource-exchange/requests',
        handler: (ctx) => {
            if (!requireUser(ctx)) return fail(401, 'Vui lòng đăng nhập để đăng yêu cầu.');
            const body = ctx.body || {};
            const item = {
                id: uid('req'),
                need_type: String(body.need_type || 'book'),
                title: String(body.title || ''),
                description: String(body.description || ''),
                urgency: String(body.urgency || 'medium'),
                location: String(body.location || ''),
                lat: body.lat ?? null,
                lng: body.lng ?? null,
                deadline: body.deadline || null,
                preferred_min_condition: num(body.preferred_min_condition, 0),
                contact_method: String(body.contact_method || ''),
                status: 'open',
                tags: Array.isArray(body.tags) ? body.tags : [],
                created_at: nowIso(),
                updated_at: nowIso(),
            };
            ctx.db.exchangeRequests.unshift(item);
            return ok(item, 201);
        },
    },
    {
        method: 'POST',
        path: '/api/resource-exchange/match',
        handler: (ctx) => {
            const type = String(ctx.body?.type || '');
            const result = buildResourceMatch(ctx.db);
            if (type) {
                result.ranked_matches = result.ranked_matches.filter(
                    (match: Record<string, any>) => match.resource?.type === type,
                );
                result.transport_plan = (result.transport_plan || []).filter((slot: Record<string, any>) =>
                    result.ranked_matches.some((match: Record<string, any>) => match.resource_id === slot.resource_id),
                );
                result.pre_filter_summary.pre_filtered_pairs = result.ranked_matches.length;
            }
            const maxResults = Math.max(1, Math.trunc(num(ctx.body?.max_results, 15)));
            result.ranked_matches = result.ranked_matches.slice(0, maxResults);
            return ok(result);
        },
    },
    {
        method: 'GET',
        path: '/api/resource-exchange/cached-matches',
        handler: (ctx) => ok(buildResourceMatch(ctx.db)),
    },

    /* -------------------------------- impact match ------------------------------ */
    {
        method: 'GET',
        path: '/api/impact-match/needs',
        handler: (ctx) => {
            const category = ctx.query.get('category') || '';
            const status = ctx.query.get('status') || '';
            const urgency = ctx.query.get('urgency') || '';
            const location = ctx.query.get('location') || '';
            const items = byNewest(
                ctx.db.sponsorNeeds.filter(
                    (need) =>
                        (!category || need.category === category) &&
                        (!status || need.status === status) &&
                        (!urgency || need.urgency === urgency) &&
                        (!location || matchText(need.location, location)),
                ),
            );
            return ok({ items, meta: { total: items.length } });
        },
    },
    {
        method: 'GET',
        path: '/api/impact-match/needs/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.sponsorNeeds, ctx.params.id);
            return item ? ok(item) : notFound('Nhu cầu');
        },
    },
    {
        method: 'POST',
        path: '/api/impact-match/needs',
        handler: (ctx) => {
            const body = ctx.body || {};
            if (!String(body.title || '').trim()) return fail(400, 'Tiêu đề nhu cầu không được để trống.');
            const item = {
                id: uid('need'),
                title: String(body.title),
                description: String(body.description || ''),
                category: String(body.category || 'equipment'),
                urgency: String(body.urgency || 'medium'),
                cost_estimate: num(body.cost_estimate, 0),
                location: String(body.location || ''),
                status: 'open',
                tags: Array.isArray(body.tags) ? body.tags : [],
                apply_url: String(body.apply_url || ''),
                provenance: 'Dữ liệu mô phỏng trên trình duyệt.',
                created_at: nowIso(),
            };
            ctx.db.sponsorNeeds.unshift(item);
            return ok(item, 201);
        },
    },
    {
        method: 'GET',
        path: '/api/impact-match/sponsors',
        handler: (ctx) => {
            const focusArea = ctx.query.get('focus_area') || '';
            const location = ctx.query.get('location') || '';
            const verified = ctx.query.get('is_verified');
            const items = byNewest(
                ctx.db.sponsorProfiles.filter(
                    (sponsor) =>
                        (!focusArea || (sponsor.focus_areas || []).includes(focusArea)) &&
                        (!location || matchText(sponsor.location, location)) &&
                        (verified === null || verified === '' || String(sponsor.is_verified) === verified),
                ),
            );
            return ok({ items, meta: { total: items.length } });
        },
    },
    {
        method: 'GET',
        path: '/api/impact-match/sponsors/:id',
        handler: (ctx) => {
            const item = findById(ctx.db.sponsorProfiles, ctx.params.id);
            return item ? ok(item) : notFound('Nhà tài trợ');
        },
    },
    {
        method: 'POST',
        path: '/api/impact-match/sponsors',
        handler: (ctx) => {
            const body = ctx.body || {};
            if (!String(body.name || '').trim()) return fail(400, 'Tên nhà tài trợ không được để trống.');
            const item = {
                id: uid('sponsor'),
                name: String(body.name),
                description: String(body.description || ''),
                focus_areas: Array.isArray(body.focus_areas) ? body.focus_areas : [],
                budget_amount: num(body.budget_amount, 0),
                budget_currency: String(body.budget_currency || 'VND'),
                location: String(body.location || ''),
                website_url: String(body.website_url || ''),
                contact_email: String(body.contact_email || ''),
                status: 'active',
                is_verified: false,
                created_at: nowIso(),
            };
            ctx.db.sponsorProfiles.unshift(item);
            return ok(item, 201);
        },
    },
    {
        method: 'POST',
        path: '/api/impact-match/rank',
        handler: (ctx) => {
            const category = String(ctx.body?.category || '');
            const maxCost = num(ctx.body?.max_cost, 0);
            const result = buildImpactMatch(ctx.db);
            if (category) {
                result.ranked_matches = result.ranked_matches.filter(
                    (match: Record<string, any>) => match.need?.category === category,
                );
            }
            if (maxCost > 0) {
                result.ranked_matches = result.ranked_matches.filter(
                    (match: Record<string, any>) => num(match.need?.cost_estimate, 0) <= maxCost,
                );
            }
            const maxResults = Math.max(1, Math.trunc(num(ctx.body?.max_results, 15)));
            result.ranked_matches = result.ranked_matches.slice(0, maxResults);
            result.pre_filter_summary.pre_filtered_pairs = result.ranked_matches.length;
            return ok(result);
        },
    },
    {
        method: 'GET',
        path: '/api/impact-match/rankings/cached',
        handler: (ctx) => ok(buildImpactMatch(ctx.db)),
    },

    /* ------------------------------- knowledge graph ---------------------------- */
    {
        method: 'GET',
        path: '/api/ai/knowledge/graph',
        handler: (ctx) => {
            const rawTypes = ctx.query.get('node_types') || ctx.query.get('nodeTypes') || '';
            const types = rawTypes
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);
            const limit = Math.max(1, Math.trunc(num(ctx.query.get('limit'), 500)));
            const nodes = (types.length ? ctx.db.knowledgeNodes.filter((node) => types.includes(node.type)) : ctx.db.knowledgeNodes).slice(0, limit);
            const nodeIds = new Set(nodes.map((node) => node.id));
            const edges = ctx.db.knowledgeEdges.filter(
                (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
            );
            return ok({
                nodes,
                edges,
                meta: {
                    total_nodes: nodes.length,
                    total_edges: edges.length,
                    synced_at: nowIso(),
                    source: 'edumap-mock',
                },
                degraded: false,
            });
        },
    },
    {
        method: 'POST',
        path: '/api/ai/knowledge/query',
        handler: (ctx) => {
            if (!requireUser(ctx)) return fail(401, 'Vui lòng đăng nhập để truy vấn knowledge graph.');
            const nodeId = String(ctx.body?.node_id || '');
            const limit = Math.max(1, Math.trunc(num(ctx.body?.limit, 50)));
            const start = findById(ctx.db.knowledgeNodes, nodeId) || null;
            if (!start) return ok({ start_node: null, neighbors: [], edges: [], meta: { total_neighbors: 0 } });
            const edges = ctx.db.knowledgeEdges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
            const neighbourIds = new Set(
                edges.map((edge) => (edge.source === nodeId ? edge.target : edge.source)),
            );
            const neighbors = ctx.db.knowledgeNodes
                .filter((node) => neighbourIds.has(node.id))
                .slice(0, limit);
            return ok({
                start_node: start,
                neighbors,
                edges,
                meta: { total_neighbors: neighbors.length, depth: num(ctx.body?.depth, 1) },
            });
        },
    },
    {
        method: 'POST',
        path: '/api/ai/knowledge/suggest-partners',
        handler: (ctx) => {
            if (!requireUser(ctx)) return fail(401, 'Vui lòng đăng nhập để sử dụng tính năng gợi ý.');
            const query = String(ctx.body?.query || '');
            const focusType = String(ctx.body?.focus_type || '');
            const limit = Math.max(1, Math.trunc(num(ctx.body?.limit, 10)));
            const needle = normalise(query);
            const suggestions = ctx.db.knowledgeNodes
                .filter((node) => !focusType || node.type === focusType)
                .map((node) => {
                    const haystack = normalise(`${node.name} ${node.description} ${node.city} ${node.province}`);
                    const matched = needle ? haystack.includes(needle) : false;
                    return {
                        node_id: node.id,
                        type: node.type,
                        name: node.name,
                        description: node.description,
                        url: node.url,
                        match_score: matched ? 0.92 : 0.55,
                        city: node.city,
                        province: node.province,
                    };
                })
                .sort((a, b) => b.match_score - a.match_score)
                .slice(0, limit);
            return ok({
                query,
                focus_type: focusType || null,
                count: suggestions.length,
                suggestions,
                degraded: false,
            });
        },
    },
    {
        method: 'POST',
        path: '/api/ai/knowledge/extract',
        handler: (ctx) => {
            if (!requireUser(ctx)) return fail(401, 'Vui lòng đăng nhập để trích xuất thực thể.');
            const text = String(ctx.body?.text || '');
            const plain = normalise(text);
            const linked = ctx.db.knowledgeNodes
                .filter((node) => plain.includes(normalise(node.name)) || plain.includes(normalise(node.name.split(' ').slice(-2).join(' '))))
                .map((node) => ({
                    entity_text: node.name,
                    entity_type: node.type,
                    node_id: node.id,
                    node_type: node.type,
                    node_name: node.name,
                    node_url: node.url,
                    confidence: 0.9,
                }));
            const entities = linked.length
                ? linked.map((item) => ({ text: item.entity_text, type: item.entity_type, confidence: item.confidence }))
                : [{ text: text.slice(0, 60), type: 'unknown', confidence: 0.4 }];
            return ok({
                entities,
                linked_nodes: linked,
                confidence: linked.length ? 0.88 : 0.4,
                degraded: false,
            });
        },
    },
    {
        method: 'GET',
        path: '/api/ai/knowledge/reviews',
        handler: (ctx) => {
            if (!requireUser(ctx)) return fail(401, 'Vui lòng đăng nhập.');
            const status = ctx.query.get('status') || 'pending';
            const limit = Math.max(1, Math.trunc(num(ctx.query.get('limit'), 100)));
            const reviews = ctx.db.knowledgeReviews.filter((item) => item.status === status).slice(0, limit);
            return ok({ reviews, items: reviews, total: reviews.length });
        },
    },
    {
        method: 'POST',
        path: '/api/ai/knowledge/reviews/:id/approve',
        handler: (ctx) => {
            if (!requireUser(ctx)) return fail(401, 'Vui lòng đăng nhập.');
            const review = findById(ctx.db.knowledgeReviews, ctx.params.id);
            if (!review) return notFound('Bản ghi kiểm duyệt');
            review.status = 'approved';
            review.reviewed_at = nowIso();
            return ok(review);
        },
    },
    {
        method: 'POST',
        path: '/api/ai/knowledge/sync',
        handler: (ctx) => {
            if (!requireUser(ctx)) return fail(401, 'Vui lòng đăng nhập.');
            return ok({
                status: 'completed',
                background: Boolean(ctx.body?.background),
                nodes: ctx.db.knowledgeNodes.length,
                edges: ctx.db.knowledgeEdges.length,
                synced_at: nowIso(),
                degraded: false,
            });
        },
    },

    /* ------------------------------- language bridge ---------------------------- */
    {
        method: 'POST',
        path: '/api/ai/language/simplify',
        handler: (ctx) => {
            const text = String(ctx.body?.text || '');
            if (!text.trim()) return fail(400, 'Văn bản không được để trống.');
            return ok(buildSimplify(text, String(ctx.body?.difficulty || 'middle')));
        },
    },
    {
        method: 'POST',
        path: '/api/ai/language/translate',
        handler: (ctx) => {
            const text = String(ctx.body?.text || '');
            if (!text.trim()) return fail(400, 'Văn bản không được để trống.');
            return ok(buildTranslate(text, String(ctx.body?.target_language || 'en')));
        },
    },
    {
        method: 'POST',
        path: '/api/ai/language/tts',
        handler: (ctx) => {
            const text = String(ctx.body?.text || '');
            if (!text.trim()) return fail(400, 'Văn bản không được để trống.');
            return ok(buildTts(text, String(ctx.body?.language || 'vi')));
        },
    },

    /* ----------------------------------- speech --------------------------------- */
    {
        method: 'POST',
        path: '/api/ai/speech/to-text',
        handler: (ctx) => {
            const text = String(ctx.body?.text || ctx.body?.query || '');
            const plain = normalise(text);
            const matched = ctx.db.pois.filter((poi) => {
                if (!plain) return false;
                return (
                    normalise(poi.name).includes(plain) ||
                    plain.includes(normalise(poi.name)) ||
                    normalise(poi.address).includes(plain) ||
                    normalise(poi.category).includes(plain)
                );
            });
            const results = (matched.length ? matched : ctx.db.pois.slice(0, 5)).map((poi) => ({
                id: poi.id,
                name: poi.name,
                title: poi.name,
                category: poi.category,
                address: poi.address,
                lat: poi.lat,
                lng: poi.lng,
                description: poi.description,
                distance_m: 1200,
            }));
            return ok(results);
        },
    },
];
