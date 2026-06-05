"use client";
import React, { useEffect, useState } from 'react';
import { Wifi, MapPin, Gauge, ShieldCheck, Plus, Navigation, Loader2, SignalHigh, Star, Search } from 'lucide-react';
import { wifiService, WifiLocation } from '@/src/services/wifi.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';

export default function WifiPage() {
  const [locations, setLocations] = useState<WifiLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  // Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ name: '', ssid: '', password: '', is_free: true, provider: '', latitude: '', longitude: '' });
  const [reporting, setReporting] = useState(false);

  const [showSpeedTestModal, setShowSpeedTestModal] = useState(false);
  const [selectedWifi, setSelectedWifi] = useState<WifiLocation | null>(null);
  const [speedTestResult, setSpeedTestResult] = useState({ dl: 0, ul: 0, rating: 5, testing: false });
  const [submittingTest, setSubmittingTest] = useState(false);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const data = await wifiService.getLocations();
      setLocations(data);
    } catch (error: any) {
      toast.error('Không thể tải danh sách Wifi');
    } finally {
      setLoading(false);
    }
  };

  const handleGetNearby = () => {
      if (navigator.geolocation) {
          toast.loading('Đang tìm kiếm vệ tinh...', { id: 'gps' });
          navigator.geolocation.getCurrentPosition(
              async (position) => {
                  const lat = position.coords.latitude;
                  const lng = position.coords.longitude;
                  setUserLocation({ lat, lng });
                  try {
                      setLoading(true);
                      const data = await wifiService.getNearby(lat, lng, 5000); // 5km
                      setLocations(data);
                      toast.success(`Tìm thấy ${data.length} điểm Wifi gần bạn`, { id: 'gps' });
                  } catch (error) {
                      toast.error('Lỗi khi tìm kiếm lân cận', { id: 'gps' });
                  } finally {
                      setLoading(false);
                  }
              },
              (error) => {
                  toast.error('Không thể lấy vị trí. Kiểm tra quyền truy cập.', { id: 'gps' });
              }
          );
      } else {
          toast.error('Trình duyệt không hỗ trợ GPS');
      }
  };

  const handleReportWifi = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!authService.isLoggedIn()) {
          toast.error('Vui lòng đăng nhập để chia sẻ Wifi');
          return;
      }
      try {
          setReporting(true);
          await wifiService.reportWifi(reportForm);
          toast.success('Đã chia sẻ điểm Wifi thành công!');
          setShowReportModal(false);
          setReportForm({ name: '', ssid: '', password: '', is_free: true, provider: '', latitude: '', longitude: '' });
          fetchLocations();
      } catch (error: any) {
          toast.error(error.message);
      } finally {
          setReporting(false);
      }
  };

  const runSimulatedSpeedTest = () => {
      setSpeedTestResult({ ...speedTestResult, testing: true, dl: 0, ul: 0 });
      let progress = 0;
      const interval = setInterval(() => {
          progress += 10;
          setSpeedTestResult(prev => ({
              ...prev,
              dl: prev.dl < 45 ? prev.dl + Math.random() * 10 : prev.dl,
              ul: prev.dl > 20 ? (prev.ul < 25 ? prev.ul + Math.random() * 5 : prev.ul) : prev.ul
          }));
          if (progress >= 100) {
              clearInterval(interval);
              setSpeedTestResult(prev => ({ ...prev, testing: false }));
              toast.success('Đo tốc độ hoàn tất');
          }
      }, 300);
  };

  const handleSubmitSpeedTest = async () => {
      if (!selectedWifi) return;
      try {
          setSubmittingTest(true);
          await wifiService.submitSpeedTest(selectedWifi.id, speedTestResult.dl, speedTestResult.ul, speedTestResult.rating);
          toast.success('Đã gửi đánh giá thành công');
          setShowSpeedTestModal(false);
          fetchLocations(); // refresh speeds
      } catch (error: any) {
          toast.error(error.message);
      } finally {
          setSubmittingTest(false);
      }
  };

  const filteredLocations = locations.filter(w => 
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      w.ssid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      
      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#121215] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                <button onClick={() => setShowReportModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white">X</button>
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Plus className="text-sky-500 w-6 h-6"/> Chia sẻ điểm Wifi</h3>
                <p className="text-sm text-white/40 mb-6">Đóng góp mạng Wifi miễn phí để hỗ trợ cộng đồng sinh viên.</p>
                
                <form onSubmit={handleReportWifi} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2">Tên địa điểm (VD: Thư viện KHTN) *</label>
                        <input type="text" required value={reportForm.name} onChange={e => setReportForm({...reportForm, name: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-sky-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2">Tên mạng (SSID) *</label>
                        <input type="text" required value={reportForm.ssid} onChange={e => setReportForm({...reportForm, ssid: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-sky-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2">Mật khẩu (Nếu có)</label>
                        <input type="text" value={reportForm.password} onChange={e => setReportForm({...reportForm, password: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-sky-500 outline-none" placeholder="Để trống nếu không có mật khẩu" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-white/60 uppercase mb-2">Vĩ độ *</label>
                            <input type="number" step="any" required value={reportForm.latitude} onChange={e => setReportForm({...reportForm, latitude: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-sky-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/60 uppercase mb-2">Kinh độ *</label>
                            <input type="number" step="any" required value={reportForm.longitude} onChange={e => setReportForm({...reportForm, longitude: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-sky-500 outline-none" />
                        </div>
                    </div>
                    <button type="button" onClick={() => {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(pos => {
                                setReportForm({...reportForm, latitude: pos.coords.latitude.toString(), longitude: pos.coords.longitude.toString()});
                            });
                        }
                    }} className="w-full py-2 bg-sky-500/10 text-sky-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-sky-500/20">
                        <Navigation className="w-3 h-3" /> Lấy vị trí hiện tại
                    </button>
                    
                    <button type="submit" disabled={reporting} className="w-full py-4 mt-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-all shadow-lg shadow-sky-600/20 disabled:opacity-50">
                        {reporting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'CHIA SẺ NGAY'}
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Speed Test Modal */}
      {showSpeedTestModal && selectedWifi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#121215] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative text-center">
                <button onClick={() => setShowSpeedTestModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white">X</button>
                <Gauge className="w-12 h-12 text-sky-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-1">Kiểm tra tốc độ</h3>
                <p className="text-sm text-sky-400 font-bold mb-8">{selectedWifi.name}</p>
                
                <div className="flex justify-center gap-8 mb-8">
                    <div>
                        <p className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2">Download</p>
                        <p className="text-3xl font-mono font-black text-white">{speedTestResult.dl.toFixed(1)} <span className="text-sm text-white/40">Mbps</span></p>
                    </div>
                    <div>
                        <p className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2">Upload</p>
                        <p className="text-3xl font-mono font-black text-white">{speedTestResult.ul.toFixed(1)} <span className="text-sm text-white/40">Mbps</span></p>
                    </div>
                </div>

                {!speedTestResult.testing && speedTestResult.dl === 0 ? (
                    <button onClick={runSimulatedSpeedTest} className="w-full py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-all flex items-center justify-center gap-2">
                        <SignalHigh className="w-5 h-5" /> BẮT ĐẦU ĐO
                    </button>
                ) : !speedTestResult.testing && speedTestResult.dl > 0 ? (
                    <div className="space-y-4">
                        <div className="flex justify-center gap-2">
                            {[1,2,3,4,5].map(star => (
                                <Star 
                                    key={star} 
                                    onClick={() => setSpeedTestResult({...speedTestResult, rating: star})}
                                    className={`w-8 h-8 cursor-pointer transition-colors ${speedTestResult.rating >= star ? 'text-yellow-500 fill-yellow-500' : 'text-white/10'}`} 
                                />
                            ))}
                        </div>
                        <button onClick={handleSubmitSpeedTest} disabled={submittingTest} className="w-full py-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-all shadow-lg shadow-sky-600/20 flex justify-center items-center gap-2">
                            {submittingTest ? <Loader2 className="w-5 h-5 animate-spin" /> : 'GỬI ĐÁNH GIÁ'}
                        </button>
                    </div>
                ) : (
                    <div className="w-full py-4 rounded-xl bg-sky-600/20 text-sky-400 font-bold flex justify-center items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> ĐANG ĐO...
                    </div>
                )}
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-gradient-to-br from-sky-600/20 to-indigo-600/10 p-12 rounded-[40px] border border-white/5 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-black mb-4">EduMap WiFi</h1>
            <p className="text-white/60 max-w-xl leading-relaxed">
              Bản đồ phủ sóng Wifi miễn phí tại các điểm trường và khu vực công cộng. Chia sẻ và cùng nhau xây dựng cộng đồng học tập không rào cản.
            </p>
          </div>
          <div className="relative z-10 flex gap-4">
             <button 
                onClick={handleGetNearby}
                className="px-6 py-4 bg-zinc-900 border border-white/10 hover:border-sky-500 rounded-2xl font-bold flex items-center gap-2 transition-all"
             >
                <Navigation className="w-5 h-5 text-sky-400" /> TÌM GẦN ĐÂY
             </button>
             <button 
                onClick={() => {
                    if (!authService.isLoggedIn()) {
                        toast.error('Vui lòng đăng nhập để chia sẻ');
                        return;
                    }
                    setShowReportModal(true);
                }}
                className="px-6 py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-sky-600/20 transition-all"
             >
                <Plus className="w-5 h-5" /> CHIA SẺ WIFI
             </button>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Wifi className="w-64 h-64" />
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto md:mx-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input 
                type="text" 
                placeholder="Tìm tên địa điểm, SSID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-sky-500 transition-colors" 
            />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>
        ) : filteredLocations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLocations.map(wifi => (
              <div key={wifi.id} className="bg-card border border-white/10 rounded-[32px] p-6 hover:border-sky-500/30 transition-all group relative overflow-hidden flex flex-col h-full">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 blur-[40px] rounded-full -mr-10 -mt-10 pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center">
                          <Wifi className={`w-6 h-6 ${wifi.speed_mbps >= 30 ? 'text-green-500' : wifi.speed_mbps >= 10 ? 'text-yellow-500' : 'text-red-500'}`} />
                      </div>
                      <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-sky-400">
                          {wifi.verified ? 'ĐÃ XÁC THỰC' : 'CỘNG ĐỒNG'}
                      </span>
                  </div>
                  
                  <h3 className="text-xl font-bold mb-1 group-hover:text-sky-400 transition-colors line-clamp-1">{wifi.name}</h3>
                  <p className="text-sm font-mono text-white/60 mb-6 bg-black/40 px-3 py-2 rounded-lg border border-white/5 w-fit">
                      SSID: {wifi.ssid}
                  </p>
                  
                  <div className="space-y-3 pt-4 border-t border-white/5 mt-auto relative z-10">
                      <div className="flex items-center justify-between text-xs">
                          <span className="text-white/40 flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> Mật khẩu</span>
                          <span className="font-mono text-white/80">{wifi.is_free ? 'Không có' : (wifi.password || 'Đã ẩn')}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                          <span className="text-white/40 flex items-center gap-2"><Gauge className="w-4 h-4"/> Tốc độ (Đám đông)</span>
                          <span className="font-mono font-bold text-sky-400">{wifi.speed_mbps || 0} Mbps</span>
                      </div>
                  </div>

                  <button 
                      onClick={() => {
                          if (!authService.isLoggedIn()) {
                              toast.error('Vui lòng đăng nhập');
                              return;
                          }
                          setSelectedWifi(wifi);
                          setShowSpeedTestModal(true);
                      }}
                      className="w-full mt-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-bold transition-all relative z-10"
                  >
                      ĐO TỐC ĐỘ LẠI
                  </button>
              </div>
            ))}
          </div>
        ) : (
            <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                <Wifi className="w-12 h-12 text-white/10 mx-auto mb-4 opacity-50" />
                <p className="text-white/40">Không tìm thấy điểm Wifi nào.</p>
            </div>
        )}

      </div>
    </div>
  );
}
