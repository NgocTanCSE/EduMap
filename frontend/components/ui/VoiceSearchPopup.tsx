"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X, Search, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceSearchPopupProps {
  open: boolean;
  onClose: () => void;
  onResult: (text: string, intent: string | null) => void;
}

/**
 * Popup tìm bằng giọng nói — thay vì redirect ra trang riêng,
 * hiển thị modal trong trang hiện tại (theo yêu cầu UX: không cần
 * rời khỏi trang hiện tại). Dùng Web Speech API (client-side STT).
 */
export function VoiceSearchPopup({
  open, onClose, onResult,
}: VoiceSearchPopupProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [intent, setIntent] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!open) {
      setIsRecording(false);
      setTranscript('');
      setIntent(null);
      return;
    }
    // Auto-start recording when popup opens
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Trình duyệt không hỗ trợ nhận dạng giọng nói.');
      onClose();
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
        if (res.isFinal) final += res[0].transcript;
      }
      if (final) {
        setTranscript(final.trim());
        const t = final.trim();
        setIntent(classifyIntent(t));
        void onResult(t, classifyIntent(t));
      }
    };
    recognition.onerror = () => { setIsRecording(false); };
    recognition.onend = () => { setIsRecording(false); };
    try {
      recognition.start();
      setIsRecording(true);
      recognitionRef.current = recognition;
    } catch {
      onClose();
    }
    return () => {
      try { recognitionRef.current?.abort(); } catch {}
      recognitionRef.current = null;
    };
  }, [open, onClose, onResult]);

  const classifyIntent = (text: string): string | null => {
    const lower = text.toLowerCase();
    const reportKw = ['báo', 'hỏng', 'sự cố', 'phóng', 'ngập'];
    const findKw = ['tìm', 'tìm kiếm', 'cho tôi', 'near', 'gần'];
    const queryKw = ['ở đâu', 'là gì', 'bao nhiêu', 'khi nào'];
    if (reportKw.some(k => lower.includes(k))) return 'report_form';
    if (findKw.some(k => lower.includes(k))) return 'geo_recommend';
    if (queryKw.some(k => lower.includes(k))) return 'geo_query';
    return 'geo_recommend';
  };

  const stop = () => {
    try { recognitionRef.current?.abort(); } catch {}
    setIsRecording(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 mx-4 animate-in slide-in-from-top fade-in duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Tìm bằng giọng nói</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Nói câu tìm kiếm, ví dụ: "Tìm thư viện gần đây", "Trường DNTU ở đâu?", "Báo wifi hỏng ở trường X".
        </p>

        <div className="flex flex-col items-center gap-3">
          <div className={`relative w-full h-20 flex items-center justify-center rounded-xl border-2 border-dashed ${
            isRecording ? 'border-destructive bg-destructive/5' : 'border-border text-muted-foreground'
          }`}>
            <button
              onClick={isRecording ? stop : () => {}}
              className={`absolute w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                isRecording ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
              aria-label={isRecording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
            >
              {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <span className={`text-sm font-medium transition-colors ${isRecording ? 'text-destructive' : 'text-muted-foreground/60'}`}>
              {isRecording ? 'Đang nghe...' : 'Nhấn mic để nói'}
            </span>
          </div>

          {transcript && (
            <div className="w-full p-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground">
              <span className="text-xs text-muted-foreground/60 block mb-1">Bạn nói:</span>
              "{transcript}"
              {intent && (
                <span className="text-[10px] text-primary font-medium mt-1 block inline-flex items-center gap-1">
                  <Search className="w-3 h-3" /> {intent === 'report_form' ? 'Phát hiện: báo cáo sự cố' : intent === 'geo_query' ? 'Phát hiện: hỏi thông tin' : 'Phát hiện: tìm địa điểm'}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium">
            Hủy
          </button>
          {transcript && (
            <button
              onClick={() => { onClose(); }}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Áp dụng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
