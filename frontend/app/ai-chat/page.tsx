"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, User, Loader2, BookOpen, Mic, MicOff, Trash2, Sparkles, Compass, Lightbulb, GraduationCap, Atom } from "lucide-react";
import { toast } from 'sonner';
import { authService } from '@/src/services/auth.service';
import { VoiceSearchPopup } from "@/components/ui/VoiceSearchPopup";

const SUGGESTIONS = [
  { icon: GraduationCap, text: "Tìm học bổng toàn phần du học tại Đức hoặc Nhật Bản?" },
  { icon: Atom, text: "Phòng thí nghiệm STEM nào đang mở cửa tại Biên Hòa?" },
  { icon: Compass, text: "Lộ trình học Kỹ sư AI & Data Science cho sinh viên năm nhất?" },
  { icon: Lightbulb, text: "Cách tìm mentor phù hợp và kết nối với doanh nghiệp thực tập?" }
];

export default function AIChatPage() {
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'assistant',
      content: 'Xin chào! Mình là trợ lý AI EduMap. Mình có thể giúp bạn tìm kiếm học bổng, gợi ý mentor, tra cứu phòng thí nghiệm STEM, cơ hội thực tập và định hướng học tập.',
      sources: []
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [showVoicePopup, setShowVoicePopup] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessionId] = useState(() => {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `web_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  });

  const handleClearChat = useCallback(() => {
    setMessages([
      {
        role: 'assistant',
        content: 'Phiên trò chuyện đã được làm mới. Hãy đặt bất kỳ câu hỏi nào về học tập, bản đồ hoặc học bổng!',
        sources: []
      }
    ]);
    toast.success('Đã làm mới phiên trò chuyện');
  }, []);

  // Load history from Backend on mount
  useEffect(() => {
    const fetchHistory = async () => {
      const token = authService.getAccessToken();
      if (!token) {
        setIsFetchingHistory(false);
        return;
      }

      try {
        const res = await fetch('/api/ai/history', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const historyData = await res.json();
          const formattedHistory = historyData.flatMap((h: any) => [
            { role: 'user', content: h.message },
            { role: 'assistant', content: h.response, sources: h.context?.sources || [] }
          ]);
          if (formattedHistory.length > 0) {
            setMessages(prev => [...prev, ...formattedHistory]);
          }
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setIsFetchingHistory(false);
      }
    };

    fetchHistory();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Voice recording toggle
  const toggleVoiceRecording = useCallback(() => {
    if (isVoiceRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
      setIsVoiceRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setShowVoicePopup(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          final += res[0].transcript;
        }
      }
      if (final.trim()) {
        setInput((prev) => (prev ? prev + ' ' + final.trim() : final.trim()));
      }
    };

    recognition.onerror = () => {
      setIsVoiceRecording(false);
      recognitionRef.current = null;
      toast.error('Không thể nhận dạng giọng nói — vui lòng nhập tay.');
    };

    recognition.onend = () => {
      setIsVoiceRecording(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsVoiceRecording(true);
      toast.success('Đang lắng nghe… Hãy nói yêu cầu của bạn.');
    } catch {
      toast.error('Trình duyệt không hỗ trợ nhận dạng giọng nói.');
    }
  }, [isVoiceRecording]);

  const sendMessageWithText = async (textToSend: string) => {
    const trimmedInput = textToSend.trim();
    const token = authService.getAccessToken();

    if (!trimmedInput || isLoading) return;

    if (!token) {
      toast.error('Vui lòng đăng nhập để sử dụng tính năng Chat AI.');
      window.location.href = '/auth/login?redirect=/ai-chat';
      return;
    }

    const userMessage = { role: 'user', content: trimmedInput };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let accumulatedContent = '';
    let sources: any[] = [];

    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: '', sources: [], isStreaming: true }
    ]);

    try {
      const res = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: trimmedInput, 
          history: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          context: {},
          session_id: sessionId
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.detail || 'Dịch vụ AI đang bận, vui lòng thử lại sau ít giây');
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('Không thể khởi tạo luồng dữ liệu trả về');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const trimmedPart = part.trim();
          if (!trimmedPart.startsWith('data: ')) continue;

          const dataStr = trimmedPart.slice(6).trim();
          if (dataStr === '[DONE]') {
            break;
          }

          try {
            const data = JSON.parse(dataStr);

            if (data.meta === true && data.sources) {
              sources = data.sources;
              setMessages(prev => {
                const newArr = [...prev];
                if (newArr[newArr.length - 1]?.role === 'assistant') {
                  newArr[newArr.length - 1] = {
                    role: 'assistant',
                    content: accumulatedContent,
                    sources: sources,
                    isStreaming: true,
                  };
                }
                return newArr;
              });
            }

            if (data.token !== undefined) {
              accumulatedContent += data.token;
              const isFinal = data.is_final || data.done;

              setMessages(prev => {
                const newArr = [...prev];
                if (newArr[newArr.length - 1]?.role === 'assistant') {
                  newArr[newArr.length - 1] = {
                    role: 'assistant',
                    content: accumulatedContent,
                    sources: sources,
                    isStreaming: !isFinal,
                  };
                }
                return newArr;
              });
            }

            if (data.done) {
              setMessages(prev => {
                const newArr = [...prev];
                if (newArr[newArr.length - 1]?.role === 'assistant') {
                  newArr[newArr.length - 1] = {
                    role: 'assistant',
                    content: accumulatedContent,
                    sources: sources,
                    isStreaming: false,
                  };
                }
                return newArr;
              });
            }
          } catch (e) {
            console.warn('Failed to parse SSE chunk:', e);
          }
        }
      }

      setMessages(prev => {
        const newArr = [...prev];
        if (newArr[newArr.length - 1]?.role === 'assistant' && newArr[newArr.length - 1]?.isStreaming) {
          newArr[newArr.length - 1] = {
            role: 'assistant',
            content: accumulatedContent,
            sources: sources,
            isStreaming: false,
          };
        }
        return newArr;
      });
    } catch (err: any) {
      console.error("Chat Error:", err);
      setMessages(prev => {
        const newArr = [...prev];
        newArr[newArr.length - 1] = { 
          role: 'assistant', 
          content: accumulatedContent || "Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra kết nối mạng hoặc thử lại.",
          sources: [],
          isError: true,
          isStreaming: false,
        };
        return newArr;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    sendMessageWithText(input);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] w-full p-3 sm:p-5 bg-background">
      {/* Header Card */}
      <div className="flex items-center justify-between mb-3 px-4 py-3 sm:px-5 sm:py-3.5 bg-card border border-border/80 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="bg-primary/10 border border-primary/25 p-2 rounded-xl">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-card" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-foreground">Trợ Lý AI EduMap</h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/15 text-accent">
                Trực tuyến
              </span>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Tra cứu học bổng, phòng lab STEM, cơ hội thực tập & giải đáp học thuật
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFetchingHistory && <Loader2 className="w-4 h-4 animate-spin text-primary mr-1" />}
          <Button
            onClick={handleClearChat}
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-xl text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Làm mới cuộc trò chuyện"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Làm mới
          </Button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <ScrollArea className="flex-1 pr-3">
        <div className="space-y-5 pb-4 max-w-4xl mx-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 sm:gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in duration-200`}>
              <div className={`h-9 w-9 rounded-full border shrink-0 flex items-center justify-center ${m.role === 'user' ? 'border-primary/40 bg-primary/20 text-primary' : 'border-border bg-card text-primary shadow-xs'}`}>
                {m.role === 'user' ? <User className="w-4 h-4 text-primary" /> : <Bot className="w-4 h-4 text-primary" />}
              </div>

              <div className={`flex flex-col gap-1.5 max-w-[85%] sm:max-w-[78%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-xs font-medium' 
                    : m.isError
                      ? 'bg-destructive/10 border border-destructive/30 text-destructive rounded-tl-xs'
                      : 'bg-card border border-border/80 text-foreground rounded-tl-xs'
                }`}>
                  {m.content === '' && m.isStreaming ? (
                    <div className="flex items-center gap-1.5 py-1 px-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                    </div>
                  ) : (
                    <>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      {m.isStreaming && (
                        <span className="inline-block w-1.5 h-3.5 bg-primary rounded-xs animate-pulse ml-1 align-middle"></span>
                      )}
                    </>
                  )}
                </div>
                
                {/* Sources Display */}
                {m.role === 'assistant' && m.sources && m.sources.length > 0 && !m.isStreaming && (
                  <div className="mt-1 flex flex-col gap-1.5 w-full">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                      <BookOpen size={11} className="text-primary" /> Nguồn trích dẫn học thuật
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.sources.map((s: any, idx: number) => (
                        <div key={idx} className="bg-muted/70 border border-border/70 px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[11px] text-foreground/80 hover:border-primary/40 transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span className="truncate max-w-[200px] font-medium">{s.title || "Tài liệu EduMap"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <span className="text-[10px] text-muted-foreground px-1">
                  {m.role === 'assistant' ? 'EduMap AI' : 'Bạn'}
                </span>
              </div>
            </div>
          ))}

          {/* Quick Suggestions (Shown when initial or few messages) */}
          {messages.length <= 1 && (
            <div className="mt-6 pt-4 border-t border-border/60">
              <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Gợi ý câu hỏi phổ biến:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SUGGESTIONS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => sendMessageWithText(item.text)}
                      className="text-left p-3 rounded-xl bg-card border border-border/80 hover:border-primary/60 hover:bg-primary/5 transition-all flex items-start gap-2.5 group"
                    >
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs text-foreground/90 font-medium group-hover:text-primary transition-colors">
                        {item.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Bar */}
      <div className="max-w-4xl w-full mx-auto mt-2">
        <div className="flex items-center gap-2 p-2 bg-card border border-border/80 rounded-2xl shadow-sm focus-within:border-primary transition-all">
          <Input 
            placeholder={isLoading ? "AI đang suy nghĩ và tổng hợp kiến thức..." : "Nhập câu hỏi của bạn về trường học, học bổng hoặc hướng nghiệp..."}
            value={input}
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1 bg-transparent border-0 shadow-none focus-visible:ring-0 text-xs sm:text-sm h-10 px-3 placeholder:text-muted-foreground"
          />

          <Button
            onClick={toggleVoiceRecording}
            disabled={isLoading}
            type="button"
            variant="ghost"
            size="sm"
            className={`shrink-0 h-9 w-9 p-0 rounded-xl transition-all ${
              isVoiceRecording
                ? 'bg-destructive text-destructive-foreground animate-pulse'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
            title="Nhập bằng giọng nói"
          >
            {isVoiceRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>

          <Button
            onClick={handleSend} 
            disabled={isLoading || !input.trim()}
            size="sm"
            className="shrink-0 h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Gửi</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          EduMap AI có thể mắc sai sót nhỏ. Vui lòng xác thực lại thông tin tuyển sinh với cơ sở đào tạo.
        </p>
      </div>

      <VoiceSearchPopup
        open={showVoicePopup}
        onClose={() => setShowVoicePopup(false)}
        onResult={(text) => {
          setInput((prev) => (prev ? prev + ' ' + text : text));
        }}
      />
    </div>
  );
}
