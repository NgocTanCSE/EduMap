"use client";
import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { authService } from '@/src/services/auth.service';

interface FileUploadProps {
  onUploadSuccess: (url: string) => void;
  accept?: string;
  label?: string;
  maxSizeMB?: number;
}

export default function FileUpload({ onUploadSuccess, accept = ".pdf,.docx,.doc", label = "Tải lên tài liệu", maxSizeMB = 10 }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > maxSizeMB * 1024 * 1024) {
      setError(`Dung lượng file quá lớn (Max ${maxSizeMB}MB)`);
      return;
    }
    setFile(selected);
    setError(null);
    startUpload(selected);
  };

  const startUpload = async (selectedFile: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const token = authService.getAccessToken();
      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const fileUrl = data.file_url || data.url;
        setUploadedUrl(fileUrl);
        onUploadSuccess(fileUrl);
      } else {
        setError("Tải lên thất bại, vui lòng thử lại.");
      }
    } catch (err) {
      setError("Lỗi kết nối máy chủ lưu trữ.");
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadedUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => !uploading && !uploadedUrl && fileInputRef.current?.click()}
        className={`p-6 rounded-[32px] border-2 border-dashed transition-all flex flex-col items-center justify-center text-center space-y-3 cursor-pointer group ${
          uploadedUrl
            ? 'bg-emerald-500/5 border-emerald-500/30'
            : 'bg-[#111111] border-white/10 hover:border-yellow-500/50'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept={accept}
          onChange={handleFileChange}
        />
        {uploading ? (
          <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
        ) : uploadedUrl ? (
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6" />
          </div>
        )}
        <div>
          <p className="text-xs font-bold text-white">
            {uploadedUrl ? "Đã tải lên thành công" : file ? file.name : label}
          </p>
          <p className="text-[10px] text-white/40 mt-1">
            {uploadedUrl ? "File đã sẵn sàng" : `Định dạng: ${accept.split(',').join(' ')} (Max ${maxSizeMB}MB)`}
          </p>
        </div>
      </div>
      {error && <p className="text-[10px] text-red-500 font-bold ml-2">{error}</p>}
      {uploadedUrl && (
        <button
          type="button"
          onClick={resetUpload}
          className="text-xs text-red-400 hover:text-red-300"
        >
          <X className="w-3 h-3 inline mr-1" />Chọn lại
        </button>
      )}
    </div>
  );
}
