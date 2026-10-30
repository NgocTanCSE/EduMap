/**
 * EduMap Edge AI Tutor — Offline Page (Idea #7)
 *
 * A PWA-enabled page that lets students get AI tutoring (explain concepts,
 * generate practice questions, get study suggestions) WITHOUT internet —
 * the model (TinyLlama 1.1B Chat, 4-bit) runs locally inside the
 * ai-service container on HF Spaces.
 *
 * Features:
 *  - Three modes: Explain, Practice, Suggest (action selector)
 *  - Shows `degraded` flag when using template fallback
 *  - PWA cache via next-pwa (runtime caching for API responses)
 *  - Graceful error handling — always returns a response
 *  - Vietnamese UI (matches the rest of EduMap)
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CloudOff,
  Loader2,
  PencilLine,
  Target,
  Timer,
} from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';

// ── Types ──────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  degraded?: boolean;
  source?: string;
  questions?: Array<{ question: string; answer: string; difficulty: string }>;
  nextStep?: string;
  estimatedTime?: string;
}

type TutorAction = 'explain' | 'practice' | 'suggest';

interface StatusData {
  model_loaded: boolean;
  model_failed: boolean;
  model_name?: string;
  source?: string;
  error?: string;
}

// ── Token accessor (mirrors ai-chat/page.tsx pattern) ──────────────

function getAccessTokenLocal(): string | null {
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
        return typeof parsed === 'string'
          ? parsed
          : parsed?.accessToken || parsed?.token || null;
      } catch {
        return raw;
      }
    }
  }
  return null;
}

// ── Main component ──────────────────────────────────────────────────

export default function OfflineTutorPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputTopic, setInputTopic] = useState('');
  const [inputContext, setInputContext] = useState('');
  const [selectedAction, setSelectedAction] = useState<TutorAction>('explain');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [numQuestions, setNumQuestions] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState<StatusData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch model status on mount
  useEffect(() => {
    void fetchStatus();
  }, []);

  // ── API calls ────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/offline/tutor/status');
      if (res.ok) {
        const data = await res.json();
        setModelStatus(data);
      }
    } catch {
      setModelStatus({ model_loaded: false, model_failed: true, source: 'unknown' });
    }
  }, []);

  // ── Send request ─────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const topic = inputTopic.trim();
    if (!topic || isLoading) return;

    const token = getAccessTokenLocal();

    // Build the request body based on the selected action
    const body: Record<string, any> = {
      action: selectedAction,
      topic,
    };

    if (selectedAction === 'explain') {
      if (inputContext.trim()) body.material_context = inputContext.trim();
      if (user) body.progression = { user_id: user.id };
    } else if (selectedAction === 'practice') {
      body.difficulty = difficulty;
      body.num_questions = numQuestions;
    } else if (selectedAction === 'suggest') {
      body.progression = {
        topics_studied: topic.split(',').map((t) => t.trim()).filter(Boolean),
        current_level: difficulty,
        weak_areas: [],
        goals: inputContext.trim() || '',
      };
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: topic,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputTopic('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/offline/tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      let assistantContent = '';
      let assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        degraded: result?.degraded || false,
        source: result?.source || 'unknown',
      };

      if (selectedAction === 'explain') {
        assistantContent = result?.text || '';
        assistantMsg.content = assistantContent;

        if (result?.degraded) {
          assistantMsg.content = result.text || '';
        }
      } else if (selectedAction === 'practice') {
        const questions = result?.questions || [];
        assistantMsg.questions = questions;
        assistantMsg.content = questions
          .map(
            (q: any, i: number) =>
              `**Câu ${i + 1} (${q.difficulty || 'medium'})**: ${q.question}\n` +
              `→ *Đáp án*: ${q.answer || 'Xem lời giải'}`,
          )
          .join('\n\n');
      } else if (selectedAction === 'suggest') {
        assistantMsg.nextStep = result?.next_step || '';
        assistantMsg.estimatedTime = result?.estimated_time || '';
        assistantMsg.content = result?.next_step
          ? `**Bước tiếp theo**: ${result.next_step}\n` +
            (result.estimated_time ? `Thời gian ước tính: ${result.estimated_time}\n` : '') +
            (result.resources && result.resources.length > 0
              ? `\n**Tài nguyên**: ${result.resources.map((r: any) => r.title || r).join(', ')}\n`
              : '')
          : 'Không có đề xuất nào.';
      }

      setMessages((prev) => [...prev, { ...assistantMsg, content: assistantMsg.content }]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Không thể kết nối tới trợ lý AI ngoại tuyến. Vui lòng thử lại.',
        degraded: true,
        source: 'network-error',
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputTopic, inputContext, selectedAction, difficulty, numQuestions, isLoading, user]);

  // ── Quick-suggestion chips ──────────────────────────────────────

  const quickTopics = [
    'Đạo hàm',
    'Vi phân',
    'Xác suất',
    'Ma trận',
    'Lập trình Python',
    'Hóa học',
  ];

  // ── Render helpers ──────────────────────────────────────────────

  const renderDegradedBadge = (msg: ChatMessage) => {
    if (!msg.degraded) return null;
    const bg = msg.source === 'model'
      ? 'border border-accent/30 bg-accent/10 text-accent'
      : 'border border-primary/30 bg-primary/10 text-primary';
    const label = msg.source === 'model'
      ? 'Mô hình AI đang chạy'
      : 'Đang dùng bản sao chép mẫu (offline mode)';
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bg}`}>
        {label}
      </span>
    );
  };

  const renderQuestionCard = (q: { question: string; answer: string; difficulty: string }, idx: number) => (
    <div key={idx} className="rounded-lg border border-border bg-background p-3 text-sm">
      <div className="mb-1 font-medium text-foreground">
        Câu {idx + 1} — <span className={`text-xs uppercase ${
          q.difficulty === 'easy' ? 'text-accent' :
          q.difficulty === 'hard' ? 'text-destructive' : 'text-primary'
        }`}>{q.difficulty}</span>
      </div>
      <div className="mb-2 text-foreground/80">{q.question}</div>
      <details className="text-xs text-foreground/70">
        <summary className="cursor-pointer font-medium text-primary">Xem đáp án</summary>
        <div className="mt-1 text-foreground/70">{q.answer || 'Chưa có lời giải'}</div>
      </details>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────

  const isModelReady = modelStatus?.model_loaded === true;
  const isModelFailed = modelStatus?.model_failed === true;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-background lg:h-dvh">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 shadow-sm">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <CloudOff className="h-5 w-5 text-primary" />
                Trợ lý ngoại tuyến
              </h1>
              <p className="text-sm text-foreground/55">
                Gia sư AI cục bộ — không cần internet (TinyLlama 1.1B Chat)
              </p>
            </div>
            {modelStatus && (
              <div className="text-right text-xs text-foreground/55">
                {isModelReady ? (
                  <span className="inline-flex items-center gap-1.5 text-accent">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mô hình đã sẵn sàng
                  </span>
                ) : isModelFailed ? (
                  <span className="inline-flex items-center gap-1.5 text-primary">
                    <AlertTriangle className="h-3.5 w-3.5" /> Đang dùng bản sao chép mẫu
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-foreground/40">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải mô hình…
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {messages.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card">
                <BookOpen aria-hidden="true" className="h-7 w-7 text-primary" />
              </div>
              <h2 className="mb-2 text-lg font-semibold text-foreground/80">
                Trợ lý ngoại tuyến — Trợ lý AI cục bộ
              </h2>
              <p className="mb-6 max-w-md text-sm text-foreground/55">
                Hỏi về bất kỳ chủ đề học tập nào — mô hình AI chạy trực tiếp
                trên thiết bị, không cần kết nối internet. Hoạt động với
                bản sao chép mẫu ngay cả khi mô hình chưa tải xong.
              </p>

              <div className="mb-4 flex flex-wrap justify-center gap-2">
                {quickTopics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => setInputTopic(topic)}
                    className="rounded-full border border-input bg-card px-3 py-1 text-sm text-foreground/80 shadow-sm hover:bg-muted"
                  >
                    {topic}
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
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className={`prose max-w-none text-foreground ${msg.degraded ? 'opacity-75' : ''}`}>
                        {msg.questions && msg.questions.length > 0 ? (
                          <div className="space-y-2">
                            {msg.questions.map((q, i) => renderQuestionCard(q, i))}
                          </div>
                        ) : msg.nextStep ? (
                          <div className="whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        ) : msg.content ? (
                          <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.content }} />
                        ) : (
                          <span className="text-foreground/40">Đang xử lý...</span>
                        )}
                      </div>

                      {/* Metadata badges */}
                      <div className="flex items-center gap-2">
                        {renderDegradedBadge(msg)}
                        {msg.estimatedTime && (
                          <span className="inline-flex items-center gap-1 text-xs text-foreground/55">
                            <Timer className="h-3.5 w-3.5" /> {msg.estimatedTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card px-4 py-4">
        <div className="mx-auto max-w-4xl">
          {/* Action selector */}
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setSelectedAction('explain')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedAction === 'explain'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground/80 hover:bg-muted/80'
              }`}
            >
              <BookOpen className="h-4 w-4" /> Giải thích
            </button>
            <button
              onClick={() => setSelectedAction('practice')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedAction === 'practice'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground/80 hover:bg-muted/80'
              }`}
            >
              <PencilLine className="h-4 w-4" /> Luyện tập
            </button>
            <button
              onClick={() => setSelectedAction('suggest')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedAction === 'suggest'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground/80 hover:bg-muted/80'
              }`}
            >
              <Target className="h-4 w-4" /> Đề xuất
            </button>
          </div>

          {/* Input fields */}
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={inputTopic}
                onChange={(e) => setInputTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={
                  selectedAction === 'explain'
                    ? 'Nhập chủ đề cần giải thích...'
                    : selectedAction === 'practice'
                    ? 'Nhập chủ đề cần luyện tập...'
                    : 'Nhập chương đã học và điểm yếu...'
                }
                disabled={isLoading}
                className="form-input"
              />
              <button
                onClick={() => void sendMessage()}
                disabled={isLoading || !inputTopic.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? '...' : 'Gửi'}
              </button>
            </div>

            {/* Context / additional fields */}
            {selectedAction === 'explain' && (
              <input
                type="text"
                value={inputContext}
                onChange={(e) => setInputContext(e.target.value)}
                placeholder="Tài liệu tham khảo (tùy chọn)..."
                disabled={isLoading}
                className="form-input"
              />
            )}

            {selectedAction === 'practice' && (
              <div className="flex gap-3">
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  disabled={isLoading}
                  className="form-select"
                >
                  <option value="easy">Dễ</option>
                  <option value="medium">Trung bình</option>
                  <option value="hard">Khó</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, Math.min(5, parseInt(e.target.value) || 3)))}
                  disabled={isLoading}
                  className="w-20 form-input"
                />
              </div>
            )}

            {selectedAction === 'suggest' && (
              <input
                type="text"
                value={inputContext}
                onChange={(e) => setInputContext(e.target.value)}
                placeholder="Mục tiêu học tập (ví dụ: 'Chuẩn bị thi THPT QG')..."
                disabled={isLoading}
                className="form-input"
              />
            )}
          </div>

          {/* Status bar */}
          {isLoading && (
            <div className="mt-2 flex items-center gap-2 text-xs text-foreground/55">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>
                {isModelReady ? 'AI đang suy ngẫn...' : 'Đang sử dụng bản sao mẫu...'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
