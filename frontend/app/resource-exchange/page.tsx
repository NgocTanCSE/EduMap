"use client";

import React, { useEffect, useState } from "react";
import {
  Package,
  PackageOpen,
  ClipboardList,
  Users,
  BrainCircuit,
  Sparkles,
  MapPin,
  Clock,
  Tag,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
  ExternalLink,
  CalendarDays,
  Phone,
  Mail,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ContentShell from "@/components/ui/ContentShell";
import SectionHeader from "@/components/ui/SectionHeader";
import EmptyState from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import {
  resourceExchangeService,
  Resource,
  ResourceRequest,
  ResourceMatch,
  MatchResult,
  TransportSlot,
  MatchResourcesResponse,
  CreateResourcePayload,
  CreateResourceRequestPayload,
} from "@/src/services/resource-exchange.service";
import { authService } from "@/src/services/auth.service";

const RESOURCE_TYPES: { value: string; label: string }[] = [
  { value: "book", label: "Sách" },
  { value: "device", label: "Thiết bị" },
  { value: "volunteer_hours", label: "Giờ tình nguyện" },
];

const URGENCY_LABELS: Record<string, string> = {
  critical: "Khẩn cấp",
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};
const URGENCY_COLORS: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-primary/20 text-primary border-primary/30",
  medium: "bg-primary/10 text-primary/80 border-primary/20",
  low: "bg-muted/40 text-foreground/60 border-border",
};

const CONDITION_LABELS: Record<number, string> = {
  0: "Hỏng",
  1: "Kém",
  2: "Yếu",
  3: "Trung bình",
  4: "Tốt",
  5: "Như mới",
};

type Tab = "provide" | "request" | "matches";

