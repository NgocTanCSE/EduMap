"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, User, Sparkles, Loader2 } from "lucide-react";
import { authService } from '@/src/services/auth.service';

export default function AIChatPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Xin chào! Mình là trợ lý học tập AI của hệ thống EduMap DNTU. Mình có thể giúp bạn lên lộ trình học tập, tìm kiếm tài liệu, hoặc gợi ý mentor phù hợp.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);

  // Load history from Backend on mount
  useEffect(() => {
    const fetchHistory = async () => {
      const token = authService.getToken();
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
          // Map DB structure to UI structure
          const formattedHistory = historyData.flatMap((h: any) => [
            { role: 'user', content: h.message },
            { role: 'assistant', content: h.response }
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
    const token = authService.getToken();

    if (!trimmedInput || isLoading) return;

    if (!token) {
      alert("Vui lòng đăng nhập để sử dụng tính năng Chat AI.");
      return;
    }
    
    // Validate length
    if (trimmedInput.length > 1000) {
      alert("Tin nhắn quá dài, vui lòng nhập dưới 1000 ký tự.");
      return;
    }

    const userMessage = { role: 'user', content: trimmedInput };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // AI Assistant placeholder
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: '...' }
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
          history: messages.slice(-10), // Gửi 10 tin nhắn gần nhất làm ngữ cảnh
          context: {} 
        })
      });

      const data = await res.json();
      
      setMessages(prev => {
        const newArr = [...prev];
        newArr[newArr.length - 1] = { 
          role: 'assistant', 
          content: data.reply || data.message || "Xin lỗi, mình gặp chút trục trặc khi suy nghĩ câu trả lời." 
        };
        return newArr;
      });
    } catch (err) {
      console.error("Chat Error:", err);
      setMessages(prev => {
        const newArr = [...prev];
        newArr[newArr.length - 1] = { 
          role: 'assistant', 
          content: "Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra lại kết nối mạng của bạn." 
        };
        return newArr;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6 p-4 bg-primary/5 rounded-2xl border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">EduMap AI Assistant</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Sẵn sàng hỗ trợ bạn
            </p>
          </div>
        </div>
        {isFetchingHistory && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
      </div>

      <ScrollArea className="flex-1 pr-4 mb-4">
        <div className="space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <Avatar className={m.role === 'user' ? 'bg-yellow-100' : 'bg-primary/10'}>
                {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-primary" />}
              </Avatar>
              <div className={`flex flex-col gap-2 max-w-[80%] ${m.role === 'user' ? 'items-end' : ''}`}>
                <div className={`p-4 rounded-2xl ${
                  m.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-none' 
                    : 'bg-muted rounded-tl-none'
                }`}>
                  {m.content === '...' ? (
                    <div className="flex gap-1 py-1">
                      <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-1">
                  {m.role === 'assistant' ? 'AI Assistant' : 'Bạn'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex gap-2 p-2 bg-zinc-900 rounded-2xl border border-white/10 shadow-lg">
        <Input 
          placeholder={isLoading ? "AI đang suy nghĩ..." : "Nhập tin nhắn..."}
          value={input}
          disabled={isLoading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="border-none bg-transparent focus-visible:ring-0 px-4 text-yellow-500 disabled:opacity-50"
        />
        <Button 
          onClick={handleSend} 
          disabled={isLoading || !input.trim()}
          size="icon" 
          className="rounded-xl shrink-0 h-11 w-11"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </Button>
      </div>
    </div>
  );
}
