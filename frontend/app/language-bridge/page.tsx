"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChevronLeft, BookOpen, Globe, Volume2, Play, Pause, Square,
  Send, Sparkles, AlertCircle, RefreshCw, Download, ExternalLink,
  Languages, FileText, Info, Check, X, Copy, RotateCcw, VolumeX
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { useRequireAuth } from '@/src/lib/require-auth';
import {
  languageBridgeService,
  Difficulty,
  SimplifyResult,
  TranslateResult,
  TTSResult,
} from '@/src/services/language-bridge.service';

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'elementary', label: 'Tiểu học (lớp 1-3)', desc: 'Từ ngữ đơn giản, giải thích mọi khái niệm' },
  { value: 'middle', label: 'THCS (lớp 6-9)', desc: 'Ngôn ngữ vừa sức, giải thích từ chuyên môn' },
  { value: 'high', label: 'THPT (lớp 10-12)', desc: 'Đầy đủ ý nghĩa, văn phong dễ tiếp thu' },
  { value: 'college', label: 'Đại học', desc: 'Học thuật chuẩn mực, rõ ràng, mạch lạc' },
];

const LANGUAGE_OPTIONS = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
];

const SAMPLE_TEXT = `Theo báo cáo của Sở Giáo dục và Đào tạo, hệ thống các cơ sở giáo dục trên địa bàn tỉnh Đồng Nai đang đẩy mạnh chuyển đổi số trong dạy và học. Việc kết nối bản đồ các trường học, phòng thực hành STEM và thư viện mở giúp học sinh, sinh viên dễ dàng tiếp cận nguồn tài liệu khoa học chất lượng cao và định hướng nghề nghiệp phù hợp.`;

type BridgeMode = 'simplify' | 'translate' | 'tts';

