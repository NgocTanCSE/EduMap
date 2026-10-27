"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, User, Loader2, BookOpen, Mic, MicOff } from "lucide-react";
import { toast } from 'sonner';
import { authService } from '@/src/services/auth.service';

export default function AIChatPage() {
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'assistant',
      content: 'Xin chào! Mình là trợ lý học tập AI của hệ thống EduMap DNTU. Mình có thể giúp bạn lên lộ trình học tập, tìm kiếm tài liệu, hoặc gợi ý mentor phù hợp.',
      sources: []
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  // Voice-to-Geo (Idea #16): voice input button on chat page
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  // Session ID for chat session memory (bộ nhớ phiên chat).
  // Generated once on mount and reused across messages within this tab.
  // On HF Spaces this ties to the in-memory SessionMemoryService.
  const [sessionId] = useState(() => {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `web_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  });

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

  // Voice-to-Geo (Idea #16): record voice → STT → fill chat input
  const toggleVoiceRecording = useCallback(() => {
    if (isVoiceRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
      setIsVoiceRecording(false);
      return;
    }

    // Privacy-first: prefer client-side Web Speech API.
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Fallback: navigate to the dedicated voice-search page which
      // handles server-side Whisper STT.
      window.location.href = '/voice-search';
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
        setInput((prev) => prev + ' ' + final.trim());
      }
    };

    recognition.onerror = () => {
      setIsVoiceRecording(false);
      recognitionRef.current = null;
      toast.error('Không thể nhận dạng giọng nói — vui lòng nhập tay hoặc dùng trang Tìm bằng giọng nói.');
    };

    recognition.onend = () => {
      setIsVoiceRecording(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsVoiceRecording(true);
      toast.success('Đang nghe…');
    } catch {
      toast.error('Trình duyệt không hỗ trợ nhận dạng giọng nói.');
    }
  }, [isVoiceRecording]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
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

    // Add assistant placeholder message (streaming)
    const assistantIndex = newMessages.length;
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
        throw new Error(errorData?.detail || 'AI service returned an error');
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('No response body from streaming endpoint');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events (terminated by double-newline)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || ''; // Keep incomplete part in buffer

        for (const part of parts) {
          const trimmedPart = part.trim();
          if (!trimmedPart.startsWith('data: ')) continue;

          const dataStr = trimmedPart.slice(6).trim();
          if (dataStr === '[DONE]') {
            break;
          }

          try {
            const data = JSON.parse(dataStr);

            // Metadata chunk (sources first)
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

            // Token chunk
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

            // Done chunk
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

      // Final flush: ensure streaming flag is removed
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
          content: accumulatedContent || "Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra kết nối mạng.",
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

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full p-4 bg-background">
      <div className="flex items-center justify-between mb-6 p-6 bg-card/50 rounded-lg border border-border">
        <div className="flex items-center gap-4">
          <div className="bg-primary/80 p-2.5 rounded-lg shadow-lg">
            <Bot className="w-6 h-6 text-foreground" />
          </div>
          <div>
          <h1 className="h1-page">DNTU Assistant</h1>
          </div>
        </div>
        {isFetchingHistory && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
      </div>

      <ScrollArea className="flex-1 pr-4 mb-4">
        <div className="space-y-8">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <Avatar className={`h-10 w-10 border border-border ${m.role === 'user' ? 'bg-primary/80' : 'bg-card'}`}>
                {m.role === 'user' ? <User className="w-5 h-5 text-foreground" /> : <Bot className="w-5 h-5 text-primary" />}
              </Avatar>
              <div className={`flex flex-col gap-2 max-w-[85%] ${m.role === 'user' ? 'items-end' : ''}`}>
                <div className={`p-5 rounded-lg text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-card text-foreground rounded-tr-none' 
                    : m.isError
                      ? 'bg-destructive/15 border border-destructive/30 text-destructive rounded-tl-none'
                      : 'bg-card border border-border text-muted-foreground/70 rounded-tl-none'
                }`}>
                  {m.content === '' && m.isStreaming ? (
                    <div className="flex gap-1.5 py-2">
                      <span className="w-1.5 h-1.5 bg-primary/100 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-primary/100 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-primary/100 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  ) : (
                    <>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      {m.isStreaming && (
                        <span className="inline-block w-1.5 h-1.5 bg-primary/100 rounded-full animate-bounce ml-0.5 [animation-delay:0.6s]"></span>
                      )}
                    </>
                  )}
                </div>
                
                {/* Sources Display */}
                {m.role === 'assistant' && m.sources && m.sources.length > 0 && !m.isStreaming && (
                   <div className="mt-2 flex flex-col gap-2">
                      <p className="text-[9px] uppercase font-semibold text-soft tracking-widest flex items-center gap-1 ml-2">
                         <BookOpen size={10} /> Tài liệu tham khảo
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {m.sources.map((s: any, idx: number) => (
                          <div key={idx} className="bg-primary/10 border border-primary/10 px-3 py-1.5 rounded-full flex items-center gap-2 group cursor-pointer hover:bg-primary/10 transition-all">
                             <div className="w-1.5 h-1.5 rounded-full bg-primary/80" />
                             <span className="text-[10px] font-bold text-primary/70">{s.title || "Nguồn tin cậy"}</span>
                          </div>
                        ))}
                      </div>
                   </div>
                )}

                <span className="text-[9px] text-soft uppercase font-semibold tracking-[0.2em] px-2">
                  {m.role === 'assistant' ? 'EduMap AI' : 'Sinh viên'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex gap-2 p-2 bg-card/80 rounded-lg border border-border mb-4">
        <Input 
          placeholder={isLoading ? "AI đang xử lý tri thức..." : "Hỏi mình về học bổng, mentor hoặc bản đồ..."}
          value={input}
          disabled={isLoading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 form-input"
        />
        {/* Voice input button (Idea #16) */}
        <Button
          onClick={toggleVoiceRecording}
          disabled={isLoading}
          variant="ghost"
          size="sm"
          className={`shrink-0 ${
            isVoiceRecording
              ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              : 'text-muted-foreground/60 hover:bg-muted/50'
          }`}
          title="Nhập bằng giọng nói (Web Speech API / Whisper fallback)"
        >
          {isVoiceRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
        <Button
          onClick={handleSend} 
          disabled={isLoading || !input.trim()}
          size="sm"
          loading={isLoading}
          icon={<Send className="w-5 h-5" />}
          className="shrink-0 bg-primary/80 hover:bg-primary/80 text-primary-foreground shadow-lg"
        >
          GỬI
        </Button>
      </div>
    </div>
  );
}
