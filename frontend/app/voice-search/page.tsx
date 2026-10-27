'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Mic, MicOff, Send, MapPin, Clock, Loader2, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

// ── Types (mirror ai-service/routers/speech.py + map.nLSearch) ───────────

interface SpeechResponse {
  text: string;
  language: string;
  method: string;
  confidence?: number | null;
  degraded: boolean;
  error?: string | null;
}

interface PoiResult {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  description?: string;
  address?: string;
  rating_avg?: number;
  distance_m?: number;
}

interface NlsResponse {
  query: string;
  parsed_query: {
    location?: string | null;
    facility_types?: string[];
    conditions?: string[];
    radius_km?: number;
    confidence?: number;
    method?: string;
    suggestions?: string[];
  };
  explanation: string;
  degraded: boolean;
  results: PoiResult[];
  total: number;
  intent?: { intent: string; confidence: number; detail?: string };
}

type VoiceMode = 'idle' | 'recording' | 'transcribing' | 'searching' | 'error';

// ── Web Speech API typing ─────────────────────────────────────────────────

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((this: SpeechRecognitionInstance, ev: any) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// ── Intent display labels ─────────────────────────────────────────────────

const INTENT_LABELS: Record<string, string> = {
  geo_recommend: 'Tìm địa điểm học tập',
  report_form: 'Gửi báo cáo sự cố',
  geo_query: 'Tra cứu thông tin địa lý',
};

const CATEGORY_LABELS: Record<string, string> = {
  university: 'Đại học', school: 'Trường học', library: 'Thư viện',
  bookstore: 'Nhà sách', lab: 'Lab', wifi: 'Wifi', green: 'Khu xanh',
  cafe: 'Cà phê', restaurant: 'Nhà hàng', market: 'Chợ',
  convenience: 'Cửa hàng', park: 'Công viên', other: 'Khác',
};

// ── Component ─────────────────────────────────────────────────────────────

export default function VoiceSearchPage() {
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [transcript, setTranscript] = useState('');
  const [finalText, setFinalText] = useState('');
  const [result, setResult] = useState<NlsResponse | null>(null);
  const [sttMethod, setSttMethod] = useState<string | null>(null);
  const [sttDegraded, setSttDegraded] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // ── STT: client-side Web Speech API (primary) ──────────────────────────
  const tryWebSpeech = useCallback((): boolean => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      return false;
    }

    const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance;
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          final += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }
      setTranscript(interim || final);
      if (final) {
        setFinalText(final.trim());
        recognitionRef.current = null;
      }
    };

    recognition.onerror = (event: any) => {
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      // If we got a final result, the Web Speech API worked.
      if (finalText) {
        setSttMethod('Web Speech API (client-side)');
        setSttDegraded(false);
        return;
      }
      // Otherwise fall back to Whisper.
      setMode('transcribing');
      void startWhisperFallback();
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      return true;
    } catch {
      return false;
    }
  }, [finalText]);

  // ── STT: server-side Whisper via XKIRO (fallback) ──────────────────
  const startWhisperFallback = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Trình duyệt không hỗ trợ ghi âm — dùng bàn phím nhập tin nhắn.');
      setMode('error');
      setSttMethod(null);
      setSttDegraded(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = base64Encode(new Uint8Array(arrayBuffer));

        setMode('transcribing');
        try {
          const res = await fetchWithRetry('/api/ai/speech/to-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio_base64: base64,
              audio_format: 'wav',
              language: 'vi',
            }),
          });
          const json = await res.json();
          const data = unwrapApiResponse<SpeechResponse>(json);

          setTranscript(data.text || '');
          setFinalText(data.text || '');
          setSttMethod(data.method || 'Whisper (XKIRO)');
          setSttDegraded(data.degraded || false);
          if (data.error && data.degraded) {
            toast(data.error);
          }
        } catch (err) {
          setMode('error');
          setSttDegraded(true);
          toast.error('Lỗi kết nối STT — vui lòng nhập tay.');
        }
      };

      mediaRecorder.start();
      setMode('recording');
      // Record 8 seconds of audio (enough for a voice query).
      setTimeout(() => {
        mediaRecorderRef.current?.stop();
      }, 8000);
    } catch (err: any) {
      toast.error('Không thể truy cập micro — vui lòng cho phép quyền ghi âm.');
      setMode('error');
      setSttDegraded(true);
    }
  }, []);

  // ── Start / stop voice recording ────────────────────────────────────────
  const startRecording = useCallback(() => {
    setTranscript('');
    setFinalText('');
    setResult(null);
    setSttMethod(null);
    setSttDegraded(false);
    setMode('recording');

    const available = tryWebSpeech();
    if (!available) {
      // Web Speech API not available → Whisper fallback immediately.
      void startWhisperFallback();
    }
  }, [tryWebSpeech, startWhisperFallback]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setMode('idle');
  }, []);

  // ── Send transcript to nl-search ────────────────────────────────────────
  const sendQuery = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setMode('searching');
    try {
      const url = `/api/map/nl-search?q=${encodeURIComponent(text.trim())}`;
      const res = await fetchWithRetry(url);
      const json = await res.json();
      const data = unwrapApiResponse<NlsResponse>(json);
      setResult(data);
      if (data.total === 0) {
        toast.info('Không tìm thấy địa điểm phù hợp. Hãy thử tìm kiếm bằng từ khóa khác.');
      }
    } catch (err: any) {
      toast.error('Lỗi tìm kiếm bản đồ — vui lòng thử lại.');
    } finally {
      setMode('idle');
    }
  }, []);

  // ── React to finalText becoming available ──────────────────────────────
  React.useEffect(() => {
    if (finalText) {
      void sendQuery(finalText);
    }
  }, [finalText, sendQuery]);

  // ── Render ─�─────────────────────────────────────────────────────────────

  const isBusy = mode !== 'idle' && mode !== 'error';
  const showRecord = mode === 'recording';
  const showListening = mode === 'recording' || mode === 'transcribing';

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto pt-6 px-4">
        {/* Header */}
        <header className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Mic className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tìm bằng giọng nói</h1>
            <p className="text-sm text-muted-foreground">
              Nói để tìm địa điểm học tập, báo cáo sự cố, hoặc tra cứu thông tin bản đồ.
            </p>
          </div>
        </header>

        {/* Voice recorder panel */}
        <section className="rounded-xl border bg-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full transition-all ${
                  showListening
                    ? 'bg-red-500 animate-pulse'
                    : mode === 'error'
                      ? 'bg-destructive'
                      : 'bg-muted'
                }`}
              />
              <span className="text-sm font-medium text-foreground">
                {mode === 'recording' && 'Đang ghi âm…'}
                {mode === 'transcribing' && 'Đang chuyển đổi giọng nói…'}
                {mode === 'searching' && 'Đang tìm kiếm trên bản đồ…'}
                {(mode === 'idle' || mode === 'error') && 'Nhấn nút để bắt đầu'}
              </span>
            </div>

            {sttMethod && (
              <span className="text-xs text-muted-foreground">
                STT: {sttMethod}
                {sttDegraded && ' (degraded)'}
              </span>
            )}
          </div>

          {/* Transcript display */}
          <div className="mb-4">
            <textarea
              readOnly
              value={showRecord ? transcript : (finalText || transcript)}
              placeholder="Bản ghi âm và kết quả nhận dạng sẽ hiện ở đây…"
              className="w-full min-h-[80px] resize-y-none bg-background border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {!showRecord && !isBusy && (
              <button
                onClick={startRecording}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-3 font-medium hover:bg-primary/90 transition-colors"
              >
                <Mic className="w-5 h-5" />
                Bắt đầu nói
              </button>
            )}

            {showRecord && (
              <button
                onClick={stopRecording}
                className="flex-1 flex items-center justify-center gap-2 bg-destructive text-destructive-foreground rounded-lg py-3 font-medium hover:bg-destructive/90 transition-colors"
              >
                <MicOff className="w-5 h-5" />
                Dừng
              </button>
            )}

            {(finalText || transcript) && mode !== 'recording' && mode !== 'transcribing' && (
              <button
                onClick={() => sendQuery(finalText || transcript)}
                disabled={isBusy}
                className="flex-1 flex items-center justify-center gap-2 border border-border rounded-lg py-3 font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Tìm trên bản đồ
              </button>
            )}
          </div>

          {/* Tips */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Nói rõ và dùng từ khóa như "tìm thư viện", "trường học ở đâu", "wifi hỏng ở trường X".</span>
            </div>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Privacy: giọng nói được xử lý trên trình duyệt (Web Speech API). Whisper fallback chỉ bật khi cần.</span>
            </div>
          </div>
        </section>

        {/* Results */}
        {result && (
          <section className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Kết quả tìm kiếm</h2>
              {result.intent && (
                <span className="text-xs px-3 py-1 rounded-full bg-muted/30 text-muted-foreground">
                  {INTENT_LABELS[result.intent.intent] || result.intent.intent}
                </span>
              )}
            </div>

            {result.explanation && (
              <p className="text-sm text-muted-foreground mb-4">
                {result.explanation}
              </p>
            )}

            {/* Report form (report_form intent) */}
            {result.intent?.intent === 'report_form' && (
              <ReportForm
                defaultCategory={result.parsed_query.facility_types?.[0]}
                onSubmit={(report) => {
                  toast.success('Báo cáo đã được gửi. Cảm ơn bạn!');
                }}
              />
            )}

            {/* POI results */}
            {result.total > 0 && result.results.map((poi) => (
              <div
                key={poi.id}
                className="border border-border rounded-lg p-4 mb-3 last:mb-0"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <h3 className="font-medium text-foreground">{poi.name}</h3>
                      {poi.category && (
                        <span className="text-xs px-2 py-0.5 rounded bg-muted/30 text-muted-foreground">
                          {CATEGORY_LABELS[poi.category] || poi.category}
                        </span>
                      )}
                    </div>
                    {poi.address && (
                      <p className="text-sm text-muted-foreground mt-1">{poi.address}</p>
                    )}
                    {poi.description && (
                      <p className="text-sm text-muted-foreground/70 mt-1 line-clamp-2">
                        {poi.description}
                      </p>
                    )}
                    {poi.distance_m !== undefined && (
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Cách {poi.distance_m} m
                      </p>
                    )}
                  </div>
                  {poi.rating_avg && (
                    <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                      ★ {poi.rating_avg.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {result.total === 0 && result.intent?.intent !== 'report_form' && (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Không tìm thấy địa điểm nào khớp với tìm kiếm của bạn.</p>
                <p className="text-xs mt-1">Thử mở rộng từ khóa hoặc gõ thủ công.</p>
              </div>
            )}

            {result.total > 0 && (
              <button
                onClick={() => {
                  window.location.href = `/map?voice=${encodeURIComponent(finalText || transcript)}`;
                }}
                className="w-full mt-4 text-sm text-primary hover:underline flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Xem trên bản đồ đầy đủ
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

// ── Report form (report_form intent) ──────────────────────────────────────

interface ReportFormProps {
  defaultCategory?: string;
  onSubmit: (report: { category: string; description: string; location: string }) => void;
}

function ReportForm({ defaultCategory, onSubmit }: ReportFormProps) {
  const [category, setCategory] = useState(defaultCategory || '');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Vui lòng nhập mô tả sự cố.');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      onSubmit({ category, description, location });
      setSubmitting(false);
    }, 500);
  };

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-lg p-4 mb-4">
      <h3 className="font-medium text-foreground mb-3">Gửi báo cáo sự cố</h3>
      <div className="grid gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Loại địa điểm</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          >
            <option value="">Chọn loại…</option>
            <option value="school">Trường học</option>
            <option value="cafe">Cà phê</option>
            <option value="library">Thư viện</option>
            <option value="wifi">Wifi công cộng</option>
            <option value="other">Khác</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Mô tả sự cố</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="VD: Wifi đã ngắt kết nối từ hôm qua, mật on wifi không hoạt động…"
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground/50 resize-y-none min-h-[80px]"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Địa điểm / Tên trường</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="VD: Trường Đại học DNTU, quận X, TP. Hồ Chí Minh…"
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground/50"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !description.trim()}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2 font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Gửi báo cáo
        </button>
      </div>
    </form>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
