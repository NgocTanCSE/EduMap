"use client";
import React, { useEffect, useState, useRef } from 'react';
import { Cloud, UploadCloud, File, FileText, Image as ImageIcon, Trash2, Download, Search, Loader2, HardDrive } from 'lucide-react';
import { storageService, UserFile } from '@/src/services/storage.service';
import { toast } from 'sonner';

export default function StoragePage() {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const data = await storageService.getMyFiles();
      setFiles(data);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải danh sách tài liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Validate size (e.g., max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        toast.error('Kích thước file không được vượt quá 10MB');
        return;
    }

    try {
        setUploading(true);
        const newFile = await storageService.uploadFile(file);
        setFiles([newFile, ...files]);
        toast.success('Tải lên thành công!');
    } catch (error: any) {
        toast.error(error.message || 'Tải lên thất bại');
    } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Bạn có chắc chắn muốn xóa tập tin này? Hành động này không thể hoàn tác.')) return;
      try {
          await storageService.deleteFile(id);
          setFiles(files.filter(f => f.id !== id));
          toast.success('Đã xóa tập tin');
      } catch (error: any) {
          toast.error(error.message);
      }
  };

  const filteredFiles = files.filter(f => f.original_name.toLowerCase().includes(searchTerm.toLowerCase()));

  const getFileIcon = (mimeType: string) => {
      if (mimeType.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-blue-400" />;
      if (mimeType === 'application/pdf') return <FileText className="w-8 h-8 text-red-400" />;
      return <File className="w-8 h-8 text-gray-400" />;
  };

  const totalSizeKb = files.reduce((acc, f) => acc + f.size_kb, 0);
  const totalSizeMb = (totalSizeKb / 1024).toFixed(2);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-gradient-to-br from-blue-900/20 to-purple-900/10 p-12 rounded-[40px] border border-white/5 relative overflow-hidden">
          <div className="relative z-10 text-center md:text-left">
            <h1 className="text-4xl font-black mb-4">Kho Lưu Trữ Đám Mây</h1>
            <p className="text-white/60 max-w-md leading-relaxed">
              Quản lý CV, chứng chỉ, hình ảnh và tài liệu học tập của bạn. Các file này có thể dễ dàng đính kèm khi ứng tuyển học bổng hoặc thực tập.
            </p>
          </div>
          <div className="flex gap-4 relative z-10">
            <div className="p-6 rounded-3xl bg-black/40 border border-white/10 text-center min-w-[140px] shadow-xl">
              <p className="text-3xl font-extrabold text-blue-400">{files.length}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">Tập tin</p>
            </div>
            <div className="p-6 rounded-3xl bg-black/40 border border-white/10 text-center min-w-[140px] shadow-xl">
              <p className="text-3xl font-extrabold text-purple-400">{totalSizeMb} MB</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">Đã sử dụng</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Cloud className="w-64 h-64" />
          </div>
        </div>

        {/* Upload & Search Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm tài liệu..." 
                    className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" 
                />
            </div>
            <div className="md:col-span-1">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-full min-h-[56px] bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                >
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                    {uploading ? 'ĐANG TẢI LÊN...' : 'TẢI LÊN TẬP TIN'}
                </button>
            </div>
        </div>

        {/* Files Grid */}
        <div className="bg-card border border-white/5 rounded-3xl p-6 md:p-8 min-h-[400px]">
            <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-4">
                <HardDrive className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-bold">Tài liệu của tôi</h2>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>
            ) : filteredFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredFiles.map(file => (
                        <div key={file.id} className="bg-zinc-900 border border-white/10 rounded-2xl p-4 hover:border-blue-500/50 transition-colors group relative flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                                    {getFileIcon(file.mime_type)}
                                </div>
                                <button 
                                    onClick={() => handleDelete(file.id)}
                                    className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <h3 className="font-bold text-sm mb-1 truncate group-hover:text-blue-400 transition-colors" title={file.original_name}>
                                {file.original_name}
                            </h3>
                            
                            <div className="mt-auto pt-4 flex justify-between items-center text-[10px] text-white/40">
                                <span>{(file.size_kb / 1024).toFixed(2)} MB</span>
                                <span>{new Date(file.created_at).toLocaleDateString('vi-VN')}</span>
                            </div>

                            <a 
                                href={process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}${file.file_url}` : file.file_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="absolute inset-0 z-0"
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20">
                    <Cloud className="w-16 h-16 text-white/5 mx-auto mb-4" />
                    <p className="text-white/40 mb-2">Kho lưu trữ trống</p>
                    <p className="text-xs text-white/20">Hãy tải lên các tài liệu học tập của bạn.</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
