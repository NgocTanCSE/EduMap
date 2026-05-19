"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, User, Sparkles } from "lucide-react";

export default function AIChatPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Xin chào! Mình là trợ lý học tập AI của hệ thống EduMap. Mình có thể giúp bạn lên lộ trình học tập, tìm kiếm tài liệu, hoặc gợi ý mentor phù hợp.'
    }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    
    const newMessages = [
      ...messages,
      { role: 'user', content: input }
    ];
    setMessages(newMessages);
    setInput('');

    // Giả lập phản hồi AI
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Cảm ơn câu hỏi của bạn. Mình đang phân tích yêu cầu để đưa ra câu trả lời chính xác nhất...' }
      ]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-6 p-4 bg-primary/5 rounded-2xl border border-primary/10">
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

      <ScrollArea className="flex-1 pr-4 mb-4">
        <div className="space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <Avatar className={m.role === 'user' ? 'bg-blue-100' : 'bg-primary/10'}>
                {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-primary" />}
              </Avatar>
              <div className={`flex flex-col gap-2 max-w-[80%] ${m.role === 'user' ? 'items-end' : ''}`}>
                <div className={`p-4 rounded-2xl ${
                  m.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-muted rounded-tl-none'
                }`}>
                  <p className="text-sm leading-relaxed">{m.content}</p>
                </div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-1">
                  {m.role === 'assistant' ? 'AI Assistant' : 'Bạn'} • 10:00 AM
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex gap-2 p-2 bg-muted/50 rounded-2xl border border-border shadow-lg">
        <Input 
          placeholder="Nhập tin nhắn..." 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="border-none bg-transparent focus-visible:ring-0 px-4"
        />
        <Button onClick={handleSend} size="icon" className="rounded-xl shrink-0 h-11 w-11">
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
