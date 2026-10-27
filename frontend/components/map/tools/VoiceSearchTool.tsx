/**
 * Voice Search Tool — Voice-to-geo search on the unified Map Hub.
 *
 * Previously a standalone page at `/voice-search`; now the `voice-search`
 * tab on `/map`. Uses Web Speech API for client-side STT (privacy-first),
 * with XKIRO STT as a server-side fallback. Intent classification routes
 * queries to geo search, report form, or info lookup.
 *
 * Panel: record button, transcript, results list, intent display.
 * Overlay: voice search results as markers on the map.
 */
"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Mic, MicOff, Send, MapPin, Clock, Loader2, AlertCircle, Info,
} from "lucide-react";
import { toast } from "sonner";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { unwrapApiResponse } from "@/src/lib/api-utils";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

const _resultIcon = typeof window !== "undefined" ? L.icon({
  iconUrl: "data:image/svg+xml;base64," + btoa("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233b82f6'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13 3.87-7-7-7z'/><circle cx='12' cy='9' r='3'/></svg>"),
  iconSize: [22, 22],
  iconAnchor: [11, 22],
  popupAnchor: [0, -26],
}) : L.divIcon({
  html: "<div style='width:22px;height:22px;display:flex;align-items:center;justify-content:center;background:#3b82f6;border-radius:50%;border:2px solid #fff'><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff' width='10' height='10'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13 3.87-7-7-7z'/><circle cx='12' cy='9' r='3'/></svg></div>",
  iconSize: [22, 22],
  iconAnchor: [11, 22],
  popupAnchor: [0, -26],
});

function classifyIntent(query: string): string {
  const findVerbs = /tìm|tìm kiếm|tìm trường|tìm thư|vị trí|cạnh|nơi|nào|ở đâu/i;
  const questionWords = /ở đâu|là gì|bao nhiêu| có không| có ko| tại sao|tại sao| tại đâu/i;
  const reportKeywords = /báo|cáo|broken|hỏng|lỗi|đóng|đóng góp|góp ý|phản hồi/i;

  if (reportKeywords.test(query)) return "report_form";
  if (findVerbs.test(query)) return "geo_recommend";
  if (questionWords.test(query)) return "geo_query";
  return "geo_recommend";
}

export function VoiceSearchPanel({
  viewport, result, onResult, loading, setLoading, error, setError,
  active, user,
}: any) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [intent, setIntent] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startVoiceSearch = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Trình duyệt không hỗ trợ nhận diện giọng nói.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.interimResults = false;
    recognition.maxResults = 1;

    setIsRecording(true);
    recognition.start();

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsRecording(false);
      setIntent(classifyIntent(text));
      searchWithText(text);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const stopVoiceSearch = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const searchWithText = async (text: string) => {
    if (!text.trim()) return;
    try {
      setIsSearching(true);
      setError(null);
      const token = user?.accessToken;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetchWithRetry("/api/ai/speech/to-text", {
        method: "POST",
        headers,
        body: JSON.stringify({ text, lang: "vi-VN" }),
      });

      if (!response.ok) throw new Error("Không thể tìm kiếm");
      const data = await response.json();
      const poiResults = unwrapApiResponse<any>(data);
      setSearchResults(poiResults || []);
      onResult(poiResults || []);
    } catch (err: any) {
      // Fallback: use Talk2Map NL search
      try {
        const response = await fetchWithRetry("/api/map/nls-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text }),
        });
        if (response.ok) {
          const data = await response.json();
          const poiResults = unwrapApiResponse<any>(data);
          setSearchResults(poiResults || []);
          onResult(poiResults || []);
        } else {
          throw new Error("Fallback failed");
        }
      } catch {
        setError("Không thể tìm kiếm bằng giọng nói.");
        toast.error("Không thể tìm kiếm");
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleTextSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (transcript.trim() && !isSearching) {
      setIntent(classifyIntent(transcript));
      searchWithText(transcript);
    }
  };

  if (!active) return null;

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
        <Mic className="w-4 h-4 text-primary" /> Tìm bằng giọng nói
      </h3>

      <div className="flex gap-2 mb-3">
        <button
          onClick={isRecording ? stopVoiceSearch : startVoiceSearch}
          disabled={isSearching}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg transition-colors ${
            isRecording
              ? "bg-destructive text-destructive-foreground animate-pulse"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          } disabled:opacity-60`}
        >
          {isRecording ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
          {isRecording ? "Đang nghe..." : "Thu âm"}
        </button>
        <form onSubmit={handleTextSearch} className="flex-1">
          <input
            type="text"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Hoặc gõ tìm kiếm..."
            disabled={isSearching}
            className="w-full text-xs text-foreground bg-card border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary"
          />
        </form>
      </div>

      {intent && (
        <div className="mb-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground/70">
            {intent === "geo_recommend" && "Tìm địa điểm"}
            {intent === "geo_query" && "Hỏi thông tin"}
            {intent === "report_form" && "Báo cáo sự cố"}
          </span>
        </div>
      )}

      {isSearching && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 py-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Đang tìm kiếm...
        </div>
      )}

      {searchResults.length > 0 ? (
        <div className="space-y-1 max-h-52 overflow-y-auto pb-2">
          {searchResults.map((poi: any, i: number) => (
            <div
              key={i}
              className="text-xs p-2 rounded-lg border border-border hover:bg-muted/30 cursor-pointer"
              onClick={() => onResult({ selected: poi })}
            >
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <MapPin className="w-3 h-3 text-primary" />
                {poi.name || poi.title}
              </div>
              {poi.address && (
                <p className="text-muted-foreground/60 mt-0.5">{poi.address}</p>
              )}
              {poi.distance_m !== undefined && (
                <p className="text-muted-foreground/60 mt-0.5">
                  Cách {poi.distance_m} m
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        !isSearching && transcript && (
          <p className="text-xs text-muted-foreground/60 py-2">
            Không tìm thấy kết quả nào.
          </p>
        )
      )}

      {error && (
        <div className="flex items-center gap-1.5 p-2 text-xs text-muted-foreground/60 bg-muted/10 rounded-lg">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}

export function VoiceSearchOverlay({ result }: { result: any; loading: boolean; points: any[]; viewport: any }) {
  if (!result || !result.length || Array.isArray(result)) return null;

  // result could be search results array or { selected: poi }
  const poiList = Array.isArray(result) ? result : [result.selected].filter(Boolean);
  if (!poiList.length) return null;

  return (
    <>
      {poiList.map((poi: any, i: number) => {
        if (!poi.lat && !poi.lng) return null;
        return (
          <Marker key={i} position={[Number(poi.lat), Number(poi.lng)]} icon={_resultIcon}>
            <Popup>
              <div className="space-y-1">
                <div className="font-medium text-sm">{poi.name || poi.title}</div>
                {poi.address && (
                  <p className="text-xs text-muted-foreground/70">{poi.address}</p>
                )}
                {poi.distance_m !== undefined && (
                  <p className="text-xs text-muted-foreground/70">
                    Cách {poi.distance_m} m
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

const VoiceSearchTool = {
  id: "voice-search",
  label: "Giọng nói",
  longLabel: "Tìm bằng giọng nói",
  icon: Mic,
  description: "Tìm địa điểm trên bản đồ bằng giọng nói.",
  longDescription: "Sử dụng Web Speech API để tìm kiếm bản đồ bằng giọng nói, phân loại intent tự động.",
  authRequired: false,
  hideBaseLayers: false,
  Panel: VoiceSearchPanel,
  Overlay: VoiceSearchOverlay,
};

export default VoiceSearchTool;
