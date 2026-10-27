/**
 * EduMap AI Agent — Natural Language → GIS chat UI.
 *
 * Users type questions like "Tìm khu vực cách thư viện trên 5km" and the AI
 * agent converts them into GIS queries via the backend → ai-service agent loop.
 *
 * Features:
 *  - SSE streaming (token-by-token) via /api/ai/agent/chat-stream BFF handler
 *  - Tool-call visualization (shows each tool invoked with arguments)
 *  - Sources panel (rag_search docs + sqlite rows)
 *  - Graceful degradation when AI service is unreachable
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ComponentType } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
// Use a lightweight inline check if the auth hook is unavailable
import { getBackendUrl } from '@/src/lib/api-config';
import {
  BarChart3,
  BookOpen,
  Bot,
  Database,
  Loader2,
  Map as MapIcon,
  MapPin,
  Wrench,
} from 'lucide-react';

// Lightweight token accessor — mirrors the pattern in app/ai-chat/page.tsx
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = Object.keys(localStorage).find(
      (k) => k.includes('accessToken') || k.includes('token') || k.includes('auth'),
    );
    if (key) {
      const val = JSON.parse(localStorage.getItem(key) || '{}');
      if (typeof val === 'string') return val;
      return val?.accessToken || val?.token || null;
    }
  } catch {
    const raw = localStorage.getItem('accessToken');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'string' ? parsed : parsed?.accessToken || parsed?.token || null;
      } catch {
        return raw;
      }
    }
  }
  return null;
}

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
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  toolsUsed?: ToolCall[];
  sources?: Source[];
  degraded?: boolean;
}

const CATEGORIES = [
  { value: '', label: 'Tất cả' },
  { value: 'university', label: 'Đại học' },
  { value: 'school', label: 'Trường học' },
  { value: 'library', label: 'Thư viện' },
  { value: 'cafe', label: 'Cà phê' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'green', label: 'Không gian xanh' },
];

export default function AIAgentPage() {
  const { user } = useAuth ? useAuth() : { user: null };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamControllerRef = useRef<AbortController | null>(null);

  // Auto-generate session_id (mirrors app/ai-chat/page.tsx pattern)
  const sessionIdRef = useRef<string>(
    typeof window !== 'undefined' && window.crypto
      ? crypto.randomUUID()
      : `sess_${Math.random().toString(36).slice(2, 10)}`,
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── SSE streaming ──────────────────────────────────────────────────────

  const streamChat = useCallback(async (question: string) => {
    const token = getAccessToken();
    const response = await fetch('/api/ai/agent/chat-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: question,
        history: messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content })),
        context: user ? { user_id: user.id, user_email: user.email, user_name: user.fullName } : {},
        session_id: sessionIdRef.current,
      }),
    });

    if (!response.ok) {
      let detail = 'Lỗi kết nối';
      try {
        const err = await response.json();
        detail = err?.detail || err?.message || detail;
      } catch { /* ignore */ }
      throw new Error(detail);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Không có response body.');

    const agentMsg: ChatMessage = {
      id: `agent-${Date.now()}`,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolsUsed: [],
      sources: [],
    };
    setMessages((prev) => [...prev, agentMsg]);

    let currentId = agentMsg.id;
    const decoder = new TextDecoder('utf-8');
    let rawBuffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawBuffer += decoder.decode(value, { stream: true });

        // Split on event boundaries (double newline)
        const events = rawBuffer.split('\n\n');
        rawBuffer = events.pop() || ''; // keep incomplete final chunk

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith('data:')) continue;
          const dataStr = line.slice(5).trim(); // remove 'data:'
          if (!dataStr || dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);

            // Meta chunk: sources + tools_used
            if (parsed.meta) {
              if (Array.isArray(parsed.sources)) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentId
                      ? { ...m, sources: parsed.sources as Source[] }
                      : m,
                  ),
                );
              }
              if (Array.isArray(parsed.tools_used)) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentId
                      ? { ...m, toolsUsed: (parsed.tools_used as ToolCall[]).map((tu) => ({ ...tu, _key: `${tu.tool}-${Math.random().toString(36).slice(2, 8)}` })) }
                      : m,
                  ),
                );
              }
            }

            // Token chunk
            if (typeof parsed.token === 'string') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === currentId
                    ? { ...m, content: m.content + parsed.token }
                    : m,
                ),
              );
              currentId = currentId; // no-op to keep linter happy
            }

            // Done chunk
            if (parsed.done) {
              setMessages((prev) =>
                prev.map((m) => (m.id === currentId ? { ...m, isStreaming: false } : m)),
              );
            }
          } catch {
            // not JSON — ignore non-data lines
          }
        }
      }
    } finally {
      reader.releaseLock();
      // Ensure streaming flag is off
      setMessages((prev) =>
        prev.map((m) => (m.id === currentId ? { ...m, isStreaming: false } : m)),
      );
      setIsStreaming(false);
    }
  }, [messages, user]);

  // ── Non-streaming fallback ────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const question = inputValue.trim();
    if (!question || isStreaming) return;

    const token = getAccessToken();

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsStreaming(true);

    try {
      await streamChat(question);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định';
      const agentMsg: ChatMessage = {
        id: `agent-err-${Date.now()}`,
        role: 'assistant',
        content: errMsg,
        isStreaming: false,
        sources: [],
        degraded: true,
      };
      setMessages((prev) => [...prev, agentMsg]);
      setIsStreaming(false);
    }
  }, [inputValue, isStreaming, streamChat]);

  // ── Quick-suggestion chips ────────────────────────────────────────────

  const quickQuestions = [
    'Tìm khu vực cách thư viện trên 5km → đề xuất 3 vị trí hỗ trợ.',
    'Những trường học nào gần DNTU?',
    'Tìm các điểm wifi gần nhất.',
    'Lộ trình học AI cho sinh viên năm 3.',
  ];

  // ── Render helpers ────────────────────────────────────────────────────

  const renderToolCall = (tc: ToolCall) => {
    const iconMap: Record<string, ComponentType<{ className?: string }>> = {
      query_sqlite: Database,
      geo_recommend: MapPin,
      geo_density: BarChart3,
      rag_search: BookOpen,
    };
    const ToolIcon = iconMap[tc.tool] || Wrench;
    return (
      <div
        key={tc._key}
        className="mb-2 rounded-md border border-primary/25 bg-primary/10 p-3 text-sm"
      >
        <div className="flex items-center gap-2 font-semibold text-primary">
          <ToolIcon className="h-3.5 w-3.5" />
          <span>{tc.tool}</span>
        </div>
        {tc.error && <div className="mt-1 text-destructive">Lỗi: {tc.error}</div>}
        {tc.arguments && !tc.error && (
          <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-foreground/70">
            {JSON.stringify(tc.arguments, null, 2)}
          </pre>
        )}
        {tc.result_preview && (
          <div className="mt-1 max-h-24 overflow-y-auto text-xs text-accent">
            {tc.result_preview}
          </div>
        )}
      </div>
    );
  };

  const renderSources = (sources: Source[]) => {
    if (!sources || sources.length === 0) return null;
    return (
      <div className="mt-3 space-y-2">
        {sources.map((s, i) => (
          <div
            key={s.doc_id || i}
            className="rounded-md border border-border bg-background/60 p-2 text-xs"
          >
            <div className="font-medium">{s.title || 'Nguồn dữ liệu'}</div>
            <div className="mt-1 max-h-20 overflow-y-auto text-foreground/70">
              {s.snippet || 'Không có mô tả'}
            </div>
            {s.type && (
              <span className="inline-block px-1.5 py-0.5 text-[10px] uppercase text-foreground/55">
                {s.type}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-background lg:h-dvh">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 shadow-sm">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-xl font-bold text-foreground">Edumap AI Agent</h1>
          <p className="text-sm text-foreground/55">
            Đặt câu hỏi bằng ngôn ngữ tự nhiên → AI chuyển thành truy vấn GIS
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {messages.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card">
                <MapIcon aria-hidden="true" className="h-7 w-7 text-primary" />
              </div>
              <h2 className="mb-2 text-lg font-semibold text-foreground/80">
                Chào mừng bạn đến với Edumap AI Agent
              </h2>
              <p className="mb-6 text-foreground/55">
                Hãy hỏi về địa điểm giáo dục, học bổng, lộ trình học tập,
                hay bất kỳ câu hỏi nào liên quan đến bản đồ giáo dục!
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {quickQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInputValue(q)}
                    className="max-w-xs rounded-full border border-input bg-card px-4 py-2 text-left text-sm text-foreground/80 shadow-sm hover:bg-muted"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                {/* User message */}
                {msg.role === 'user' && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-lg bg-primary px-4 py-2 text-primary-foreground shadow">
                      {msg.content}
                    </div>
                  </div>
                )}

                {/* Assistant message */}
                {msg.role === 'assistant' && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div
                        className={`prose max-w-none text-foreground ${msg.degraded ? 'opacity-60' : ''}`}
                      >
                        {msg.content ? (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        ) : (
                          <span className="text-foreground/40">Đang suy nghĩ...</span>
                        )}
                      </div>

                      {/* Tool-call visualization */}
                      {msg.toolsUsed && msg.toolsUsed.length > 0 && showTools && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs font-semibold text-foreground/55">
                            Công cụ đã sử dụng:
                          </div>
                          {msg.toolsUsed.map(renderToolCall)}
                        </div>
                      )}
                      {msg.toolsUsed && msg.toolsUsed.length > 0 && !showTools && (
                        <button
                          onClick={() => setShowTools(true)}
                          className="text-xs text-primary hover:underline"
                        >
                          Hiện {msg.toolsUsed.length} công cụ đã dùng
                        </button>
                      )}

                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2">
                          {!showSources && (
                            <button
                              onClick={() => setShowSources(true)}
                              className="text-xs text-primary hover:underline"
                            >
                              Hiện {msg.sources.length} nguồn tham khảo
                            </button>
                          )}
                          {showSources && (
                            <>
                              <div className="mb-1 text-xs font-semibold text-foreground/55">
                                Nguồn tham khảo:
                              </div>
                              {renderSources(msg.sources)}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Ví dụ: Tìm trường học cách thư viện 5km..."
              disabled={isStreaming}
              className="w-full rounded-lg border border-input px-4 py-3 text-foreground placeholder:text-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <button
              onClick={() => void sendMessage()}
              disabled={isStreaming || !inputValue.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isStreaming ? '...' : 'Gửi'}
            </button>
          </div>

          {/* Status bar */}
          {isStreaming && (
            <div className="mt-2 flex items-center gap-2 text-xs text-foreground/55">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>AI đang phân tích và thu thập dữ liệu GIS...</span>
            </div>
          )}

          {/* Stop button */}
          {isStreaming && (
            <button
              onClick={() => streamControllerRef.current?.abort()}
              className="mt-1 text-xs text-foreground/55 hover:text-destructive"
            >
              Dừng trả lời
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
