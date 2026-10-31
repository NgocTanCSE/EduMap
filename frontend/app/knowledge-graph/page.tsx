"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Network, Info, X, ExternalLink, Target, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import ContentShell from "@/components/ui/ContentShell";
import SectionHeader from "@/components/ui/SectionHeader";
import { toast } from "sonner";
import { authService } from "@/src/services/auth.service";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  knowledgeGraphService,
  KnowledgeNode,
  KnowledgeEdge,
  PartnerSuggestion,
} from "@/src/services/knowledge.service";
import ForceGraph from "@/components/knowledge/ForceGraph";

export interface KnowledgeNodeWithLinks extends KnowledgeNode {
  linked_nodes?: any[];
}

export default function KnowledgeGraphPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [graph, setGraph] = useState<{
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
    meta: Record<string, any>;
  }>({ nodes: [], edges: [], meta: {} });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNodeWithLinks | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partners, setPartners] = useState<PartnerSuggestion[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login?redirect=/knowledge-graph");
    }
  }, [user, authLoading, router]);

  // Load full graph on mount
  useEffect(() => {
    if (!user) return;
    loadGraph();
  }, [user]);

  const loadGraph = useCallback(async () => {
    try {
      setLoading(true);
      const data = await knowledgeGraphService.getGraph(undefined, 500);
      setGraph({
        nodes: data.nodes || [],
        edges: data.edges || [],
        meta: data.meta || {},
      });
      if (data.degraded) {
        toast.info("Knowledge graph đang được đồng bộ, một số dữ liệu có thể chưa sẵn sàng.");
      }
    } catch (err) {
      console.error("Load graph error:", err);
      toast.error("Không thể tải knowledge graph");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNodeClick = useCallback(async (node: KnowledgeNode) => {
    setSelectedNode(node);
    setQueryLoading(true);
    setQueryResult(null);
    try {
      const result = await knowledgeGraphService.queryGraph(node.id, undefined, 1, 50);
      const nodeWithLinks: KnowledgeNodeWithLinks = {
        ...node,
        linked_nodes: result.neighbors || [],
      };
      setSelectedNode(nodeWithLinks);
      setQueryResult({
        start_node: result.start_node,
        neighbors: result.neighbors || [],
        edges: result.edges || [],
        meta: result.meta || {},
      });
    } catch (err) {
      console.error("Query graph error:", err);
      toast.error("Không thể truy vấn node này");
    } finally {
      setQueryLoading(false);
    }
  }, []);

  const handleSuggestPartners = async () => {
    if (!partnerQuery.trim()) return;
    try {
      setPartnerLoading(true);
      const data = await knowledgeGraphService.suggestPartners(partnerQuery, 10);
      setPartners(data.suggestions || []);
      if (data.degraded) {
        toast.info("AI chưa sẵn sàng, đang dùng kết quả dự phòng.");
      }
    } catch (err) {
      console.error("Suggest partners error:", err);
      toast.error("Không thể gợi ý đối tác");
    } finally {
      setPartnerLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ContentShell>
      <SectionHeader
        title="AI Knowledge Graph"
        subtitle="Liên kết trường học, nhu cầu, học bổng, nhà tài trợ và tài nguyên. Nhấp vào một node để khám phá mối quan hệ 1-degree."
        icon={Network}
      />

      {/* Partner suggestion search */}
      <Card className="p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Tìm nhà tài trợ/đối tác (ví dụ: học bổng Hàn Quốc)..."
            value={partnerQuery}
            onChange={(e) => setPartnerQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSuggestPartners()}
            className="flex-1"
          />
          <Button
            variant="default"
            onClick={handleSuggestPartners}
            disabled={partnerLoading || !partnerQuery.trim()}
          >
            {partnerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target />}
            <span className="ml-2">Gợi ý đối tác</span>
          </Button>
        </div>

        {/* Partner suggestions results */}
        {partners.length > 0 && (
          <div className="mt-4 space-y-2">
            {partners.map((p) => (
              <div key={p.node_id} className="flex items-start justify-between rounded-lg border p-2">
                <div>
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {" "}· {p.type} · điểm số: {p.match_score}
                  </span>
                  {p.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </div>
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Nguồn
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Force-directed graph */}
        <div className="lg:col-span-2">
          <Card className="p-4 h-[600px] relative">
            {loading ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Đang tải knowledge graph...</span>
              </div>
            ) : graph.nodes.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center text-center">
                <Network className="h-12 w-12 text-muted-foreground/45 mb-2" />
                <div>
                  <p className="text-muted-foreground">Knowledge graph đang trống.</p>
                  <p className="text-sm text-muted-foreground/70">
                    Nhấn đồng ý để đồng bộ, hoặc chờ cập nhật hàng giờ.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <ForceGraph
                  nodes={graph.nodes}
                  edges={graph.edges}
                  onNodeClick={handleNodeClick}
                />
                <div className="absolute bottom-2 right-2 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground">
                  {graph.nodes.length} nodes · {graph.edges.length} edges
                  {graph.meta?.degraded && " · chế độ giảm tốc"}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Side panel: selected node details */}
        <div className="space-y-4">
          {selectedNode ? (
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{selectedNode.name}</h3>
                  <span
                    className="inline-block rounded px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${getNodeColor(selectedNode.type)}20`,
                      color: getNodeColor(selectedNode.type),
                    }}
                  >
                    {selectedNode.type}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {selectedNode.description && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {selectedNode.description || ""}
                </p>
              )}

              {selectedNode.url && (
                <a
                  href={selectedNode.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-sm text-primary hover:underline"
                >
                  <ExternalLink className="inline h-3 w-3" />
                  Truy cập nguồn chính thức
                </a>
              )}

              {queryLoading && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang truy vấn lân cận 1-degree...
                </div>
              )}

              {queryResult && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium">
                    Lân cận 1-degree ({queryResult.neighbors.length} nodes)
                  </h4>
                  {queryResult.neighbors.map((nb: KnowledgeNode) => (
                    <div
                      key={nb.id}
                      className="flex items-center justify-between rounded border px-2 py-1"
                    >
                      <span className="text-sm">{nb.name?.slice(0, 30) || nb.id.slice(0, 8)}</span>
                      <span className="text-xs text-muted-foreground">{nb.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <h3 className="font-semibold">Chọn một node</h3>
                  <p className="text-sm text-muted-foreground">
                    Nhấp vào bất kỳ node nào trên đồ thị để xem mối quan hệ
                    1-degree và thông tin chi tiết.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </ContentShell>
  );
}

const NODE_COLORS: Record<string, string> = {
  university: "#4f46e5",
  school: "#6366f1",
  scholarship: "#eab308",
  sponsor: "#2563eb",
  opportunity: "#16a34a",
  career_path: "#dc2626",
  learning_material: "#7c3aed",
  internship: "#0d9488",
  international_program: "#be123c",
  skill: "#f59e0b",
  region: "#6b7280",
  lab: "#8b5cf6",
  library: "#84cc16",
  unknown: "#9ca3af",
};

function getNodeColor(type: string): string {
  return NODE_COLORS[type] || NODE_COLORS.unknown;
}
