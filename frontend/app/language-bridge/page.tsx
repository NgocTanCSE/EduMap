"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChevronLeft, BookOpen, Globe, Volume2, Play, Pause, Square,
  Send, Sparkles, AlertCircle, RefreshCw, Download, ExternalLink,
  Languages, FileText, Info, Check, X, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useRequireAuth } from '@/src/lib/require-auth';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';
import {
  languageBridgeService,
  Difficulty,
  SimplifyResult,
  TranslateResult,
  TTSResult,
} from '@/src/services/language-bridge.service';

// ── Constants ───────────────────────────────────────────────────────────────

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'elementary', label: 'Tiểu học (lớp 1-3)', desc: 'Từ vựng rất đơn giản, giải thích mọi thuật ngữ' },
  { value: 'middle', label: 'THCS (lớp 6-9)', desc: 'Ngôn ngữ trung bình, giải thích thuật ngữ khó' },
  { value: 'high', label: 'THPT (lớp 10-12)', desc: 'Ngôn ngữ nâng cao, truy cập dễ hiểu' },
  { value: 'college', label: 'Đại học', desc: 'Ngôn ngữ chuyên ngành nhưng vẫn rõ ràng' },
];

const LANGUAGE_OPTIONS = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
];

// Sample text for first-time visitors — a real Vietnamese educational passage.
const SAMPLE_TEXT = `Theo báo cáo của Bộ Giáo dục và Đào tạo, hệ thống giáo dục Việt Nam hiện đã có hơn 120.000 giáo viên, trong đó tỷ lệ trường hợpcổ đại học được bình ổn và phát triển bền vững. Tuy nhiên, một số vùng sâu, xa còn thiếu hụt giáo viên chất lượng cao, đặc biệt là môn Toán và Khoa học công nghệ. Để giải quyết vấn đề này, Chương trình "Giao bằng công nghệ" đã được triển khai tại 15 tỉnh thành, giúp nâng cao chất lượng dạy và học thông qua việc sử dụng thiết bị số và nền tảng giáo dục điện tử.`;

// ── Main page ──────────────────────────────────────────────────────────────

