"use client";
import React, { useEffect, useState } from 'react';
import { 
  Search, Filter, Book, Video, FileText, 
  Download, ExternalLink, Bookmark, Sparkles,
  ArrowRight, Star, X, BrainCircuit, Lightbulb, Loader2
} from 'lucide-react';
import { libraryService } from '@/src/services/library.service';
import { CardSkeleton } from '../../src/components/ui/Skeleton';
import { toast } from 'sonner';

export default function LibraryPage() {
  const [resources, setResources] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(["Tất cả", "Programming", "Soft Skills", "Science", "Design"]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Tất cả");
  const [searchQuery, setSearchQuery] = useState("");

  // AI Modal States
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchResources();
  }, [activeTab]);

  const fetchInitialData = async () => {
    try {
      // In a real scenario, we might fetch dynamic categories from an API
      // const dynamicCategories = await libraryService.getCategories();
      // setCategories(["Tất cả", ...dynamicCategories]);
    } catch (error) {
      console.error("Lỗi fetch categories:", error);
    }
  };

  const fetchResources = async () => {
    try {
      setLoading(true);
      const data = await libraryService.searchMaterials(searchQuery, activeTab);
      setResources(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Lỗi fetch library:", error);
      toast.error(error.message || 'Failed to load library resources');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResources();
  };

  const handleViewDetails = async (material: any) => {
    setSelectedMaterial(material);
    setAiSummary(null); 
    try {
      setAnalyzing(true);
      const summary = await libraryService.getMaterialSummary(material.id);
      setAiSummary(summary);
      toast.success('AI Analysis Complete');
    } catch (error) {
      toast.error('AI could not analyze this material right now');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 relative">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold mb-2">Thư viện học liệu</h1>
            <p className="text-gray-500 font-medium">Khám phá hàng ngàn tài liệu chất lượng cao được AI phân tích</p>
          </div>
          <div className="flex gap-3">
            <button className="bg-zinc-900 border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-zinc-800 transition-all">
              <Bookmark className="w-4 h-4" /> Đã lưu
            </button>
            <button className="bg-yellow-600 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-yellow-700 transition-all shadow-lg shadow-yellow-600/20">
              <Download className="w-4 h-4" /> Tải app desktop
            </button>
          </div>
        </div>

        {/* AI Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-12 group">
          <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-purple-600 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
          <div className="relative bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-2 flex items-center gap-2 shadow-2xl">
            <div className="pl-4 pr-2"><Sparkles className="w-6 h-6 text-yellow-500" /></div>
            <input 
              type="text" 
              placeholder="Bạn muốn tìm tài liệu gì?..."
              className="flex-1 bg-transparent py-4 text-lg focus:outline-none placeholder:text-gray-600 text-yellow-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="bg-yellow-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-yellow-700 transition-all flex items-center gap-2">
              Tìm kiếm AI <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </form>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all border ${
                activeTab === cat 
                ? 'bg-yellow-600 border-yellow-500 text-white shadow-lg shadow-yellow-600/20' 
                : 'bg-zinc-900 border-white/5 text-gray-400 hover:border-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

          <div className="bg-zinc-900/50 p-1 rounded-xl flex items-center gap-1 border border-white/5">
            {CATEGORIES.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === cat ? 'bg-yellow-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button className="ml-auto bg-zinc-900/50 border border-white/10 p-2.5 rounded-xl hover:bg-zinc-800 transition-all">
            <Filter className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Resources Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : resources.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {resources.map(res => (
              <div 
                key={res.id} 
                onClick={() => handleViewDetails(res)}
                className="bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden hover:border-yellow-600/50 transition-all group cursor-pointer flex flex-col h-full"
              >
                <div className={`h-48 bg-zinc-950 flex items-center justify-center relative overflow-hidden shrink-0`}>
                  {res.cover_image_url ? (
                      <img src={res.cover_image_url} alt={res.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent opacity-60"></div>
                        {res.type === "video" ? <Video className="w-16 h-16 text-white/10 group-hover:scale-110 transition-transform duration-500" /> : <Book className="w-16 h-16 text-white/10 group-hover:scale-110 transition-transform duration-500" />}
                      </>
                  )}
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-yellow-500 border border-yellow-500/20">{res.type}</div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-1 text-amber-500 text-[10px] font-black mb-3 bg-amber-500/10 px-2 py-0.5 rounded-full w-max border border-amber-500/20 uppercase tracking-widest">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> POPULAR
                  </div>
                  <h3 className="font-bold text-lg mb-1 group-hover:text-yellow-500 transition-colors line-clamp-2">{res.title}</h3>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-1">{res.author || 'EduMap Library'}</p>
                  
                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">{res.view_count} views</span>
                    <button className="text-gray-500 hover:text-white transition-colors">
                      <Bookmark className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500 border border-dashed border-white/10 rounded-3xl">
              Không tìm thấy tài liệu phù hợp.
          </div>
        )}
      </div>

      {/* AI Detail Modal Overlay */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedMaterial(null)}></div>
            <div className="relative bg-zinc-900 border border-white/10 rounded-[2rem] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-zinc-950/50">
                    <div className="pr-8">
                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full mb-3 inline-block">
                            {selectedMaterial.category}
                        </span>
                        <h2 className="text-2xl font-black text-white leading-tight mb-2">{selectedMaterial.title}</h2>
                        <p className="text-sm text-gray-400">{selectedMaterial.author || 'Unknown Author'}</p>
                    </div>
                    <button onClick={() => setSelectedMaterial(null)} className="text-gray-500 hover:text-white bg-white/5 p-2 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                            {selectedMaterial.type === 'video' ? <Video size={18}/> : <FileText size={18}/>}
                            Open Material
                        </button>
                        {selectedMaterial.file_url && (
                            <a href={selectedMaterial.file_url} download className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-white/5 transition-all">
                                <Download size={18}/> Download
                            </a>
                        )}
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Description</h3>
                        <p className="text-gray-300 leading-relaxed text-sm">{selectedMaterial.description || 'No description available.'}</p>
                    </div>

                    {/* AI Analysis Section */}
                    <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full -mr-10 -mt-10" />
                        
                        <div className="flex items-center gap-2 text-purple-400 font-black mb-6 relative z-10">
                            <BrainCircuit className={analyzing ? "animate-pulse" : ""} />
                            <h3>AI Insight & Summary</h3>
                        </div>

                        {analyzing ? (
                            <div className="space-y-4 py-4 text-center">
                                <div className="w-8 h-8 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto" />
                                <p className="text-xs text-gray-500 uppercase font-bold animate-pulse">Gemini is reading...</p>
                            </div>
                        ) : aiSummary ? (
                            <div className="space-y-6 relative z-10">
                                <p className="text-gray-200 text-sm leading-relaxed italic border-l-2 border-purple-500 pl-4">
                                    "{aiSummary.summary}"
                                </p>
                                
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                        <Lightbulb size={14} className="text-yellow-500"/> Key Concepts
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {aiSummary.key_concepts?.map((kc: any, idx: number) => (
                                            <div key={idx} className="bg-black/40 p-3 rounded-lg border border-white/5">
                                                <span className="text-sm font-bold text-blue-400 block mb-1">{kc.concept}</span>
                                                <span className="text-xs text-gray-400 leading-snug">{kc.explanation}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                        <Target size={14} className="text-green-500"/> Study Tips
                                    </h4>
                                    <ul className="space-y-2">
                                        {aiSummary.study_tips?.map((tip: string, idx: number) => (
                                            <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                                                <span className="text-green-500 mt-0.5">•</span> {tip}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic text-center py-4">AI analysis is not available for this material.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
