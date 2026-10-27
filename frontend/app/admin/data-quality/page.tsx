"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, AlertTriangle, RefreshCw, Filter, Database, BarChart3, Search, Download } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { adminService, Anomaly, DataQualityReport } from '@/reporting/services/admin.service';
import { toast } from 'sonner';

// ── Category filter options ────────────────────────────────────────────────
const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Tất cả danh mục' },
  { value: 'university', label: 'Đại học' },
  { value: 'school', label: 'Trường THPT' },
  { value: 'library', label: 'Thư viện' },
  { value: 'bookstore', label: 'Nhà sách' },
  { value: 'lab', label: 'Lab / STEM' },
  { value: 'wifi', label: 'Wifi' },
  { value: 'green', label: 'Không gian xanh' },
  { value: 'cafe', label: 'Cà phê' },
  { value: 'restaurant', label: 'Nhà hàng' },
  { value: 'market', label: 'Chợ / Thị trường' },
  { value: 'convenience', label: 'Tiện dịch' },
];

const PRIORITY_COLORS = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  missing_coordinates: 'Thiếu tọa độ',
  invalid_coordinates: 'Tọa độ sai',
  spatial_outlier: 'Điểm bất thường',
  duplicate_name: 'Trùng lặp',
  missing_name: 'Thiếu tên',
  missing_address: 'Thiếu địa chỉ',
  stale_data: 'Lỗi thời',
  invalid_status: 'Trạng thái lỗi',
  missing_source: 'Thiếu nguồn',
};

