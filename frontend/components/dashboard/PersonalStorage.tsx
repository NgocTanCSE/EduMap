'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Cloud,
  UploadCloud,
  File,
  FileText,
  Image as ImageIcon,
  Trash2,
  Search,
  Loader2,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { storageService, type UserFile } from '@/src/services/storage.service';
import { toast } from 'sonner';

function formatSize(sizeKb: number): string {
  if (!Number.isFinite(sizeKb) || sizeKb <= 0) return '0 KB';
  if (sizeKb < 1024) return `${Math.max(1, Math.round(sizeKb))} KB`;
  return `${(sizeKb / 1024).toFixed(2)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-primary" />;
  if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-destructive" />;
  return <File className="h-5 w-5 text-muted-foreground/65" />;
}

export function PersonalStorage() {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await storageService.getMyFiles();
      setFiles(Array.isArray(data) ? data : []);
    } catch (error: any) {
      const message = error?.message || 'Không thể tải danh sách tài liệu';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Kích thước file không được vượt quá 10MB');
      return;
    }

    try {
      setUploading(true);
      const newFile = await storageService.uploadFile(file);
      setFiles((prev) => [newFile, ...prev]);
      toast.success('Tải lên thành công!');
    } catch (error: any) {
      toast.error(error?.message || 'Tải lên thất bại');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tập tin này? Hành động này không thể hoàn tác.')) {
      return;
    }
    try {
      await storageService.deleteFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      toast.success('Đã xóa tập tin');
    } catch (error: any) {
      toast.error(error?.message || 'Xóa tập tin thất bại');
    }
  };

  const filteredFiles = files.filter((f) =>
    f.original_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const totalSizeKb = files.reduce((acc, f) => acc + f.size_kb, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Lưu trữ của tôi</h3>
          <p className="mt-1 text-sm text-muted-foreground/60">
            Quản lý CV, chứng chỉ, hình ảnh và tài liệu học tập của bạn.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg border border-border bg-background/40 px-4 py-2 text-center">
            <p className="text-xl font-semibold text-primary">{files.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/65">
              Tập tin
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/40 px-4 py-2 text-center">
            <p className="text-xl font-semibold text-primary/70">{formatSize(totalSizeKb)}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/65">
              Đã dùng
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm tài liệu..."
            className="w-full rounded-lg border border-border bg-background/40 py-3 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-full min-h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {uploading ? 'Đang tải lên...' : 'Tải lên tập tin'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/40 p-4">
        <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
          <HardDrive className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Tài liệu của tôi</h4>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 py-8 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <button
              type="button"
              onClick={loadFiles}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <RefreshCw className="h-3 w-3" /> Thử lại
            </button>
          </div>
        ) : filteredFiles.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="group relative flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-lg border border-border bg-background/40 p-2.5">
                    {getFileIcon(file.mime_type)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(file.id)}
                    className="relative z-10 rounded-lg p-2 text-destructive opacity-0 transition-all hover:bg-destructive/10 group-hover:opacity-100"
                    aria-label={`Xóa ${file.original_name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <h5
                  className="mt-3 truncate text-sm font-semibold"
                  title={file.original_name}
                >
                  {file.original_name}
                </h5>

                <div className="mt-auto flex items-center justify-between pt-3 text-[10px] text-muted-foreground/65">
                  <span>{formatSize(file.size_kb)}</span>
                  <span>{new Date(file.created_at).toLocaleDateString('vi-VN')}</span>
                </div>

                <a
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 z-0"
                  aria-label={`Mở ${file.original_name}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-10 text-center">
            <Cloud className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/60">Kho lưu trữ trống</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Hãy tải lên tài liệu học tập đầu tiên của bạn.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
