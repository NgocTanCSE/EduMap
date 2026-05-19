"use client";
import React from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, BookOpen, Map, MessageSquare, 
  Settings, LogOut, Bell, Search, TrendingUp, 
  Clock, Award, Users, ChevronRight 
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#070707] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0a0a] p-6 hidden lg:flex flex-col">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Award className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">EduMap</span>
        </div>

        <nav className="space-y-2 flex-1">
          <Link href="/dashboard" className="flex items-center gap-3 p-3 rounded-xl bg-blue-600 text-white font-medium">
            <LayoutDashboard className="w-5 h-5" /> Tổng quan
          </Link>
          <Link href="/library" className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-white/5 hover:text-white transition-all">
            <BookOpen className="w-5 h-5" /> Thư viện
          </Link>
          <Link href="/map" className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-white/5 hover:text-white transition-all">
            <Map className="w-5 h-5" /> Bản đồ AI
          </Link>
          <Link href="/ai-chat" className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-white/5 hover:text-white transition-all">
            <MessageSquare className="w-5 h-5" /> AI Chat
          </Link>
        </nav>

        <div className="pt-6 border-t border-white/5 space-y-2">
          <Link href="/settings" className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-white/5 hover:text-white transition-all">
            <Settings className="w-5 h-5" /> Cài đặt
          </Link>
          <Link href="/auth/login" className="flex items-center gap-3 p-3 rounded-xl text-red-500/70 hover:bg-red-500/10 transition-all">
            <LogOut className="w-5 h-5" /> Đăng xuất
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="p-6 border-b border-white/5 flex justify-between items-center bg-[#070707]/80 backdrop-blur-md sticky top-0 z-20">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" placeholder="Tìm kiếm khóa học, mentor..." className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-600/50" />
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-400 hover:text-white transition-all">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#070707]"></span>
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 border-2 border-white/10 shadow-lg"></div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold mb-2">Chào buổi sáng, Tân! 👋</h1>
            <p className="text-gray-500">Bạn đã hoàn thành 85% lộ trình Backend Developer tuần này.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { label: 'Số giờ học', value: '24h', icon: Clock, color: 'text-blue-500' },
              { label: 'Khóa học', value: '12', icon: BookOpen, color: 'text-purple-500' },
              { label: 'Chứng chỉ', value: '04', icon: Award, color: 'text-yellow-500' },
              { label: 'Kết nối Mentor', value: '08', icon: Users, color: 'text-green-500' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 bg-white/5 rounded-lg ${stat.color}`}><stat.icon className="w-5 h-5" /></div>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div className="text-2xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Learning Path Progress */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Lộ trình hiện tại: Backend Developer</h2>
                  <Link href="/career/quiz" className="text-sm text-blue-500 hover:underline">Thay đổi mục tiêu</Link>
                </div>
                <div className="space-y-6">
                  {[
                    { title: 'Thiết kế Database SQL', progress: 100, status: 'Hoàn thành' },
                    { title: 'API RESTful với NestJS', progress: 65, status: 'Đang học' },
                    { title: 'Deploy với Docker & CI/CD', progress: 0, status: 'Chờ' },
                  ].map((step, i) => (
                    <div key={i} className="relative pl-8 border-l-2 border-white/10 pb-6 last:pb-0 last:border-0">
                      <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-[#070707] ${step.progress === 100 ? 'bg-green-500' : step.progress > 0 ? 'bg-blue-600' : 'bg-gray-600'}`}></div>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">{step.title}</span>
                        <span className="text-xs text-gray-500">{step.status}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${step.progress}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommended Mentors */}
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h2 className="text-xl font-bold mb-6">Mentor dành cho bạn</h2>
                <div className="space-y-4">
                  {[
                    { name: 'Dr. Alex Nguyen', role: 'Google Expert', color: 'bg-blue-600' },
                    { name: 'Sarah Tran', role: 'Senior Designer', color: 'bg-purple-600' },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${m.color}`}></div>
                        <div>
                          <div className="font-medium text-sm">{m.name}</div>
                          <div className="text-xs text-gray-500">{m.role}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </div>
                  ))}
                </div>
                <button className="w-full mt-6 py-3 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/5 transition-all">Xem tất cả</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