export default function AdminDataQualityPage() {
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [includeClean, setIncludeClean] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await adminService.getDataQualityReport({
        category: categoryFilter || undefined,
        limit: 500,
        include_clean: includeClean,
      });
      setReport(data);
    } catch (error: any) {
      console.error('Error fetching data quality report:', error);
      toast.error(error.message || 'Không thể tải báo cáo chất lượng dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, includeClean]);

  // Filter anomalies by search term
  const filteredAnomalies = useMemo(() => {
    if (!report) return [];
    if (!searchTerm.trim()) return report.anomalies;
    const term = searchTerm.toLowerCase();
    return report.anomalies.filter(
      (a) =>
        (a.name && a.name.toLowerCase().includes(term)) ||
        (a.address && a.address.toLowerCase().includes(term)) ||
        (a.city && a.city.toLowerCase().includes(term)) ||
        a.anomaly_types.some((t) => ANOMALY_TYPE_LABELS[t]?.toLowerCase().includes(term)),
    );
  }, [report, searchTerm]);

  // Points with valid coords for the map
  const mapPoints = useMemo(
    () =>
      report
        ? filteredAnomalies
            .filter((a) => a.lat != null && a.lng != null)
            .map((a) => ({
              lat: a.lat!,
              lng: a.lng!,
              id: a.id,
              name: a.name || 'Không tên',
              category: a.category,
              priority: a.priority,
              anomaly_types: a.anomaly_types,
              confidence: a.confidence,
              address: a.address || '',
            }))
        : [],
    [filteredAnomalies, report],
  );

  if (loading && !report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Đang phân tích chất lượng dữ liệu...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary rounded-lg">
              <Database className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3 text-primary">
                <AlertTriangle className="w-8 h-8" />
                Chất lượng Dữ liệu (AI Anomaly Detector)
              </h1>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Phát hiện điểm dữ liệu sai, trùng lặp, lỗi thời, tọa độ bất thường
              </p>
            </div>
          </div>
          <button
            onClick={fetchReport}
            className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-card/80 transition-all flex items-center gap-2 text-sm font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {/* Summary Cards */}
        {report && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-6 rounded-xl bg-card/50 border border-border">
                <div className="text-2xl font-bold text-primary">{report.summary.total_checked}</div>
                <div className="text-xs text-muted-foreground/60">Tổng POI kiểm tra</div>
              </div>
              <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="text-2xl font-bold text-red-400">{report.summary.total_anomalies}</div>
                <div className="text-xs text-muted-foreground/60">Điểm bất thường</div>
              </div>
              <div className="p-6 rounded-xl bg-card/50 border border-border">
                <div className="text-2xl font-bold text-amber-400">{report.summary.anomaly_rate}%</div>
                <div className="text-xs text-muted-foreground/60">Tỷ lệ anomaly</div>
              </div>
              <div className="p-6 rounded-xl bg-card/50 border border-border">
                <div className="text-2xl font-bold text-primary">
                  {Object.keys(report.source_counts).length} nguồn
                </div>
                <div className="text-xs text-muted-foreground/60">Nguồn dữ liệu</div>
              </div>
            </div>

            {/* Priority Breakdown */}
            <div className="grid grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg border ${PRIORITY_COLORS.high}`}>
                <div className="text-xl font-bold">{report.summary.priority_breakdown.high}</div>
                <div className="text-xs">Ưu tiên Cao</div>
              </div>
              <div className={`p-4 rounded-lg border ${PRIORITY_COLORS.medium}`}>
                <div className="text-xl font-bold">{report.summary.priority_breakdown.medium}</div>
                <div className="text-xs">Ưu tiên Trung bình</div>
              </div>
              <div className={`p-4 rounded-lg border ${PRIORITY_COLORS.low}`}>
                <div className="text-xl font-bold">{report.summary.priority_breakdown.low}</div>
                <div className="text-xs">Ưu tiên Thấp</div>
              </div>
            </div>
          </>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 p-4 bg-card/30 rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="include-clean"
              checked={includeClean}
              onChange={(e) => setIncludeClean(e.target.checked)}
              className="w-4 h-4 rounded bg-card border-border text-primary focus:ring-primary"
            />
            <label htmlFor="include-clean" className="text-sm text-muted-foreground/60">
              Bao gồm dữ liệu sạch
            </label>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, địa chỉ, loại lỗi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card border border-border rounded-lg pl-10 pr-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={() => {
              const csv = _exportCsv(filteredAnomalies || []);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `data_quality_report_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Đã xuất file CSV');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-foreground rounded-lg font-bold text-sm hover:bg-primary/80 transition-all"
          >
            <Download className="w-4 h-4" />
            Xuất CSV
          </button>
        </div>

        {/* Anomaly Table + Map Side by Side */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Anomaly Table */}
          <div className="bg-card/30 border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-card/50 flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Danh sách Anomaly ({filteredAnomalies.length})
              </h2>
              <span className="text-xs text-muted-foreground/60">
                {filteredAnomalies.length} / {report?.summary.total_anomalies || 0} anomaly
              </span>
            </div>
            <div className="overflow-y-auto max-h-[520px]">
              {filteredAnomalies.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground/60">
                  Không tìm thấy anomaly nào phù hợp.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-card/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-bold">Ưu tiên</th>
                      <th className="text-left p-3 font-bold">Tên</th>
                      <th className="text-left p-3 font-bold">Loại lỗi</th>
                      <th className="text-right p-3 font-bold">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnomalies.map((a) => (
                      <tr key={a.id} className="border-t border-border/30 hover:bg-card/50">
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold border ${PRIORITY_COLORS[a.priority]}`}>
                            {a.priority.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{a.name || <i className="text-muted-foreground/40">Không tên</i>}</div>
                          <div className="text-xs text-muted-foreground/60">
                            {a.address || a.city || '—'}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {a.anomaly_types.map((t) => (
                              <span key={t} className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs">
                                {ANOMALY_TYPE_LABELS[t] || t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-bold">{Math.round(a.confidence * 100)}%</span>
                          {a.iforest_score !== null && (
                            <div className="text-xs text-muted-foreground/40">
                              IF: {a.iforest_score}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="bg-card/30 border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-card/50">
              <h2 className="font-bold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Bản đồ Anomaly ({mapPoints.length} điểm)
              </h2>
            </div>
            <div className="h-[520px] relative">
              {mapPoints.length > 0 && (
                <MapComponentWithAnomalies points={mapPoints} />
              )}
              {mapPoints.length === 0 && (
                <div className="h-full flex items-center justify-center text-muted-foreground/60">
                  Không có tọa độ hợp lệ để hiển thị trên bản đồ.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Source Counts */}
        {report && Object.keys(report.source_counts).length > 0 && (
          <div className="p-4 bg-card/30 rounded-xl border border-border">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Nguồn dữ liệu
            </h3>
            <div className="flex flex-wrap gap-4 text-sm">
              {Object.entries(report.source_counts).map(([source, count]) => (
                <div key={source} className="flex items-center gap-2">
                  <span className="text-muted-foreground/60">{source}:</span>
                  <span className="font-bold text-primary">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Custom map component that renders anomaly markers
function MapComponentWithAnomalies({ points }: { points: any[] }) {
  // Determine center from anomaly points
  const center: [number, number] = points.length > 0
    ? [
        points.reduce((s, p) => s + p.lat, 0) / points.length,
        points.reduce((s, p) => s + p.lng, 0) / points.length,
      ]
    : [10.9567, 107.1825];

  return (
    <MapContainer
      center={center}
      zoom={10}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {points.map((pt) => (
        <CircleMarker
          key={pt.id}
          center={[pt.lat, pt.lng]}
          radius={Math.max(5, 5 + (pt.confidence * 8))}
          color={pt.priority === 'high' ? '#ef4444' : pt.priority === 'medium' ? '#f59e0b' : '#3b82f6'}
          weight={2}
          fillOpacity={0.6}
        >
          <Popup>
            <div className="text-sm">
              <strong>{pt.name}</strong>
              <div className="text-xs text-muted-foreground">
                {pt.address || ''}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {pt.anomaly_types.map((t: string) => (
                  <span key={t} className="text-xs bg-red-500/20 text-red-400 px-1 rounded">
                    {ANOMALY_TYPE_LABELS[t] || t}
                  </span>
                ))}
              </div>
              <div className="mt-1 font-bold">
                Confidence: {Math.round(pt.confidence * 100)}%
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

// ── CSV export helper ──────────────────────────────────────────────────────
function _exportCsv(anomalies: Anomaly[]): string {
  const headers = ['ID', 'Name', 'Category', 'Lat', 'Lng', 'Address', 'City', 'Anomaly Types', 'Reasons', 'Confidence', 'Priority', 'Source', 'Updated At'];
  const rows = anomalies.map((a) => [
    a.id,
    a.name || '',
    a.category,
    a.lat?.toString() || '',
    a.lng?.toString() || '',
    a.address || '',
    a.city || '',
    a.anomaly_types.join('; '),
    a.reasons.join('; '),
    a.confidence.toString(),
    a.priority,
    a.source,
    a.updated_at || '',
  ]);
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}
