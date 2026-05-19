"use client";
import React from 'react';
import { Briefcase, MapPin, DollarSign, Clock, Building2, Search, Filter, Bookmark, ArrowUpRight } from 'lucide-react';

const internships = [
  {
    id: 1,
    title: 'Thực tập sinh Kỹ sư AI',
    company: 'Google Vietnam',
    location: 'Quận 1, TP.HCM',
    salary: '15,000,000 VNĐ',
    type: 'Full-time',
    tags: ['Python', 'TensorFlow', 'Remote'],
    logo: 'G',
  },
  {
    id: 2,
    title: 'Frontend Developer Intern',
    company: 'VNG Corporation',
    location: 'Quận 7, TP.HCM',
    salary: '8,000,000 VNĐ',
    type: 'Part-time',
    tags: ['React', 'NextJS', 'Tailwind'],
    logo: 'V',
  },
];

export default function InternshipPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-gradient-to-br from-blue-600/10 to-purple-600/10 p-12 rounded-[40px] border border-white/5 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-4">Cơ hội Thực tập</h1>
            <p className="text-white/50 max-w-md">Tìm kiếm các vị trí thực tập tốt nhất từ các đối tác doanh nghiệp của EduMap.</p>
          </div>
          <div className="flex gap-4 relative z-10">
            <div className="p-6 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 text-center min-w-[120px]">
              <p className="text-2xl font-bold">120+</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Vị trí mới</p>
            </div>
            <div className="p-6 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 text-center min-w-[120px]">
              <p className="text-2xl font-bold">45</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Công ty</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-5">
            <Briefcase className="w-64 h-64" />
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex gap-4">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
             <input type="text" placeholder="Tìm tên công ty, vị trí..." className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors" />
           </div>
           <button className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <Filter className="w-6 h-6 text-white/60" />
           </button>
        </div>

        {/* List */}
        <div className="space-y-4">
           {internships.map(job => (
             <div key={job.id} className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all group flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                   {job.logo}
                </div>
                <div className="flex-1">
                   <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold group-hover:text-blue-400 transition-colors">{job.title}</h3>
                      <button className="text-white/20 hover:text-white transition-colors"><Bookmark className="w-5 h-5" /></button>
                   </div>
                   <div className="flex flex-wrap gap-4 text-xs text-white/40 mb-4">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {job.company}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {job.salary}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {job.type}</span>
                   </div>
                   <div className="flex gap-2">
                      {job.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 rounded-md bg-white/5 text-[10px] text-white/40">{tag}</span>
                      ))}
                   </div>
                </div>
                <button className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-blue-600 hover:text-white transition-all">
                   <ArrowUpRight className="w-6 h-6" />
                </button>
             </div>
           ))}
        </div>

      </div>
    </div>
  );
}