export default function LanguageBridgePage() {
  const { user } = useRequireAuth('/auth/login');

  // ── Input state ──
  const [text, setText] = useState(SAMPLE_TEXT);
  const [difficulty, setDifficulty] = useState<Difficulty>('middle');

  // ── Simplify state ──
  const [simplifyResult, setSimplifyResult] = useState<SimplifyResult | null>(null);
  const [simplifyLoading, setSimplifyLoading] = useState(false);

  // ── Translate state ──
  const [targetLang, setTargetLang] = useState('en');
  const [sourceLang, setSourceLang] = useState('');
  const [glossaryText, setGlossaryText] = useState('');
  const [translateResult, setTranslateResult] = useState<TranslateResult | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);

  // ── TTS state ──
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

  // ── Active output tab ──
  type Tab = 'simplify' | 'translate' | 'tts';
  const [activeTab, setActiveTab] = useState<Tab>('simplify');

  // ── Browser voices ──
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

  // ── Handlers ──

  const handleSimplify = useCallback(async () => {
    if (!text.trim()) {
      toast.error('Vui lòng nhập văn bản cần đơn giản hóa.');
      return;
    }
    setSimplifyLoading(true);
    try {
      const result = await languageBridgeService.simplify(text, difficulty);
      setSimplifyResult(result);
      setActiveTab('simplify');
      if (result.degraded) {
        toast.warning(result.reason || 'Đang dùng bản đơn giản hóa dự phòng.');
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
    setTranslateResult(null);
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
      setActiveTab('translate');
      if (result.degraded) {
        toast.warning(result.reason || 'Đang dùng bản dịch dự phòng.');
      }
    } catch (err: any) {
      logger.error('Translate error', err);
      toast.error(err?.message || 'Không thể dịch văn bản.');
    } finally {
      setTranslateLoading(false);
    }
  }, [text, targetLang, sourceLang, glossaryText]);

  const handleTTS = useCallback(async () => {
    const sourceText = activeTab === 'simplify' && simplifyResult?.simplified
      ? simplifyResult.simplified
      : activeTab === 'translate' && translateResult?.translated
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
      setActiveTab('tts');
      if (result.degraded && result.audio_base64 === null) {
        toast.warning('TTS qua AI Service không khả dụng — chuyển sang Web Speech API trình duyệt.');
        setUseBrowserTTS(true);
      }
    } catch (err: any) {
      logger.error('TTS error', err);
      toast.error(err?.message || 'Không thể tạo giọng nói.');
      setUseBrowserTTS(true);
    } finally {
      setTtsLoading(false);
    }
  }, [activeTab, simplifyResult, translateResult, text, ttsLang, ttsVoice]);

  // ── Audio playback ──

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

    const sourceText = activeTab === 'simplify' && simplifyResult?.simplified
      ? simplifyResult.simplified
      : activeTab === 'translate' && translateResult?.translated
      ? translateResult.translated
      : text;

    const utter = new SpeechSynthesisUtterance(sourceText);
    if (selectedBrowserVoice) utter.voice = selectedBrowserVoice;
    utter.lang = ttsLang;
    utter.onend = () => setIsPlaying(false);
    utter.onerror = (e: any) => {
      logger.error('Browser TTS error', e);
      toast.error('Phát giọng nói thất bại.');
    };
    utteranceRef.current = utter;
    setIsPlaying(true);
    speechSynthesis.speak(utter);
  }, [activeTab, simplifyResult, translateResult, text, ttsLang, selectedBrowserVoice]);

  const stopBrowserTTS = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlaying(false);
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      speechSynthesis.cancel();
    };
  }, []);

  const handleDownload = useCallback(() => {
    if (!ttsResult?.audio_base64) {
      toast.error('Không có file âm thanh để tải xuống.');
      return;
    }
    const url = languageBridgeService.base64ToBlobUrl(ttsResult.audio_base64, ttsResult.audio_format);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edumap-tts-${ttsLang}.mp3`;
    a.click();
    URL.revokeObjectURL(url);
  }, [ttsResult, ttsLang]);

  // Wait until auth is resolved.
  if (!user) return null;

  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full bg-background flex flex-col lg:flex-row overflow-hidden">
      {/* ── Left panel: input + controls ── */}
      <div className="w-full lg:w-96 flex flex-col gap-4 p-4 lg:p-6 overflow-y-auto scrollbar-hide border-r border-border bg-card">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => window.history.back()}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            title="Quay lại"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Languages className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Language Bridge AI</h1>
        </div>

        <p className="text-xs text-muted-foreground">
          Nhập văn bản, chọn độ khó để đơn giản hóa, dịch và chuyển thành giọng nói.
          Hỗ trợ tiếng Việt và đa ngôn ngữ. Dữ liệu dựa trên tài liệu được phép dùng.
        </p>

        {/* ── Text input ── */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Văn bản gốc</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nhập nội dung cần đơn giản hóa, dịch hoặc chuyển thành giọng nói..."
            className="w-full h-32 px-3 py-2 text-sm text-foreground rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none scrollbar-hide"
          />
          <div className="text-[10px] text-muted-foreground text-right">
            {text.length} ký tự {text.length > 16000 && '(giới hạn 16.000)'}
          </div>
        </div>

        {/* ── Simplify ── */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Đơn giản hóa</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDifficulty(opt.value)}
                className={`p-2 text-left rounded-lg border transition-colors ${
                  difficulty === opt.value
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border hover:border-primary/30 text-muted-foreground'
                }`}
              >
                <div className="text-xs font-medium">{opt.label}</div>
                <div className="text-[9px] opacity-70 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
          <button
            onClick={handleSimplify}
            disabled={simplifyLoading || !text.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {simplifyLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <BookOpen className="w-4 h-4" />
            )}
            {simplifyLoading ? 'Đang xử lý…' : 'Đơn giản hóa'}
          </button>
        </div>

        {/* ── Translate ── */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Dịch</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-muted-foreground">Ngôn ngữ đích</label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="mt-1 w-full text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Nguồn (tự động nếu để trống)</label>
              <input
                type="text"
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                placeholder="ví dụ: vi, en"
                className="mt-1 w-full text-xs px-2 py-1.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Bảng thuật ngữ (mỗi dòng: thuật ngữ: giữ nguyên)</label>
            <textarea
              value={glossaryText}
              onChange={(e) => setGlossaryText(e.target.value)}
              placeholder="blockchain: blockchain&#10;AI: AI&#10;Đại học: University"
              className="w-full h-16 text-xs px-2 py-1.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            />
          </div>
          <button
            onClick={handleTranslate}
            disabled={translateLoading || !text.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-accent-foreground font-medium transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            {translateLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Globe className="w-4 h-4" />
            )}
            {translateLoading ? 'Đang dịch…' : 'Dịch'}
          </button>
        </div>

        {/* ── TTS ── */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Chuyển thành giọng nói</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-muted-foreground">Ngôn ngữ</label>
              <select
                value={ttsLang}
                onChange={(e) => setTtsLang(e.target.value)}
                className="mt-1 w-full text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Voice (tùy chọn)</label>
              <input
                type="text"
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                placeholder="ví dụ: vi-VN-HoaNeural"
                className="mt-1 w-full text-xs px-2 py-1.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Browser TTS voice selector (shown when AI TTS is degraded) */}
          {useBrowserTTS && browserVoices.length > 0 && (
            <div>
              <label className="text-[10px] text-muted-foreground">Giọng nói trình duyệt</label>
              <select
                value={selectedBrowserVoice?.name || ''}
                onChange={(e) => {
                  const voice = browserVoices.find(v => v.name === e.target.value);
                  setSelectedBrowserVoice(voice || null);
                }}
                className="mt-1 w-full text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {browserVoices.map((v) => (
                  <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleTTS}
              disabled={ttsLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium transition-colors hover:bg-sky-700 disabled:opacity-60"
            >
              {ttsLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
              {ttsLoading ? 'Đang tạo…' : 'Tạo giọng nói'}
            </button>
            {useBrowserTTS ? (
              <button
                onClick={isPlaying ? stopBrowserTTS : playBrowserTTS}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-muted text-foreground font-medium transition-colors hover:bg-muted/80"
              >
                {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Dừng' : 'Phát (trình duyệt)'}
              </button>
            ) : (
              <>
                <button
                  onClick={playAudio}
                  disabled={!ttsResult?.audio_base64}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-muted text-foreground font-medium transition-colors hover:bg-muted/80 disabled:opacity-60"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  Phát
                </button>
                <button
                  onClick={stopAudio}
                  className="flex items-center justify-center w-10 rounded-lg bg-muted text-foreground transition-colors hover:bg-muted/80"
                  title="Dừng"
                >
                  <Square className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {ttsResult?.audio_base64 && (
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-muted text-muted-foreground text-xs transition-colors hover:bg-muted/50"
              >
                <Download className="w-3.5 h-3.5" />
                Tải xuống MP3
              </button>
              <button
                onClick={() => {
                  const content = simplifyResult?.simplified || translateResult?.translated || text;
                  navigator.clipboard.writeText(content || '');
                  toast.success('Đã sao chép nội dung.');
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-muted text-muted-foreground text-xs transition-colors hover:bg-muted/50"
                title="Lưu / sao chép nội dung"
              >
                <Save className="w-3.5 h-3.5" />
                Lưu
              </button>
            </div>
          )}
        </div>

        {/* Degraded banner */}
        {(simplifyResult?.degraded || translateResult?.degraded || ttsResult?.degraded) && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {simplifyResult?.degraded && simplifyResult.reason && <div>{simplifyResult.reason}</div>}
              {translateResult?.degraded && translateResult.reason && <div>{translateResult.reason}</div>}
              {ttsResult?.degraded && ttsResult.reason && <div>{ttsResult.reason}</div>}
            </span>
          </div>
        )}
      </div>

      {/* ── Right panel: output ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Tab header */}
        <div className="flex border-b border-border bg-card">
          <button
            onClick={() => { setActiveTab('simplify'); setUseBrowserTTS(false); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'simplify'
                ? 'border-primary text-primary border-b-2'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Bản dễ hiểu
          </button>
          <button
            onClick={() => setActiveTab('translate')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'translate'
                ? 'border-primary text-primary border-b-2'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Bản dịch
          </button>
          <button
            onClick={() => setActiveTab('tts')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'tts'
                ? 'border-primary text-primary border-b-2'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            Bản nghe
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
          {/* ── Simplify tab ── */}
          {activeTab === 'simplify' && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {simplifyLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang đơn giản hóa…</span>
                </div>
              ) : simplifyResult ? (
                <>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">{simplifyResult.simplified || 'Chưa có kết quả.'}</p>
                  {simplifyResult.explained_terms && Object.keys(simplifyResult.explained_terms).length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/20 border border-border">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-2">
                        <Info className="w-3.5 h-3.5" />
                        <span>Thuật ngữ đã giải thích</span>
                      </div>
                      <div className="space-y-1">
                        {Object.entries(simplifyResult.explained_terms).map(([term, explanation]) => (
                          <div key={term} className="text-xs">
                            <span className="font-medium text-primary">{term}</span>
                            <span className="text-muted-foreground"> — {explanation}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {simplifyResult.degraded && (
                    <p className="mt-2 flex items-start gap-1 text-xs text-primary">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {simplifyResult.reason}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Nhập văn bản và chọn "Đơn giản hóa" để bắt đầu.</p>
              )}
            </div>
          )}

          {/* ── Translate tab ── */}
          {activeTab === 'translate' && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {translateLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang dịch…</span>
                </div>
              ) : translateResult ? (
                <>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">{translateResult.translated || 'Chưa có bản dịch.'}</p>
                  {translateResult.degraded && (
                    <p className="mt-2 flex items-start gap-1 text-xs text-primary">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {translateResult.reason}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Nhập văn bản và chọn "Dịch" để bắt đầu.</p>
              )}
            </div>
          )}

          {/* ── TTS tab ── */}
          {activeTab === 'tts' && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              {ttsResult ? (
                ttsResult.audio_base64 ? (
                  <>
                    <audio
                      ref={audioRef}
                      controls
                      className="w-full max-w-md"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    >
                      <source
                        src={languageBridgeService.base64ToBlobUrl(ttsResult.audio_base64, ttsResult.audio_format)}
                        type={`audio/${ttsResult.audio_format}`}
                      />
                      Trình duyệt không hỗ trợ thẻ audio.
                    </audio>
                    <div className="text-xs text-muted-foreground">
                      <div>Provider: <span className="font-medium text-foreground">{ttsResult.provider || 'N/A'}</span></div>
                      <div>Thời lượng: <span className="font-medium">{Math.round(ttsResult.duration_ms / 1000)}s</span></div>
                      {ttsResult.cached && <div className="text-primary">Đã cache (24h)</div>}
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <Volume2 className="w-12 h-12 text-muted-foreground/65 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      AI TTS không khả dụng. Đang sử dụng trình duyệt (Web Speech API).
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <Volume2 className="w-16 h-16 text-muted-foreground/45 mx-auto" />
                  <p className="text-muted-foreground">Chọn "Tạo giọng nói" để nghe bản đọc.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden audio element for AI-generated TTS */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
