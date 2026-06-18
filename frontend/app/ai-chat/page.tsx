"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, User, Sparkles, Loader2, Info, BookOpen } from "lucide-react";
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
            { role: 'assistant', content: h.response, sources: h.metadata?.sources || [] }
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

  const handleSend = async () => {
    const trimmedInput = input.trim();
    const token = authService.getAccessToken();

    if (!trimmedInput || isLoading) return;

    if (!token) {
      alert("Vui lòng đăng nhập để sử dụng tính năng Chat AI.");
      return;
    }
    
    const userMessage = { role: 'user', content: trimmedInput };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: '...', sources: [] }
    ]);
    
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: trimmedInput, 
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          context: {} 
        })
      });

      const data = await res.json();
      
      setMessages(prev => {
        const newArr = [...prev];
        newArr[newArr.length - 1] = { 
          role: 'assistant', 
          content: data.reply || data.message || "Xin lỗi, mình gặp chút trục trặc khi suy nghĩ câu trả lời.",
          sources: data.sources || [],
          isError: data.error || !res.ok
        };
        return newArr;
      });
    } catch (err) {
      console.error("Chat Error:", err);
      setMessages(prev => {
        const newArr = [...prev];
        newArr[newArr.length - 1] = { 
          role: 'assistant', 
          content: "Không thể kết nối đến máy chủ AI (Timeout). Vui lòng kiểm tra lại kết nối mạng của bạn.",
          sources: [],
          isError: true
        };
        return newArr;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto p-4 bg-[#050505]">
      <div className="flex items-center justify-between mb-6 p-6 bg-zinc-900/50 rounded-[2rem] border border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="bg-yellow-500 p-2.5 rounded-2xl shadow-lg shadow-yellow-500/10">
            <Bot className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">DNTU Assistant</h1>
            <p className="text-[10px] uppercase font-black text-white/40 tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Gemini Pro + PostGIS RAG
            </p>
          </div>
        </div>
        {isFetchingHistory && <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />}
      </div>

      <ScrollArea className="flex-1 pr-4 mb-4">
        <div className="space-y-8">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <Avatar className={`h-10 w-10 border border-white/10 ${m.role === 'user' ? 'bg-yellow-500' : 'bg-zinc-800'}`}>
                {m.role === 'user' ? <User className="w-5 h-5 text-black" /> : <Bot className="w-5 h-5 text-yellow-500" />}
              </Avatar>
              <div className={`flex flex-col gap-2 max-w-[85%] ${m.role === 'user' ? 'items-end' : ''}`}>
                <div className={`p-5 rounded-[1.8rem] text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-zinc-800 text-white rounded-tr-none' 
                    : m.isError
                      ? 'bg-red-950 border border-red-900 text-red-200 rounded-tl-none'
                      : 'bg-zinc-900 border border-white/5 text-gray-200 rounded-tl-none'
                }`}>
                  {m.content === '...' ? (
                    <div className="flex gap-1.5 py-2">
                      <span className="w-1.5 h-1.5 bg-yellow-500/50 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-yellow-500/50 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-yellow-500/50 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
                
                {/* Sources Display */}
                {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                   <div className="mt-2 flex flex-col gap-2">
                      <p className="text-[9px] uppercase font-black text-white/20 tracking-widest flex items-center gap-1 ml-2">
                         <BookOpen size={10} /> Tài liệu tham khảo
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {m.sources.map((s: any, idx: number) => (
                          <div key={idx} className="bg-yellow-500/5 border border-yellow-500/10 px-3 py-1.5 rounded-full flex items-center gap-2 group cursor-pointer hover:bg-yellow-500/10 transition-all">
                             <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                             <span className="text-[10px] font-bold text-yellow-500/70">{s.title || "Nguồn tin cậy"}</span>
                          </div>
                        ))}
                      </div>
                   </div>
                )}

                <span className="text-[9px] text-white/20 uppercase font-black tracking-[0.2em] px-2">
                  {m.role === 'assistant' ? 'EduMap AI' : 'Sinh viên'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex gap-2 p-2 bg-zinc-900/80 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl mb-4">
        <Input 
          placeholder={isLoading ? "AI đang xử lý tri thức..." : "Hỏi mình về học bổng, mentor hoặc bản đồ..."}
          value={input}
          disabled={isLoading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="border-none bg-transparent focus-visible:ring-0 px-6 text-yellow-500 text-sm placeholder:text-white/10"
        />
        <Button 
          onClick={handleSend} 
          disabled={isLoading || !input.trim()}
          className="rounded-2xl shrink-0 h-12 w-12 bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/20"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </Button>
      </div>
    </div>
  );
}
