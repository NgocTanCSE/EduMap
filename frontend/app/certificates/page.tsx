"use client";
import React, { useEffect, useState } from 'react';
import { certificateService } from '../../src/services/certificate.service';
import { authService } from '../../src/services/auth.service';
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
      setPortfolio(data);
    } catch (error) {
      console.error("Lỗi fetch certificates:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-gradient-to-br from-zinc-900 to-black p-10 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 blur-[80px] -mr-10 -mt-10" />
            <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-black uppercase tracking-widest mb-4">
                    <ShieldCheck className="w-3.5 h-3.5" /> Blockchain Secured
                </div>
                <h1 className="text-4xl font-black mb-2">My Digital Portfolio</h1>
                <p className="text-gray-400">View and manage your verifiable credentials and certificates.</p>
            </div>
            
            {portfolio && (
                <div className="relative z-10 flex flex-col items-center bg-black/40 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
                    <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-amber-600">
                        {portfolio.total_certs}
                    </span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Certificates Earned</span>
                </div>
            )}
        </div>

        {/* Certificates Grid */}
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Award className="text-yellow-500" /> Collection
                </h2>
                {portfolio?.portfolio_link && (
                    <button className="flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20">
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
                        <div key={cert.id} className="bg-zinc-900 border border-white/10 rounded-3xl p-6 hover:border-yellow-500/50 transition-all group flex flex-col h-full">
                            <div className="flex-1 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 shadow-inner">
                                        {/* Mock Logo */}
                                        <div className="w-full h-full bg-zinc-200 rounded-md" />
                                    </div>
                                    <span className="bg-yellow-500/10 text-yellow-500 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border border-yellow-500/20">
                                        {cert.template?.type || 'Certificate'}
                                    </span>
                                </div>
                                
                                <div>
                                    <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-yellow-400 transition-colors">{cert.template?.name}</h3>
                                    <p className="text-xs text-gray-500">{cert.template?.organization?.name}</p>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-white/5">
                                    <p className="text-[10px] text-gray-400 flex items-center gap-1.5 font-mono">
                                        <Hash size={12}/> {cert.verify_code}
                                    </p>
                                    <p className="text-[10px] text-gray-500">
                                        Issued: {new Date(cert.issued_at).toLocaleDateString('vi-VN')}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-white/5">
                                <Link 
                                    href={`/certificates/verify/${cert.verify_code}`}
                                    className="bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors border border-white/5"
                                >
                                    <ShieldCheck size={14} /> Verify
                                </Link>
                                <a 
                                    href={`/certificates/verify/${cert.verify_code}`}
                                    target="_blank"
                                    className="bg-yellow-600 hover:bg-yellow-700 text-black text-xs font-black py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-600/20"
                                >
                                    <ExternalLink size={14} /> View
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-zinc-900/30 border border-dashed border-white/10 rounded-3xl">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Award size={24} className="text-gray-500" />
                    </div>
                    <p className="text-gray-400 font-medium">Bạn chưa có chứng chỉ nào.</p>
                    <p className="text-gray-500 text-sm mt-1">Hoàn thành các khóa học hoặc dự án để nhận chứng chỉ.</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
