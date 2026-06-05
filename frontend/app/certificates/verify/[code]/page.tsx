"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { certificateService } from '@/src/services/certificate.service';
import { ShieldCheck, Printer, Download, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function VerifyCertificatePage() {
  const params = useParams();
  const code = params.code as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (code) {
      verifyCert();
    }
  }, [code]);

  const verifyCert = async () => {
    try {
      const res = await certificateService.verifyCertificate(code);
      setData(res);
    } catch (error) {
      toast.error('Failed to verify certificate');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white/50">Verifying on Blockchain...</div>;

  if (!data?.isValid) {
      return (
          <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
              <div className="bg-red-500/10 border border-red-500/30 p-8 rounded-3xl max-w-md text-center space-y-4">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <XCircle size={40} className="text-red-500" />
                  </div>
                  <h1 className="text-2xl font-black text-red-400">Invalid Certificate</h1>
                  <p className="text-gray-400 text-sm leading-relaxed">{data?.message || 'The verification code provided is invalid or the certificate has been revoked.'}</p>
              </div>
          </div>
      );
  }

  const { details } = data;

  return (
    <div className="min-h-screen bg-[#050505] py-12 px-4 print:bg-white print:py-0 print:px-0">
        
        {/* Actions - Hidden when printing */}
        <div className="max-w-4xl mx-auto flex justify-end gap-4 mb-8 print:hidden">
            <button onClick={handlePrint} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2">
                <Printer size={18} /> Print / Save PDF
            </button>
            <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2">
                <ShieldCheck size={18} /> Valid Verified
            </div>
        </div>

        {/* Certificate Container - Designed for A4 Landscape */}
        <div className="max-w-[1122px] mx-auto bg-white text-zinc-900 rounded-none md:rounded-lg shadow-2xl relative overflow-hidden print:shadow-none print:w-[1122px] print:h-[793px] print:mx-0 flex flex-col justify-center items-center aspect-[1.414/1] border-[20px] border-zinc-900">
            
            {/* Corner Decorations */}
            <div className="absolute top-0 left-0 w-64 h-64 border-t-8 border-l-8 border-yellow-500 m-8 opacity-20" />
            <div className="absolute bottom-0 right-0 w-64 h-64 border-b-8 border-r-8 border-yellow-500 m-8 opacity-20" />
            
            <div className="text-center z-10 w-full px-20">
                <h2 className="text-2xl font-bold tracking-[0.5em] text-zinc-400 uppercase mb-8">Certificate of Completion</h2>
                
                <div className="mb-12">
                    <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">This is to certify that</p>
                    <h1 className="text-6xl md:text-7xl font-black text-zinc-900 font-serif" style={{ fontFamily: 'Georgia, serif' }}>
                        {details.recipient?.name || 'Student Name'}
                    </h1>
                </div>

                <div className="mb-12 max-w-3xl mx-auto">
                    <p className="text-lg text-zinc-600 leading-relaxed">
                        has successfully completed the requirements and is hereby awarded this certificate for the program:
                    </p>
                    <h3 className="text-3xl font-black text-yellow-600 mt-4 leading-tight">{details.title}</h3>
                </div>

                <div className="flex justify-between items-end w-full max-w-4xl mx-auto border-t-2 border-zinc-200 pt-8 mt-16">
                    <div className="text-left">
                        <p className="font-bold text-lg text-zinc-800">{details.issuer}</p>
                        <p className="text-sm text-zinc-500 uppercase tracking-widest">Issuing Organization</p>
                    </div>

                    <div className="text-center">
                        <div className="w-24 h-24 mx-auto bg-zinc-100 p-2 border border-zinc-200 rounded-lg">
                            {/* In a real app, render actual QR code image here */}
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://edumap.app/certificates/verify/${details.verify_code}`} alt="QR Code" className="w-full h-full opacity-80 mix-blend-multiply" />
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-2 font-mono">{details.verify_code}</p>
                    </div>

                    <div className="text-right">
                        <p className="font-bold text-lg text-zinc-800">{new Date(details.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <p className="text-sm text-zinc-500 uppercase tracking-widest">Date Issued</p>
                    </div>
                </div>

                {/* Blockchain Badge */}
                {details.blockchain && (
                    <div className="absolute bottom-8 left-8 text-left text-[8px] text-zinc-400 font-mono max-w-xs">
                        <p>Secured on {details.blockchain.network}</p>
                        <p>Block: {details.blockchain.block_height}</p>
                        <p>Tx: {details.blockchain.tx_hash}</p>
                    </div>
                )}
            </div>
        </div>

    </div>
  );
}
