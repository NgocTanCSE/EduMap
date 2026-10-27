/**
 * AI Agent Tool — Natural Language → GIS chat UI on the unified Map Hub.
 *
 * Previously a standalone page at `/ai-agent`; now the `ai-agent` tab on `/map`.
 * Users type questions like "Tìm khu vực cách thư viện trên 5km" and the AI
 * agent converts them into GIS queries via the backend → ai-service agent loop.
 *
 * Panel: chat conversation with tool-call visualization + sources.
 * Overlay: AI agent results rendered as map markers.
 */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Wrench, FileText, Loader2, MapPin, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

interface ToolCall {
  tool: string;
  arguments?: Record<string, unknown>;
  result_preview?: string;
  error?: string;
  _key: string;
}

interface Source {
  doc_id: string;
  title: string;
  snippet: string;
  type?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  toolsUsed?: ToolCall[];
  sources?: Source[];
  degraded?: boolean;
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = Object.keys(localStorage).find(
      (k) => k.includes("accessToken") || k.includes("token") || k.includes("auth"),
    );
    if (key) {
      const val = JSON.parse(localStorage.getItem(key) || "{}");
      if (typeof val === "string") return val;
      return val?.accessToken || val?.token || null;
    }
  } catch {
    const raw = localStorage.getItem("accessToken");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === "string" ? parsed : parsed?.accessToken || parsed?.token || null;
      } catch {
        return raw;
      }
    }
  }
  return null;
}

export function AiAgentPanel({
  viewport, result, onResult, loading, setLoading, error, setError,
  active, user,
}: any) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsStreaming(true);
    setError(null);

    const assistantMessage: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    const controller = new AbortController();
    streamControllerRef.current = controller;

    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetchWithRetry("/api/ai/agent/chat-stream", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Không thể kết nối đến AI Agent");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream không khả dụng");

      const decoder = new TextDecoder();
      let collectedContent = "";
      let toolsUsed: ToolCall[] = [];
      let sources: Source[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              collectedContent += data.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: collectedContent }
                    : m
                )
              );
            }
            if (data.tool_calls) {
              toolsUsed = [...toolsUsed, ...data.tool_calls];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, toolsUsed: [...toolsUsed] }
                    : m
                )
              );
            }
            if (data.sources) {
              sources = [...sources, ...data.sources];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, sources: [...sources] }
                    : m
                )
              );
            }
            if (data.degraded) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id ? { ...m, degraded: true } : m
                )
              );
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, isStreaming: false }
            : m
        )
      );
      onResult({ messages, collectedContent });

      // Parse geo results from the response
      const geoMatch = collectedContent.match(/\[([0-9.]+),\s*([0-9.]+)\]/);
      if (geoMatch) {
        const lat = parseFloat(geoMatch[1]);
        const lng = parseFloat(geoMatch[2]);
        onResult({ lat, lng, content: collectedContent });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Lỗi kết nối AI");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  isStreaming: false,
                  content: "Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này. Hãy thử lại sau.",
                  degraded: true,
                }
              : m
          )
        );
        toast.error("Lỗi kết nối AI Agent");
      }
    } finally {
      setIsStreaming(false);
      streamControllerRef.current = null;
    }
  }, [inputValue, isStreaming, messages]);

  const handleStop = () => {
    streamControllerRef.current?.abort();
    setIsStreaming(false);
  };

  if (!active) return null;

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
        <Bot className="w-4 h-4 text-primary" /> AI Agent bản đồ
      </h3>

      <div
        ref={messagesEndRef}
        className="flex-1 overflow-y-auto space-y-3 text-xs pb-2"
      >
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground/60">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Hãy hỏi tôi về bản đồ giáo dục.</p>
            <p className="text-xs mt-1">Ví dụ: "Tìm trường học gần kề"</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2.5 rounded-lg text-xs ${
                msg.role === "user"
                  ? "bg-primary/10 text-foreground ml-auto max-w-[80%]"
                  : "bg-muted/20 text-foreground/90 mr-auto max-w-[80%]"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">
                {msg.content || (
                  <span className="inline-flex items-center gap-1 text-muted-foreground/50">
                    <Loader2 className="w-3 h-3 animate-spin" /> Đang trả lời...
                  </span>
                )}
              </div>
              {msg.degraded && (
                <div className="mt-1 flex items-center gap-1 text-amber-500">
                  <AlertCircle className="w-3 h-3" /> Trả lời dự phòng
                </div>
              )}
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {msg.toolsUsed.map((t) => (
                    <div key={t._key} className="flex items-start gap-1 text-muted-foreground/60">
                      <Wrench className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{t.tool}</span>
                    </div>
                  ))}
                </div>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {msg.sources.map((s) => (
                    <div key={s.doc_id} className="flex items-start gap-1 text-muted-foreground/60">
                      <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{s.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isStreaming && handleSendMessage()}
          placeholder="Hỏi về bản đồ..."
          disabled={isStreaming}
          className="flex-1 text-xs text-foreground bg-card border border-border rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary"
        />
        {isStreaming ? (
          <button
            onClick={handleStop}
            className="px-3 py-1.5 rounded-lg bg-muted/30 text-xs font-medium"
          >
            Dừng
          </button>
        ) : (
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function AiAgentOverlay({ result }: { result: any; loading: boolean; points: any[]; viewport: any }) {
  const locations = result?.locations;
  if (!locations || !locations.length) return null;

  return (
    <>
      {locations.map((loc: any) => (
        <Marker
          key={loc.id || `${loc.lat}-${loc.lng}`}
          position={[loc.lat, loc.lng]}
          icon={L.divIcon({
            html: `<div style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;background:#8b5cf6;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ffffff" width="10" height="10"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13 3.87-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 22],
            popupAnchor: [0, -26],
          })}
        >
          <Popup>
            <div className="space-y-1">
              <div className="font-medium text-sm">{loc.name}</div>
              <div className="text-xs text-muted-foreground/70">{loc.category}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

const AiAgentTool = {
  id: "ai-agent",
  label: "AI Agent",
  longLabel: "AI Agent bản đồ",
  icon: Bot,
  description: "Chat tự nhiên → truy vấn bản đồ qua AI agent.",
  longDescription: "Nhập câu hỏi bằng ngôn ngữ tự nhiên, AI chuyển đổi thành truy vấn GIS và hiển thị kết quả trên bản đồ.",
  authRequired: false,
  hideBaseLayers: false,
  Panel: AiAgentPanel,
  Overlay: AiAgentOverlay,
};

export default AiAgentTool;
