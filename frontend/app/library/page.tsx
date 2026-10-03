"use client";
import React, { useEffect, useState } from 'react';
import { 
  Search, Target, Filter, Book, Video, FileText, 
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState("Tất cả");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // AI Modal States
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchResources(1);
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

  const fetchResources = async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await libraryService.searchMaterials(searchQuery, activeTab, undefined, pageNum, 12);
      const resourcesData = response.data?.items || response.data || response;
      const meta = response.data?.meta || {};

      if (pageNum === 1) {
        setResources(Array.isArray(resourcesData) ? resourcesData : []);
      } else {
        setResources(prev => [...prev, ...(Array.isArray(resourcesData) ? resourcesData : [])]);
      }

      setHasMore(meta.currentPage < meta.totalPages);
      setPage(pageNum);
    } catch (error: any) {
      console.error("Lỗi fetch library:", error);
      toast.error(error.message || 'Failed to load library resources');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchResources(page + 1);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResources(1);
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
            <button className="bg-card border border-border px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-zinc-800 transition-all">
              <Bookmark className="w-4 h-4" /> Đã lưu
            </button>
            <button className="bg-primary px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-yellow-700 transition-all shadow-lg shadow-primary/20">
              <Download className="w-4 h-4" /> Tải app desktop
            </button>
          </div>
        </div>

        {/* AI Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-12 group">
          <div className="absolute -inset-1 bg-primary rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
          <div className="relative bg-card/80 backdrop-blur-md border border-border rounded-2xl p-2 flex items-center gap-2 shadow-2xl">
            <div className="pl-4 pr-2"><Sparkles className="w-6 h-6 text-primary" /></div>
            <input 
              type="text" 
              placeholder="Bạn muốn tìm tài liệu gì?..."
              className="flex-1 bg-transparent py-4 text-lg focus:outline-none placeholder:text-gray-600 text-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-yellow-700 transition-all flex items-center gap-2">
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
                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                : 'bg-card border-border text-muted-foreground/40 hover:border-border'
              }`}
            >
              {cat}
            </button>
          ))}
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
                className="bg-card border border-border rounded-3xl overflow-hidden hover:border-primary/50 transition-all group cursor-pointer flex flex-col h-full"
              >
                <div className={`h-48 bg-zinc-950 flex items-center justify-center relative overflow-hidden shrink-0`}>
                  {res.cover_image_url ? (
                      <img src={res.cover_image_url} alt={res.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent opacity-60"></div>
                        {res.type === "video" ? <Video className="w-16 h-16 text-muted-foreground/10 group-hover:scale-110 transition-transform duration-500" /> : <Book className="w-16 h-16 text-muted-foreground/10 group-hover:scale-110 transition-transform duration-500" />}
                      </>
                  )}
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/20">{res.type}</div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-1 text-amber-500 text-[10px] font-black mb-3 bg-amber-500/10 px-2 py-0.5 rounded-full w-max border border-amber-500/20 uppercase tracking-widest">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> POPULAR
                  </div>
                  <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-2">{res.title}</h3>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-1">{res.author || 'EduMap Library'}</p>
                  
                  <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
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
          <div className="text-center py-20 text-gray-500 border border-dashed border-border rounded-3xl">
              Không tìm thấy tài liệu phù hợp.
          </div>
        )}

        {hasMore && resources.length > 0 && !loading && (
          <div className="flex justify-center mt-12">
            <button 
              onClick={handleLoadMore} 
              disabled={loadingMore}
              className="px-8 py-3 rounded-full border border-border text-white hover:bg-card/20 text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin"/> : null}
              {loadingMore ? 'Đang tải...' : 'Tải thêm tài liệu'}
            </button>
          </div>
        )}
      </div>

      {/* AI Detail Modal Overlay */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedMaterial(null)}></div>
            <div className="relative bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-start bg-zinc-950/50">
                    <div className="pr-8">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/70 bg-primary/10 px-2 py-1 rounded-full mb-3 inline-block">
                            {selectedMaterial.category}
                        </span>
                        <h2 className="text-2xl font-black text-white leading-tight mb-2">{selectedMaterial.title}</h2>
                        <p className="text-sm text-muted-foreground/40">{selectedMaterial.author || 'Unknown Author'}</p>
                    </div>
                    <button onClick={() => setSelectedMaterial(null)} className="text-gray-500 hover:text-white bg-card/20 p-2 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button className="flex-1 bg-primary hover:bg-yellow-700 text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                            {selectedMaterial.type === 'video' ? <Video size={18}/> : <FileText size={18}/>}
                            Open Material
                        </button>
                        {selectedMaterial.file_url && (
                            <a href={selectedMaterial.file_url} download className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-border transition-all">
                                <Download size={18}/> Download
                            </a>
                        )}
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Description</h3>
                        <p className="text-muted-foreground/60 leading-relaxed text-sm">{selectedMaterial.description || 'No description available.'}</p>
                    </div>

                    {/* AI Analysis Section */}
                    <div className="bg-card border border-primary/30 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-10 -mt-10" />
                        
                        <div className="flex items-center gap-2 text-primary/70 font-black mb-6 relative z-10">
                            <BrainCircuit className={analyzing ? "animate-pulse" : ""} />
                            <h3>AI Insight & Summary</h3>
                        </div>

                        {analyzing ? (
                            <div className="space-y-4 py-4 text-center">
                                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                                <p className="text-xs text-gray-500 uppercase font-bold animate-pulse">Gemini is reading...</p>
                            </div>
                        ) : aiSummary ? (
                            <div className="space-y-6 relative z-10">
                                <p className="text-muted-foreground/70 text-sm leading-relaxed italic border-l-2 border-primary pl-4">
                                    "{aiSummary.summary}"
                                </p>
                                
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-muted-foreground/40 uppercase tracking-widest flex items-center gap-1">
                                        <Lightbulb size={14} className="text-primary"/> Key Concepts
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {aiSummary.key_concepts?.map((kc: any, idx: number) => (
                                            <div key={idx} className="bg-card/40 p-3 rounded-lg border border-border">
                                                <span className="text-sm font-bold text-blue-400 block mb-1">{kc.concept}</span>
                                                <span className="text-xs text-muted-foreground/40 leading-snug">{kc.explanation}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-muted-foreground/40 uppercase tracking-widest flex items-center gap-1">
                                        <Target size={14} className="text-green-500"/> Study Tips
                                    </h4>
                                    <ul className="space-y-2">
                                        {aiSummary.study_tips?.map((tip: string, idx: number) => (
                                            <li key={idx} className="text-xs text-muted-foreground/60 flex items-start gap-2">
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
