"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings, Users, MessageCircle, Maximize2, Share2, Monitor, MonitorOff } from 'lucide-react';

interface PeerConnection {
  connection: RTCPeerConnection;
  stream: MediaStream;
}

export default function VideoCallPage() {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{sender: string; message: string}[]>([]);
  const [newMessage, setNewMessage] = useState('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Initialize local video
  useEffect(() => {
    initLocalVideo();
    return () => {
      cleanupResources();
    };
  }, []);

  // Update call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  const initLocalVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsConnected(true);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      // Fallback to no media
      setIsConnected(false);
    }
  };

  const cleanupResources = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCamOn(videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
        // Replace video track
        const videoTrack = screenStream.getVideoTracks()[0];
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(
            s => s.track?.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        }
        setIsScreenSharing(true);
        
        // Handle user stopping screen share
        videoTrack.onended = () => {
          setIsScreenSharing(false);
        };
      } else {
        // Stop screen sharing
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (peerConnectionRef.current && videoTrack) {
          const sender = peerConnectionRef.current.getSenders().find(
            s => s.track?.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        }
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  };

  const endCall = () => {
    cleanupResources();
    setIsConnected(false);
    setCallDuration(0);
    // Navigate back or show end call screen
    window.history.back();
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      setChatMessages(prev => [...prev, { sender: 'Bạn', message: newMessage }]);
      setNewMessage('');
      // In real app, send via WebSocket
    }
  };

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Main Video Area */}
      <div className="flex-1 p-6 relative flex gap-4">
        {/* Main Peer Video (Remote) */}
        <div className="flex-1 bg-slate-900 rounded-[32px] overflow-hidden relative border border-white/5 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-purple-500/10" />
          
          {isConnected ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-yellow-600/20 border border-yellow-500/30 flex items-center justify-center mb-4 mx-auto">
                  <Users className="w-10 h-10 text-yellow-400" />
                </div>
                <p className="text-xl font-bold text-white/80">Mentor: Nguyễn Văn A</p>
                <p className="text-sm text-white/40 mt-1">Đang chờ kết nối...</p>
              </div>
            </div>
          )}
          
          <div className="absolute bottom-6 left-6 p-3 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-xs font-medium text-white/80">{formatDuration(callDuration)}</span>
          </div>
          
          <div className="absolute top-6 left-6 p-3 rounded-xl bg-black/40 border border-white/10">
            <p className="text-xs font-medium text-white/80">Mentor Session: AI Career Roadmaps</p>
          </div>
        </div>

        {/* Local Self Video */}
        <div className="w-72 bg-slate-800 rounded-3xl overflow-hidden relative border border-white/10 shadow-xl self-end mb-4 mr-4">
          {isCamOn ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video object-cover"
            />
          ) : (
            <div className="w-full aspect-video flex items-center justify-center bg-black/40">
              <VideoOff className="w-8 h-8 text-white/20" />
            </div>
          )}
          <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40">
            <Maximize2 className="w-3 h-3 text-white/60" />
          </div>
          <div className="absolute bottom-3 left-3 p-1.5 rounded-lg bg-black/40">
            <span className="text-[10px] text-white/60">Bạn</span>
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-80 bg-slate-900 rounded-3xl border border-white/10 flex flex-col">
            <div className="p-4 border-b border-white/10">
              <p className="text-sm font-medium text-white/80">Chat</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.sender === 'Bạn' ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-white/40 mb-1">{msg.sender}</span>
                  <div className={`p-2 rounded-xl max-w-[80%] ${msg.sender === 'Bạn' ? 'bg-yellow-600/20 text-yellow-200' : 'bg-white/10 text-white/80'}`}>
                    <p className="text-xs">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Nhập tin nhắn..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-yellow-500/50"
                />
                <button
                  onClick={sendMessage}
                  className="p-2 rounded-xl bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="h-28 bg-[#111] border-t border-white/5 px-12 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-card border border-white/10">
            <p className="text-xs font-bold text-white/80">Session: AI Career Roadmaps</p>
            <p className="text-[10px] text-white/40">Mentor-to-Student Call</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleMic}
            className={`p-4 rounded-2xl border transition-all ${isMicOn ? 'bg-card border-white/10 text-white hover:bg-card' : 'bg-red-500/20 border-red-500/30 text-red-500'}`}
          >
            {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
          
          <button 
            onClick={toggleCam}
            className={`p-4 rounded-2xl border transition-all ${isCamOn ? 'bg-card border-white/10 text-white hover:bg-card' : 'bg-red-500/20 border-red-500/30 text-red-500'}`}
          >
            {isCamOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          <button 
            onClick={toggleScreenShare}
            className={`p-4 rounded-2xl border transition-all ${isScreenSharing ? 'bg-yellow-600/20 border-yellow-500/30 text-yellow-400' : 'bg-card border-white/10 text-white hover:bg-card'}`}
          >
            {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
          </button>

          <button 
            onClick={() => setShowChat(!showChat)}
            className={`p-4 rounded-2xl border transition-all ${showChat ? 'bg-yellow-600/20 border-yellow-500/30 text-yellow-400' : 'bg-card border-white/10 text-white hover:bg-card'}`}
          >
            <MessageCircle className="w-6 h-6" />
          </button>

          <button className="p-4 rounded-2xl bg-card border border-white/10 text-white hover:bg-card transition-all">
            <Share2 className="w-6 h-6" />
          </button>

          <button 
            onClick={endCall}
            className="mx-4 p-5 rounded-[24px] bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 transition-all"
          >
            <PhoneOff className="w-8 h-8" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-4 rounded-2xl bg-card border border-white/10 text-white/60 hover:text-white transition-all">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
