import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

const API_BASE_URL = '/api/ai/language';

// ── Types ───────────────────────────────────────────────────────────────────

export type Difficulty = 'elementary' | 'middle' | 'high' | 'college';

export interface SimplifyResult {
  simplified: string;
  explained_terms: Record<string, string>;
  degraded: boolean;
  reason?: string | null;
  difficulty: string;
  cached?: boolean;
  created_at?: string;
}

export interface TranslateResult {
  translated: string;
  detected_source: string | null;
  degraded: boolean;
  reason?: string | null;
  target_language: string;
  cached?: boolean;
  created_at?: string;
}

export interface TTSResult {
  audio_base64: string | null;
  audio_format: string;
  duration_ms: number;
  provider?: string | null;
  degraded: boolean;
  reason?: string | null;
  language: string;
  cached?: boolean;
  created_at?: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

class LanguageBridgeService {
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
    const accessToken = authService.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers as Record<string, string>),
    };

    const response = await fetchWithRetry(url, { ...options, headers, retries: 2 });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        throw new Error('Bạn cần đăng nhập để sử dụng tính năng này.');
      }
      throw new Error(errorData.message || 'API request failed');
    }
    return unwrapApiResponse<any>(await response.json());
  }

  // ── Simplify ─────────────────────────────────────────────────────────────

  async simplify(text: string, difficulty: Difficulty = 'middle', context?: string): Promise<SimplifyResult> {
    if (!text || !text.trim()) {
      return {
        simplified: '',
        explained_terms: {},
        degraded: true,
        reason: 'Văn bản không được để trống.',
        difficulty,
      };
    }
    return this.fetchWithAuth(`${API_BASE_URL}/simplify`, {
      method: 'POST',
      body: JSON.stringify({ text, difficulty, context: context || null }),
    });
  }

  // ── Translate ─────────────────────────────────────────────────────────────

  async translate(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
    glossary?: Record<string, string>,
  ): Promise<TranslateResult> {
    if (!text || !text.trim()) {
      return {
        translated: '',
        detected_source: sourceLanguage || null,
        degraded: true,
        reason: 'Văn bản không được để trống.',
        target_language: targetLanguage,
      };
    }
    return this.fetchWithAuth(`${API_BASE_URL}/translate`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        target_language: targetLanguage,
        source_language: sourceLanguage || null,
        glossary: glossary || null,
      }),
    });
  }

  // ── TTS ───────────────────────────────────────────────────────────────────

  async tts(text: string, language: string = 'vi', voice?: string): Promise<TTSResult> {
    if (!text || !text.trim()) {
      return {
        audio_base64: null,
        audio_format: 'mp3',
        duration_ms: 0,
        provider: null,
        degraded: true,
        reason: 'Văn bản không được để trống.',
        language,
      };
    }
    return this.fetchWithAuth(`${API_BASE_URL}/tts`, {
      method: 'POST',
      body: JSON.stringify({ text, language, voice: voice || null }),
    });
  }

  /** Convert base64 audio to a playable blob URL for the <audio> element. */
  base64ToBlobUrl(base64: string, format: string = 'mp3'): string {
    if (!base64) return '';
    const byteChars = atob(base64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArr[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArr], { type: `audio/${format}` });
    return URL.createObjectURL(blob);
  }
}

export const languageBridgeService = new LanguageBridgeService();