export default function ResourceExchangePage() {
  // Data
  const [resources, setResources] = useState<Resource[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [matches, setMatches] = useState<ResourceMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRank, setLoadingRank] = useState(false);

  // Filters + results
  const [regionFilter, setRegionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [rankedMatches, setRankedMatches] = useState<MatchResult[]>([]);
  const [transportPlan, setTransportPlan] = useState<TransportSlot[]>([]);
  const [rankResponse, setRankResponse] =
    useState<MatchResourcesResponse | null>(null);
  const [matchesCached, setMatchesCached] = useState(false);

  // Modals
  const [tab, setTab] = useState<Tab>("matches");
  const [resPage, setResPage] = useState(1);
  const [reqPage, setReqPage] = useState(1);
  const pageSize = 6;
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [resourceForm, setResourceForm] = useState<CreateResourcePayload>({
    type: "book" as any,
    title: "",
    description: "",
    condition: 5,
    location: "",
    available_from: "",
    cost: 0,
    contact_method: "",
    tags: [],
    metadata: {},
  });
  const [requestForm, setRequestForm] = useState<CreateResourceRequestPayload>({
    need_type: "book" as any,
    title: "",
    description: "",
    urgency: "medium" as any,
    location: "",
    deadline: "",
    preferred_min_condition: 0,
    contact_method: "",
    tags: [],
  });

  // ── Fetch on mount ── (resources + requests + cached AI matches) ─────────────
  useEffect(() => {
    fetchData();
    fetchCachedMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resRes, reqRes] = await Promise.all([
        resourceExchangeService.getResources({ limit: 50 }),
        resourceExchangeService.getRequests({ limit: 50 }),
      ]);
      setResources(resRes.items || []);
      setRequests(reqRes.items || []);
    } catch (error) {
      console.error("Error fetching resource exchange data:", error);
      toast.error("Không thể tải dữ liệu Resource Exchange");
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch cached AI matches (auto-scheduler) ────────────────────────
  const fetchCachedMatches = async () => {
    try {
      const cached = await resourceExchangeService.getCachedMatches();
      if (cached && cached.ranked_matches && cached.ranked_matches.length > 0) {
        setRankedMatches(cached.ranked_matches);
        setTransportPlan(cached.transport_plan || []);
        setRankResponse(cached);
        setMatchesCached(true);
      }
    } catch (error) {
      console.error("Error fetching cached matches:", error);
      // Non-fatal — page still works with manual "Ghép bằng AI" button
    }
  };

  // ── AI Rank ──────────────────────────────────────────────────────
  const handleRank = async () => {
    if (resources.length === 0 || requests.length === 0) {
      toast.warning("Cần có đủ dữ liệu nguồn lực và yêu cầu để ghép nối");
      return;
    }
    try {
      setLoadingRank(true);
      setRankResponse(null);
      setRankedMatches([]);
      setTransportPlan([]);
      toast.info("AI đang phân tích và xếp hạng cặp cung–cầu...");

      const response = await resourceExchangeService.matchResources({
        region: regionFilter || undefined,
        type: typeFilter || undefined,
        max_results: 15,
      });

      setRankResponse(response);
      setRankedMatches(response.ranked_matches || []);
      setTransportPlan(response.transport_plan || []);

      if (response.degraded) {
        toast.warning(
          "AI đang ngoại tuyến — hiển thị kết quả dự phòng + lịch giao nhận template",
        );
      } else if (response.ranked_matches?.length > 0) {
        toast.success(
          `Tìm thấy ${response.ranked_matches.length} cặp ghép phù hợp!`,
        );
      } else {
        toast.info("Chưa tìm thấy cặp ghép phù hợp");
      }
    } catch (error) {
      console.error("Error ranking matches:", error);
      toast.error("Lỗi khi xếp hạng ghép nối");
    } finally {
      setLoadingRank(false);
    }
  };

  // ── Create resource ───────────────────────────────────────────────
  const handleCreateResource = async () => {
    const { title, type, location, condition } = resourceForm;
    if (!title || !type || !location || condition === undefined) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }
    try {
      await resourceExchangeService.createResource(resourceForm);
      toast.success("Đã đăng nguồn lực");
      setShowResourceModal(false);
      setResourceForm({
        type: "book" as any,
        title: "",
        description: "",
        condition: 5,
        location: "",
        available_from: "",
        cost: 0,
        contact_method: "",
        tags: [],
        metadata: {},
      });
      fetchData();
    } catch (error) {
      toast.error("Không thể đăng nguồn lực (cần đăng nhập)");
    }
  };

  const handleCreateRequest = async () => {
    const { title, need_type, location, urgency } = requestForm;
    if (!title || !need_type || !location || !urgency) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }
    try {
      await resourceExchangeService.createRequest(requestForm);
      toast.success("Đã đăng yêu cầu");
      setShowRequestModal(false);
      setRequestForm({
        need_type: "book" as any,
        title: "",
        description: "",
        urgency: "medium" as any,
        location: "",
        deadline: "",
        preferred_min_condition: 0,
        contact_method: "",
        tags: [],
      });
      fetchData();
    } catch (error) {
      toast.error("Không thể đăng yêu cầu (cần đăng nhập)");
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const typeLabel = (t?: string) =>
    RESOURCE_TYPES.find((r) => r.value === t)?.label || t || "—";

  // ── Render helpers ────────────────────────────────────────────────
  const ResourceCard = ({ resource }: { resource: Resource }) => (
    <div className="rounded-[22px] border border-border/80 bg-card p-5 shadow-orvel hover:shadow-pop transition-all hover:border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-1 flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            {resource.title}
          </CardTitle>
          <div className="flex items-end gap-1">
            <BookmarkButton targetType="resource" targetId={resource.id} size="sm" />
            <span className="px-2 py-1 bg-card/40 border border-border rounded text-xs font-semibold">
              {typeLabel(resource.type)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {resource.description && (
          <p className="text-sm text-foreground/60 line-clamp-3 mb-3">
            {resource.description}
          </p>
        )}
        <div className="flex items-center justify-between text-sm text-foreground/60 mb-2">
          <div className="flex items-center gap-1">
            <span>
              Điều kiện:{" "}
              {CONDITION_LABELS[resource.condition] || resource.condition}/5
            </span>
          </div>
          <span className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/30 rounded text-xs">
            {resource.is_verified ? "Đã xác minh" : "Chưa xác minh"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm text-foreground/60">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{resource.location}</span>
          </div>
          {resource.cost > 0 && (
            <span>{formatCurrency(Number(resource.cost))}</span>
          )}
        </div>
        {resource.contact_method && (
          <div className="mt-2 flex items-center gap-1 text-xs text-foreground/50">
            <Phone className="w-3 h-3" />
            <span>{resource.contact_method}</span>
          </div>
        )}
      </CardContent>
    </div>
  );

  const RequestCard = ({ request }: { request: ResourceRequest }) => {
    const urgency = request.urgency || "medium";
    return (
      <Card className="border-border hover:border-primary/30 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg line-clamp-1 flex items-center gap-2">
              <PackageOpen className="w-4 h-4 text-primary" />
              {request.title}
            </CardTitle>
            <span
              className={`px-2 py-1 rounded-full text-xs font-bold border ${URGENCY_COLORS[urgency] || URGENCY_COLORS.medium}`}
            >
              {URGENCY_LABELS[urgency] || urgency}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {request.description && (
            <p className="text-sm text-foreground/60 line-clamp-3 mb-3">
              {request.description}
            </p>
          )}
          <div className="flex items-center justify-between text-sm text-foreground/60 mb-2">
            <span>{typeLabel(request.need_type)}</span>
            <span>
              Điều kiện tối thiểu: {request.preferred_min_condition}/5
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm text-foreground/60">
            <MapPin className="w-4 h-4" />
            <span>{request.location}</span>
          </div>
          {request.deadline && (
            <div className="mt-2 flex items-center gap-1 text-xs text-foreground/50">
              <Clock className="w-3 h-3" />
              <span>Hạn: {formatDate(request.deadline)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const MatchResultCard = ({
    match,
    idx,
  }: {
    match: MatchResult;
    idx: number;
  }) => {
    const res =
      match.resource || resources.find((r) => r.id === match.resource_id);
    const req =
      match.request || requests.find((r) => r.id === match.request_id);
    return (
      <div className="rounded-2xl border border-primary/30 bg-card p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/80">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider mb-1.5">
              Cặp ghép #{idx + 1}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {res?.title || match.resource_id} <span className="text-primary font-normal">↔</span> {req?.title || match.request_id}
            </h3>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center bg-primary/10 border border-primary/30 px-3.5 py-1.5 rounded-full shrink-0">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm text-primary">
              {Math.round(match.match_score)}% Phù hợp
            </span>
          </div>
        </div>

        {/* Dual sides */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
          {/* Supply */}
          <div className="bg-muted/40 border border-border/70 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-primary" /> Nguồn lực cung cấp
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                {typeLabel(res?.type)}
              </span>
            </div>
            <p className="font-bold text-sm text-foreground">{res?.title || match.resource_id}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {res?.description || "Không có mô tả chi tiết."}
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <span>Điều kiện: <strong className="text-foreground">{res?.condition || 5}/5</strong></span>
              {res?.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-primary" /> {res.location}
                </span>
              )}
            </div>
          </div>

          {/* Need */}
          <div className="bg-muted/40 border border-border/70 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <PackageOpen className="w-3.5 h-3.5 text-accent" /> Yêu cầu cần hỗ trợ
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-accent/15 text-accent font-semibold">
                {URGENCY_LABELS[req?.urgency || "medium"] || req?.urgency}
              </span>
            </div>
            <p className="font-bold text-sm text-foreground">{req?.title || match.request_id}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {req?.description || "Không có mô tả chi tiết."}
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <span>Tối thiểu: <strong className="text-foreground">{req?.preferred_min_condition || 0}/5</strong></span>
              {req?.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-accent" /> {req.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Explanation */}
        {match.explanation && (
          <div className="mb-3.5 p-3 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-xs italic text-foreground/80 leading-relaxed">
              "{match.explanation}"
            </p>
          </div>
        )}

        {/* Reasons */}
        {match.match_reasons && match.match_reasons.length > 0 && (
          <div className="mb-3.5">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Lý do phù hợp
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {match.match_reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground/80 bg-background/80 p-2 rounded-lg border border-border/60">
                  <CheckCircle className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                  <span className="leading-snug">{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pickup & Contacts */}
        <div className="pt-3 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {match.scheduled_pickup ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Giao nhận dự kiến: <strong className="text-foreground">{formatDate(match.scheduled_pickup)}</strong></span>
            </div>
          ) : <div />}

          <div className="flex items-center gap-2">
            {res?.contact_method && (
              <a
                href={`mailto:${res.contact_method}`}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all"
                title="Liên hệ người cung cấp"
              >
                <Mail className="w-3.5 h-3.5" /> Bên cung cấp
              </a>
            )}
            {req?.contact_method && (
              <a
                href={`mailto:${req.contact_method}`}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold rounded-lg bg-accent/10 hover:bg-accent text-accent hover:text-accent-foreground transition-all"
                title="Liên hệ người nhận"
              >
                <Mail className="w-3.5 h-3.5" /> Bên nhận
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <ContentShell>
      {/* Header */}
      <SectionHeader
        title="Resource Exchange AI — Kết nối cung ↔ cầu nguồn lực"
        subtitle="AI ghép nối sách, máy thiết bị và giờ tình nguyện dư thừa với nơi cần hỗ trợ trên toàn Việt Nam, kèm kế hoạch vận chuyển tối ưu."
        icon={Package}
        right={
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowResourceModal(true)}
              variant="outline"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" /> Đăng nguồn lực
            </Button>
            <Button
              onClick={() => setShowRequestModal(true)}
              variant="outline"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" /> Đăng yêu cầu
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-border">
        {[
          { key: "provide", label: "Nguồn lực đang có", icon: Package },
          { key: "request", label: "Yêu cầu cần nhận", icon: PackageOpen },
          { key: "matches", label: "Ghép nối AI", icon: TrendingUp },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Nguồn lực đang có */}
      {tab === "provide" && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between mb-5 p-4 bg-card/60 border border-border/80 rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-1">
              <div className="w-full sm:w-48">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Loại nguồn lực
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm focus:border-primary outline-none"
                >
                  <option value="">Tất cả loại</option>
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-56">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Khu vực
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đồng Nai, Biên Hòa..."
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="w-full h-10 px-3.5 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm focus:border-primary outline-none"
                />
              </div>
            </div>
            <Button onClick={fetchData} variant="outline" className="h-10 rounded-xl text-xs font-bold shrink-0">
              <Loader2 className="w-3.5 h-3.5 mr-1.5" /> Làm mới dữ liệu
            </Button>
          </div>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border h-40 animate-pulse" />
              ))}
            </div>
          ) : resources.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources.map((r) => (
                <ResourceCard key={r.id} resource={r} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có nguồn lực"
              description="Hãy đăng nguồn lực đầu tiên để bắt đầu chia sẻ."
              icon={<Package className="w-8 h-8 text-foreground/30" />}
            />
          )}
        </div>
      )}

      {/* Tab: Yêu cầu cần nhận */}
      {tab === "request" && (
        <div>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-border h-36 animate-pulse" />
              ))}
            </div>
          ) : requests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requests.map((r) => (
                <RequestCard key={r.id} request={r} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có yêu cầu nào"
              description="Hãy đăng yêu cầu đầu tiên để tìm kiếm nguồn lực."
              icon={<PackageOpen className="w-8 h-8 text-foreground/30" />}
            />
          )}
        </div>
      )}

      {/* Tab: Ghép nối AI */}
      {tab === "matches" && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between mb-5 p-4 bg-card/60 border border-border/80 rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-1">
              <div className="w-full sm:w-48">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Loại nguồn lực
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm focus:border-primary outline-none"
                >
                  <option value="">Tất cả loại</option>
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-56">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Khu vực
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đồng Nai, Biên Hòa..."
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="w-full h-10 px-3.5 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm focus:border-primary outline-none"
                />
              </div>
            </div>
            <Button
              onClick={handleRank}
              disabled={loadingRank}
              variant={matchesCached ? "outline" : "default"}
              className={matchesCached ? "h-10 px-6 rounded-xl" : "h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-2 shadow-sm shrink-0"}
            >
              {loadingRank ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang xếp hạng...
                </>
              ) : matchesCached ? (
                <>
                  <RefreshCw className="w-4 h-4" /> Làm mới kết quả
                </>
              ) : (
                <>
                  <BrainCircuit className="w-4 h-4" /> Ghép bằng AI
                </>
              )}
            </Button>
          </div>

          {rankResponse?.degraded && (
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl flex items-center gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-primary" />
              <span className="text-sm text-primary">
                {rankResponse.reason ||
                  "AI đang ngoại tuyến — đang sử dụng kết quả dự phòng dựa trên tiêu chí điểm số."}
              </span>
            </div>
          )}

          {rankedMatches.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xl font-bold mb-4">
                <Sparkles className="text-primary/70" />
                <h2>Kết quả ghép ({rankedMatches.length} cặp)</h2>
              </div>
              <div className="space-y-4">
                {rankedMatches.map((match, idx) => (
                  <MatchResultCard
                    key={`${match.resource_id}-${match.request_id}`}
                    match={match}
                    idx={idx}
                  />
                ))}
              </div>

              {/* Transport schedule */}
              {transportPlan.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    Kế hoạch vận chuyển (greedy scheduler)
                  </h3>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        {transportPlan.map((slot) => (
                          <div
                            key={`${slot.resource_id}-${slot.request_id}`}
                            className="flex items-center justify-between p-2 border border-border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                {slot.pickup_order}
                              </span>
                              <span className="text-sm">
                                <span className="font-mono text-xs text-foreground/50">
                                  {slot.resource_id.slice(0, 8)} →{" "}
                                  {slot.request_id.slice(0, 8)}
                                </span>
                              </span>
                            </div>
                            <span className="text-sm font-medium">
                              {formatDate(slot.pickup_datetime)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-foreground/50 mt-3">
                        Mỗi nguồn lực / mỗi yêu cầu chỉ được lên lịch giao nhận
                        một lần — tránh xung đột thời gian.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {!matchesCached && !loadingRank && rankedMatches.length === 0 && (
            <EmptyState
              title="Đang chờ kết quả tự động"
              description="AI Auto-Scheduler đang tính toán ghép nối. Kết quả sẽ hiển thị tự động sau lần đầu chạy (6h/lần). Bạn cũng có thể ấn 'Ghép bằng AI' để chạy ngay."
              icon={<BrainCircuit className="w-8 h-8 text-foreground/30" />}
            />
          )}
          {matchesCached && !loadingRank && rankedMatches.length === 0 && (
            <EmptyState
              title="Chưa tìm thấy cặp ghép"
              description="AI đã phân tích nhưng chưa tìm thấy cặp cung–cầu phù hợp. Hãy thử thêm nguồn lực/yêu cầu mới hoặc điều chỉnh bộ lọc."
              icon={<Package className="w-8 h-8 text-foreground/30" />}
            />
          )}
        </div>
      )}

      {/* ── Modals & data policy banner ─────────────────────────────── */}
      {showResourceModal && (
        <CreateResourceModal
          form={resourceForm}
          setForm={setResourceForm}
          onSave={handleCreateResource}
          onClose={() => setShowResourceModal(false)}
        />
      )}
      {showRequestModal && (
        <CreateRequestModal
          form={requestForm}
          setForm={setRequestForm}
          onSave={handleCreateRequest}
          onClose={() => setShowRequestModal(false)}
        />
      )}

      <div className="mt-6 p-3 border border-border rounded-lg bg-card/30">
        <p className="text-xs text-foreground/50">
          <Tag className="w-3 h-3 inline mr-1" />
          Dữ liệu nguồn lực và yêu cầu được kiểm chứng từ nguồn chính thức. Mỗi
          cặp ghép đều có hướng dẫn liên hệ trực tiếp để xác minh danh tính
          trước khi giao nhận.
        </p>
      </div>
    </ContentShell>
  );
}

// ── Create Resource Modal ────────────────────────────────────────────────────
function CreateResourceModal({
  form,
  setForm,
  onSave,
  onClose,
}: {
  form: CreateResourcePayload;
  setForm: (f: CreateResourcePayload) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const handleTags = (v: string) =>
    setForm({
      ...form,
      tags: v
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6">
        <h3 className="h3-card mb-4">Đăng nguồn lực (cung cấp)</h3>
        <div className="grid grid-cols-2 gap-3">
          <Select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            className="form-select"
          >
            {RESOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Input
            type="text"
            placeholder="Tiêu đề"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="form-input"
          />
          <Input
            type="text"
            placeholder="Địa điểm"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="form-input col-span-2"
          />
          <Input
            type="text"
            placeholder="Điện thoại/email liên hệ"
            value={form.contact_method || ""}
            onChange={(e) =>
              setForm({ ...form, contact_method: e.target.value })
            }
            className="form-input col-span-2"
          />
          <Input
            type="text"
            placeholder="Nhãn (phân cách bằng dấu phẩy)"
            onChange={(e) => handleTags(e.target.value)}
            className="form-input col-span-2"
          />
        </div>
        <Textarea
          placeholder="Mô tả chi tiết"
          value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="form-textarea mt-3"
          rows={3}
        />
        <div className="flex justify-end gap-3 mt-4">
          <Button onClick={onClose} variant="outline" size="sm">
            Hủy
          </Button>
          <Button onClick={onSave} size="sm">
            Lưu
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateRequestModal({
  form,
  setForm,
  onSave,
  onClose,
}: {
  form: CreateResourceRequestPayload;
  setForm: (f: CreateResourceRequestPayload) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6">
        <h3 className="h3-card mb-4">Đăng yêu cầu (cần nhận)</h3>
        <div className="grid grid-cols-2 gap-3">
          <Select
            value={form.need_type}
            onChange={(e) =>
              setForm({ ...form, need_type: e.target.value as any })
            }
            className="form-select"
          >
            {RESOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select
            value={form.urgency}
            onChange={(e) =>
              setForm({ ...form, urgency: e.target.value as any })
            }
            className="form-select"
          >
            {Object.entries(URGENCY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Input
            type="text"
            placeholder="Tiêu đề"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="form-input col-span-2"
          />
          <Input
            type="text"
            placeholder="Địa điểm"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="form-input col-span-2"
          />
          <Input
            type="datetime-local"
            value={form.deadline || ""}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            className="form-input col-span-2"
          />
        </div>
        <Textarea
          placeholder="Mô tả chi tiết nhu cầu"
          value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="form-textarea mt-3"
          rows={3}
        />
        <div className="flex justify-end gap-3 mt-4">
          <Button onClick={onClose} variant="outline" size="sm">
            Hủy
          </Button>
          <Button onClick={onSave} size="sm">
            Lưu
          </Button>
        </div>
      </div>
    </div>
  );
}
