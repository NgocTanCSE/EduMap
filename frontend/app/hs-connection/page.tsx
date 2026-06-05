"use client";
import React, { useEffect, useState } from 'react';
import { 
    Users, UserPlus, Check, X, Search, MapPin, Loader2, Sparkles, UserCheck
} from 'lucide-react';
import { hsConnectionService, NetworkResponse, HSUser } from '@/src/services/hs-connection.service';
import { toast } from 'sonner';

export default function HSConnectionPage() {
    const [network, setNetwork] = useState<NetworkResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchNetwork();
    }, []);

    const fetchNetwork = async () => {
        try {
            setLoading(true);
            const data = await hsConnectionService.getMyNetwork();
            setNetwork(data);
        } catch (error: any) {
            toast.error(error.message || 'Không thể tải dữ liệu mạng lưới');
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async (userId: string) => {
        try {
            setActionLoading(userId);
            await hsConnectionService.sendRequest(userId);
            toast.success('Đã gửi yêu cầu kết nối');
            // Optimistically update suggestions
            if (network) {
                setNetwork({
                    ...network,
                    suggestions: network.suggestions.filter(u => u.id !== userId)
                });
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRespond = async (connectionId: string, accept: boolean) => {
        try {
            setActionLoading(connectionId);
            await hsConnectionService.respondToRequest(connectionId, accept);
            toast.success(accept ? 'Đã chấp nhận kết nối' : 'Đã từ chối kết nối');
            fetchNetwork(); // Refresh to move from pending to friends
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setActionLoading(null);
        }
    };

    if (loading && !network) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-8">
            <div className="max-w-6xl mx-auto space-y-12">
                
                {/* Header */}
                <div className="text-center space-y-4 max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest">
                        <Sparkles className="w-4 h-4" /> Mạng lưới Học sinh
                    </div>
                    <h1 className="text-4xl font-black tracking-tight">Kết nối & Học hỏi</h1>
                    <p className="text-white/40">Mở rộng mạng lưới bạn bè, chia sẻ kinh nghiệm học tập và cùng nhau phát triển trên EduMap.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column: Network & Requests */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* Pending Requests */}
                        {network?.requests && network.requests.length > 0 && (
                            <div className="bg-card border border-white/10 rounded-3xl p-6 shadow-xl">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <UserPlus className="w-5 h-5 text-blue-400" /> 
                                    Lời mời kết bạn ({network.requests.length})
                                </h2>
                                <div className="space-y-4">
                                    {network.requests.map(req => (
                                        <div key={req.id} className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-white/5 hover:bg-zinc-900 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <img 
                                                    src={req.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.full_name)}&background=random`} 
                                                    alt="" 
                                                    className="w-12 h-12 rounded-full border border-white/10"
                                                />
                                                <div>
                                                    <p className="font-bold">{req.full_name}</p>
                                                    <p className="text-xs text-white/40">Cấp độ {req.level}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    disabled={actionLoading === req.connection_id}
                                                    onClick={() => handleRespond(req.connection_id!, true)}
                                                    className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50"
                                                >
                                                    {actionLoading === req.connection_id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                                </button>
                                                <button 
                                                    disabled={actionLoading === req.connection_id}
                                                    onClick={() => handleRespond(req.connection_id!, false)}
                                                    className="p-2 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-white/60 rounded-xl transition-colors disabled:opacity-50"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Friend List */}
                        <div className="bg-card border border-white/10 rounded-3xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-green-400" /> Bạn bè ({network?.friends?.length || 0})
                                </h2>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                    <input type="text" placeholder="Tìm bạn bè..." className="bg-zinc-900 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm focus:border-blue-500 outline-none" />
                                </div>
                            </div>
                            
                            {network?.friends && network.friends.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {network.friends.map(friend => (
                                        <div key={friend.id} className="flex items-center gap-4 p-4 bg-zinc-900/30 rounded-2xl border border-white/5 hover:border-white/10 transition-colors cursor-pointer group">
                                            <div className="relative">
                                                <img 
                                                    src={friend.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.full_name)}&background=random`} 
                                                    alt="" 
                                                    className="w-12 h-12 rounded-full border border-white/10"
                                                />
                                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0a0a0a]"></div>
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-sm group-hover:text-blue-400 transition-colors">{friend.full_name}</p>
                                                <p className="text-xs text-white/40">Level {friend.level} • {friend.points.toLocaleString()} XP</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-white/40">
                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>Bạn chưa có kết nối nào. Hãy gửi lời mời ở phần gợi ý!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Suggestions */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-b from-blue-900/20 to-transparent border border-blue-500/20 rounded-3xl p-6 sticky top-8">
                            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-yellow-400" /> Gợi ý kết bạn
                            </h2>
                            <div className="space-y-4">
                                {network?.suggestions && network.suggestions.length > 0 ? (
                                    network.suggestions.map(suggest => (
                                        <div key={suggest.id} className="bg-black/40 rounded-2xl p-4 border border-white/5 relative overflow-hidden group">
                                            <div className="flex flex-col items-center text-center space-y-3">
                                                <img 
                                                    src={suggest.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(suggest.full_name)}&background=random`} 
                                                    alt="" 
                                                    className="w-16 h-16 rounded-full border-2 border-white/10 group-hover:border-blue-500 transition-colors"
                                                />
                                                <div>
                                                    <p className="font-bold text-sm">{suggest.full_name}</p>
                                                    <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Level {suggest.level}</p>
                                                </div>
                                                <p className="text-xs text-white/60 line-clamp-2 min-h-[32px] italic">
                                                    "{suggest.bio || 'Đang tích cực hoạt động trên EduMap'}"
                                                </p>
                                                <button 
                                                    onClick={() => handleSendRequest(suggest.id)}
                                                    disabled={actionLoading === suggest.id}
                                                    className="w-full py-2 bg-white/5 hover:bg-blue-600 hover:border-blue-500 border border-white/10 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {actionLoading === suggest.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                                    KẾT NỐI
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-white/40 text-sm py-8">Không có gợi ý nào lúc này.</p>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