export default function LanguageBridgePage() {
  const { user } = useRequireAuth('/auth/login');

  // Active mode
  const [mode, setMode] = useState<BridgeMode>('simplify');

  // Input state
  const [text, setText] = useState(SAMPLE_TEXT);
  const [difficulty, setDifficulty] = useState<Difficulty>('middle');

  // Simplify state
  const [simplifyResult, setSimplifyResult] = useState<SimplifyResult | null>(null);
  const [simplifyLoading, setSimplifyLoading] = useState(false);

  // Translate state
  const [targetLang, setTargetLang] = useState('en');
  const [sourceLang, setSourceLang] = useState('');
  const [glossaryText, setGlossaryText] = useState('');
  const [showGlossary, setShowGlossary] = useState(false);
  const [translateResult, setTranslateResult] = useState<TranslateResult | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);

  // TTS state
  const [ttsLang, setTtsLang] = useState('vi');
  const [ttsVoice, setTtsVoice] = useState('');
  const [ttsResult, setTtsResult] = useState<TTSResult | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [useBrowserTTS, setUseBrowserTTS] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBrowserVoice, setSelectedBrowserVoice] = useState<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load browser voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        setBrowserVoices(voices);
        const viVoice = voices.find(v => v.lang.startsWith('vi'));
        if (viVoice) setSelectedBrowserVoice(viVoice);
      };
      loadVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // Cleanup audio
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  // Handlers
  const handleSimplify = useCallback(async () => {
    if (!text.trim()) {
      toast.error('Vui lòng nhập văn bản cần đơn giản hóa.');
      return;
    }
    setSimplifyLoading(true);
    try {
      const result = await languageBridgeService.simplify(text, difficulty);
      setSimplifyResult(result);
      if (result.degraded) {
        toast.warning(result.reason || 'Đang dùng bản đơn giản hóa dự phòng.');
      } else {
        toast.success('Đã đơn giản hóa nội dung thành công!');
      }
    } catch (err: any) {
      logger.error('Simplify error', err);
      toast.error(err?.message || 'Không thể đơn giản hóa văn bản.');
    } finally {
      setSimplifyLoading(false);
    }
  }, [text, difficulty]);

  const handleTranslate = useCallback(async () => {
    if (!text.trim()) {
      toast.error('Vui lòng nhập văn bản cần dịch.');
      return;
    }
    setTranslateLoading(true);
    try {
      const glossary = glossaryText.trim()
        ? glossaryText
            .split('\n')
            .map(line => {
              const [k, v] = line.split(':').map(s => s.trim());
              return k && v ? [k, v] : null;
            })
            .filter(Boolean) as [string, string][]
        : undefined;

      const result = await languageBridgeService.translate(
        text, targetLang, sourceLang || undefined,
        glossary ? Object.fromEntries(glossary) : undefined,
      );
      setTranslateResult(result);
      if (result.degraded) {
        toast.warning(result.reason || 'Đang dùng bản dịch dự phòng.');
      } else {
        toast.success('Đã dịch văn bản thành công!');
      }
    } catch (err: any) {
      logger.error('Translate error', err);
      toast.error(err?.message || 'Không thể dịch văn bản.');
    } finally {
      setTranslateLoading(false);
    }
  }, [text, targetLang, sourceLang, glossaryText]);

  const handleTTS = useCallback(async () => {
    const sourceText = mode === 'simplify' && simplifyResult?.simplified
      ? simplifyResult.simplified
      : mode === 'translate' && translateResult?.translated
      ? translateResult.translated
      : text;

    if (!sourceText.trim()) {
      toast.error('Không có văn bản để phát âm thanh.');
      return;
    }
    setTtsLoading(true);
    setTtsResult(null);
    try {
      const result = await languageBridgeService.tts(sourceText, ttsLang, ttsVoice || undefined);
      setTtsResult(result);
      if (result.degraded && result.audio_base64 === null) {
        toast.warning('Dùng Web Speech API trình duyệt để phát âm thanh.');
        setUseBrowserTTS(true);
      } else {
        toast.success('Đã tạo tệp giọng đọc thành công!');
      }
    } catch {
      toast.error('Chuyển sang bộ phát âm thanh trình duyệt.');
      setUseBrowserTTS(true);
    } finally {
      setTtsLoading(false);
    }
  }, [mode, simplifyResult, translateResult, text, ttsLang, ttsVoice]);

  const playAudio = useCallback(() => {
    if (ttsResult?.audio_base64) {
      const url = languageBridgeService.base64ToBlobUrl(ttsResult.audio_base64, ttsResult.audio_format);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  }, [ttsResult]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setIsPlaying(false);
  }, []);

  const playBrowserTTS = useCallback(() => {
    if (!('speechSynthesis' in window)) {
      toast.error('Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }
    speechSynthesis.cancel();

    const sourceText = mode === 'simplify' && simplifyResult?.simplified
      ? simplifyResult.simplified
      : mode === 'translate' && translateResult?.translated
      ? translateResult.translated
      : text;

    const utter = new SpeechSynthesisUtterance(sourceText);
    if (selectedBrowserVoice) utter.voice = selectedBrowserVoice;
    utter.lang = ttsLang;
    utter.onend = () => setIsPlaying(false);
    utter.onerror = () => setIsPlaying(false);
    utteranceRef.current = utter;
    setIsPlaying(true);
    speechSynthesis.speak(utter);
  }, [mode, simplifyResult, translateResult, text, ttsLang, selectedBrowserVoice]);

  const stopBrowserTTS = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    setIsPlaying(false);
  }, []);

  const handleCopy = (content?: string) => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    toast.success('Đã sao chép vào bộ nhớ tạm');
  };

  const handleDownload = useCallback(() => {
    if (!ttsResult?.audio_base64) {
      toast.error('Không có file âm thanh để tải xuống.');
      return;
    }
    const url = languageBridgeService.base64ToBlobUrl(ttsResult.audio_base64, ttsResult.audio_format);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edumap-audio-${ttsLang}.mp3`;
    a.click();
    URL.revokeObjectURL(url);
  }, [ttsResult, ttsLang]);

  if (!user) return null;

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] w-full bg-background text-foreground px-3 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-8 space-y-6">
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 sm:p-6 rounded-2xl border border-border/80 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-2">
            <Languages className="w-3.5 h-3.5" /> Language Bridge AI
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Cầu Nối Ngôn Ngữ & Trợ Lý Học Thuật
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Hạ thấp rào cản ngôn ngữ với AI: Đơn giản hóa tài liệu chuyên ngành, dịch thuật chuẩn nghĩa và chuyển ngữ thành giọng đọc tự nhiên.
          </p>
        </div>
      </div>

      {/* Smart Mode Switcher (Card segmented tabs) */}
      <div className="bg-card p-1.5 sm:p-2 rounded-2xl border border-border/80 shadow-sm">
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          <button
            onClick={() => setMode('simplify')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              mode === 'simplify'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="truncate">Đơn giản hóa</span>
          </button>

          <button
            onClick={() => setMode('translate')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              mode === 'translate'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span className="truncate">Dịch thuật</span>
          </button>

          <button
            onClick={() => setMode('tts')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              mode === 'tts'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Volume2 className="w-4 h-4 shrink-0" />
            <span className="truncate">Giọng đọc AI</span>
          </button>
        </div>
      </div>

      {/* Dual Cards Layout: Input (Left) & Output (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Card 1: Input & Parameters */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/80">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Văn bản đầu vào
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setText(SAMPLE_TEXT)}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Văn bản mẫu
              </button>
              <span className="text-muted-foreground text-xs">•</span>
              <button
                type="button"
                onClick={() => setText('')}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Xóa
              </button>
            </div>
          </div>

          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nhập hoặc dán nội dung bài học, tài liệu cần xử lý..."
              rows={6}
              className="w-full p-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none resize-none leading-relaxed"
            />
            <div className="flex justify-between items-center text-[11px] text-muted-foreground mt-1">
              <span>Hỗ trợ đoạn văn tiếng Việt hoặc tiếng nước ngoài</span>
              <span>{text.length} ký tự</span>
            </div>
          </div>

          {/* Mode 1 Controls: Simplify */}
          {mode === 'simplify' && (
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                  Chọn mức độ đơn giản hóa
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDifficulty(opt.value)}
                      className={`p-3 text-left rounded-xl border transition-all ${
                        difficulty === opt.value
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                          : 'border-border/80 bg-background/50 hover:border-primary/40 text-muted-foreground'
                      }`}
                    >
                      <div className="text-xs font-bold text-foreground">{opt.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSimplify}
                disabled={simplifyLoading || !text.trim()}
                className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {simplifyLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <BookOpen className="w-4 h-4" />
                )}
                <span>{simplifyLoading ? 'AI đang phân tích & đơn giản hóa…' : 'Đơn giản hóa với AI'}</span>
              </button>
            </div>
          )}

          {/* Mode 2 Controls: Translate */}
          {mode === 'translate' && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Ngôn ngữ đích *
                  </label>
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Ngôn ngữ nguồn
                  </label>
                  <input
                    type="text"
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                    placeholder="Tự động nhận diện"
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowGlossary(!showGlossary)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 mb-2"
                >
                  <span>{showGlossary ? '− Ẩn bảng thuật ngữ' : '+ Thêm bảng thuật ngữ chuyên ngành (Glossary)'}</span>
                </button>
                {showGlossary && (
                  <textarea
                    value={glossaryText}
                    onChange={(e) => setGlossaryText(e.target.value)}
                    placeholder="VD:&#10;STEM: STEM&#10;AI: Trí tuệ nhân tạo&#10;EduMap: EduMap"
                    rows={3}
                    className="w-full p-3 bg-background border border-border rounded-xl text-xs focus:border-primary outline-none resize-none font-mono"
                  />
                )}
              </div>

              <button
                onClick={handleTranslate}
                disabled={translateLoading || !text.trim()}
                className="w-full py-3.5 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {translateLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
                <span>{translateLoading ? 'AI đang dịch thuật…' : 'Dịch văn bản ngay'}</span>
              </button>
            </div>
          )}

          {/* Mode 3 Controls: TTS */}
          {mode === 'tts' && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Ngôn ngữ phát âm
                  </label>
                  <select
                    value={ttsLang}
                    onChange={(e) => setTtsLang(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Giọng đọc (Voice tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    placeholder="Mặc định AI giọng chuẩn"
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                  />
                </div>
              </div>

              {useBrowserTTS && browserVoices.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Giọng đọc trình duyệt (Web Speech API)
                  </label>
                  <select
                    value={selectedBrowserVoice?.name || ''}
                    onChange={(e) => {
                      const voice = browserVoices.find(v => v.name === e.target.value);
                      setSelectedBrowserVoice(voice || null);
                    }}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                  >
                    {browserVoices.map((v) => (
                      <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={handleTTS}
                  disabled={ttsLoading || !text.trim()}
                  className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {ttsLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                  <span>{ttsLoading ? 'Đang tạo âm thanh…' : 'Tạo audio AI'}</span>
                </button>

                <button
                  onClick={isPlaying ? stopBrowserTTS : playBrowserTTS}
                  className="w-full py-3.5 rounded-xl bg-card border border-border hover:bg-muted text-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
                >
                  {isPlaying ? <Square className="w-4 h-4 text-destructive" /> : <Play className="w-4 h-4 text-primary" />}
                  <span>{isPlaying ? 'Dừng đọc' : 'Đọc nhanh (Trình duyệt)'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Output Card */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/80">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" /> Kết quả xử lý AI
            </span>
            <div className="flex items-center gap-2">
              {mode === 'simplify' && simplifyResult && (
                <button
                  onClick={() => handleCopy(simplifyResult.simplified)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Sao chép nội dung"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
              {mode === 'translate' && translateResult && (
                <button
                  onClick={() => handleCopy(translateResult.translated)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Sao chép bản dịch"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Mode 1 Output: Simplify */}
          {mode === 'simplify' && (
            <div className="min-h-[260px] flex flex-col justify-between">
              {simplifyLoading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-xs font-semibold text-muted-foreground">Đang đơn giản hóa câu từ và giải thích thuật ngữ…</p>
                </div>
              ) : simplifyResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-background border border-border/70 rounded-xl leading-relaxed text-sm text-foreground whitespace-pre-line">
                    {simplifyResult.simplified}
                  </div>

                  {simplifyResult.explained_terms && Object.keys(simplifyResult.explained_terms).length > 0 && (
                    <div className="p-3.5 bg-muted/40 rounded-xl border border-border/60 space-y-2">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-primary" /> Thuật ngữ đã được giải nghĩa:
                      </p>
                      <div className="space-y-1.5">
                        {Object.entries(simplifyResult.explained_terms).map(([term, exp]) => (
                          <div key={term} className="text-xs">
                            <strong className="text-primary">{term}:</strong> <span className="text-muted-foreground">{exp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                    <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-accent" /> Cấp độ: {simplifyResult.difficulty}</span>
                    <button
                      onClick={() => {
                        setText(simplifyResult.simplified);
                        setMode('tts');
                        toast.info('Đã chuyển bản đơn giản hóa sang bộ phát âm thanh');
                      }}
                      className="text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Nghe bằng giọng đọc
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs">Nhấn "Đơn giản hóa với AI" để xem phiên bản dễ hiểu.</p>
                </div>
              )}
            </div>
          )}

          {/* Mode 2 Output: Translate */}
          {mode === 'translate' && (
            <div className="min-h-[260px] flex flex-col justify-between">
              {translateLoading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <RefreshCw className="w-8 h-8 text-accent animate-spin" />
                  <p className="text-xs font-semibold text-muted-foreground">Đang dịch thuật văn bản…</p>
                </div>
              ) : translateResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-background border border-border/70 rounded-xl leading-relaxed text-sm text-foreground whitespace-pre-line">
                    {translateResult.translated}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-accent" /> 
                      Dịch sang: <strong>{LANGUAGE_OPTIONS.find(l => l.value === translateResult.target_language)?.label || translateResult.target_language}</strong>
                    </span>
                    <button
                      onClick={() => {
                        setText(translateResult.translated);
                        setTtsLang(translateResult.target_language);
                        setMode('tts');
                        toast.info('Đã chuyển bản dịch sang bộ phát âm thanh');
                      }}
                      className="text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Nghe bản dịch
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Globe className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs">Chọn ngôn ngữ và nhấn "Dịch văn bản ngay" để bắt đầu.</p>
                </div>
              )}
            </div>
          )}

          {/* Mode 3 Output: TTS Audio Player */}
          {mode === 'tts' && (
            <div className="min-h-[260px] flex flex-col justify-between">
              {ttsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-xs font-semibold text-muted-foreground">Đang tổng hợp giọng nói AI…</p>
                </div>
              ) : ttsResult?.audio_base64 ? (
                <div className="space-y-4">
                  <div className="p-5 bg-muted/40 rounded-xl border border-border/60 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <Volume2 className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Tệp âm thanh AI đã sẵn sàng</h4>
                      <p className="text-xs text-muted-foreground">Định dạng {ttsResult.audio_format} • Ngôn ngữ: {ttsResult.language}</p>
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        onClick={isPlaying ? stopAudio : playAudio}
                        className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        <span>{isPlaying ? 'Tạm dừng' : 'Phát âm thanh'}</span>
                      </button>

                      <button
                        onClick={handleDownload}
                        className="px-4 py-2.5 rounded-xl bg-card border border-border hover:bg-muted text-foreground font-bold text-xs flex items-center gap-1.5 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>Tải MP3</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Volume2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs">Nhấn "Tạo audio AI" hoặc "Đọc nhanh (Trình duyệt)" để phát âm thanh.</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
