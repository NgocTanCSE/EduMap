"use client";
import React, { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings, Users, MessageCircle, Maximize2, Share2 } from 'lucide-react';

export default function VideoCallPage() {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Main Video Area */}
      <div className="flex-1 p-6 relative flex gap-4">
        {/* Main Peer Video */}
        <div className="flex-1 bg-slate-900 rounded-[32px] overflow-hidden relative border border-white/5 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10" />
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-4 mx-auto">
                    <Users className="w-10 h-10 text-blue-400" />
                </div>
                <p className="text-xl font-bold text-white/80">Mentor: Nguyễn Văn A</p>
                <p className="text-sm text-white/40 mt-1">Đang chờ tín hiệu...</p>
             </div>
          </div>
          
          <div className="absolute bottom-6 left-6 p-3 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-white/80">00:15:24</span>
          </div>
        </div>

        {/* Local Self Video */}
        <div className="w-72 bg-slate-800 rounded-3xl overflow-hidden relative border border-white/10 shadow-xl self-end mb-4 mr-4">
           {!isCamOn ? (
              <div className="w-full aspect-video flex items-center justify-center bg-black/40">
                <VideoOff className="w-8 h-8 text-white/20" />
              </div>
           ) : (
              <div className="w-full aspect-video bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center">
                <p className="text-xs text-white/40">Camera của bạn</p>
              </div>
           )}
           <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 backdrop-blur-md">
             <Maximize2 className="w-3 h-3 text-white/60" />
           </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="h-28 bg-[#111] border-t border-white/5 px-12 flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-xs font-bold text-white/80">Session: AI Career Roadmaps</p>
              <p className="text-[10px] text-white/40">Mentor-to-Student Call</p>
           </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMicOn(!isMicOn)}
            className={`p-4 rounded-2xl border transition-all ${isMicOn ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-red-500/20 border-red-500/30 text-red-500'}`}
          >
            {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
          
          <button 
            onClick={() => setIsCamOn(!isCamOn)}
            className={`p-4 rounded-2xl border transition-all ${isCamOn ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-red-500/20 border-red-500/30 text-red-500'}`}
          >
            {isCamOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          <button className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all">
            <Share2 className="w-6 h-6" />
          </button>

          <button className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all">
            <MessageCircle className="w-6 h-6" />
          </button>

          <button className="mx-4 p-5 rounded-[24px] bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 transition-all">
            <PhoneOff className="w-8 h-8" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
