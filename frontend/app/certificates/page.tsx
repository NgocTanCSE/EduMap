"use client";
import React, { useEffect, useState } from 'react';
import { certificateService } from '@/src/services/certificate.service';
import { authService } from '@/src/services/auth.service';
import { Award, ShieldCheck, Link as LinkIcon, Download, ExternalLink, Hash } from 'lucide-react';
import Link from 'next/link';
import { CardSkeleton } from '../../src/components/ui/Skeleton';

export default function CertificatesPage() {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const data = await certificateService.getPortfolio();
      setPortfolio((data as any).data ?? data);
    } catch (error) {
      console.error("Lỗi fetch certificates:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="w-full mx-auto space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-card p-10 rounded-lg border border-border relative overflow-hidden">
            <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold uppercase tracking-widest mb-4">
                    <ShieldCheck className="w-3.5 h-3.5" /> Blockchain Secured
                </div>
                <h1 className="text-2xl font-semibold mb-2">My Digital Portfolio</h1>
                <p className="text-muted-foreground/40">View and manage your verifiable credentials and certificates.</p>
            </div>
            
            {portfolio && (
                <div className="relative z-10 flex flex-col items-center bg-card/40 p-6 rounded-xl border border-border">
                    <span className="text-3xl font-semibold text-primary">
                        {portfolio.total_certs}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Certificates Earned</span>
                </div>
            )}
        </div>

        {/* Certificates Grid */}
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Award className="text-primary" /> Collection
                </h2>
                {portfolio?.portfolio_link && (
                    <button className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-4 py-2 rounded-xl border border-primary/20">
                        <LinkIcon size={16} /> Share Portfolio
                    </button>
                )}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
                </div>
            ) : portfolio?.certificates?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {portfolio.certificates.map((cert: any) => (
                        <div key={cert.id} className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all group flex flex-col h-full">
                            <div className="flex-1 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 shadow-inner">
                                        {/* Mock Logo */}
                                        <div className="w-full h-full bg-muted/40 rounded-md" />
                                    </div>
                                    <span className="bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded border border-primary/20">
                                        {cert.template?.type || 'Certificate'}
                                    </span>
                                </div>
                                
                                <div>
                                    <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-primary/70 transition-colors">{cert.template?.name}</h3>
                                    <p className="text-xs text-muted-foreground">{cert.template?.organization?.name}</p>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-border">
                                    <p className="text-[10px] text-muted-foreground/40 flex items-center gap-1.5 font-mono">
                                        <Hash size={12}/> {cert.verify_code}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        Issued: {new Date(cert.issued_at).toLocaleDateString('vi-VN')}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-border">
                                <Link 
                                    href={`/certificates/verify/${cert.verify_code}`}
                                    className="bg-card/20 hover:bg-card/20 text-foreground text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors border border-border"
                                >
                                    <ShieldCheck size={14} /> Verify
                                </Link>
                                <a 
                                    href={`/certificates/verify/${cert.verify_code}`}
                                    target="_blank"
                                    className="bg-primary hover:bg-yellow-700 text-foreground text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                                >
                                    <ExternalLink size={14} /> View
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-card/30 border border-dashed border-border rounded-xl">
                    <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mx-auto mb-4">
                        <Award size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground/40 font-medium">Bạn chưa có chứng chỉ nào.</p>
                    <p className="text-muted-foreground text-sm mt-1">Hoàn thành các khóa học hoặc dự án để nhận chứng chỉ.</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
