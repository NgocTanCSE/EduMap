import os

def fix_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.strip())

page_content = """
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Map as MapIcon, 
  MessageSquare, 
  Library, 
  Target, 
  ShieldCheck, 
  Zap, 
  Users, 
  Award, 
  Globe 
} from 'lucide-react';

export default function Home() {
  return (
    <main className='min-h-screen bg-background text-foreground flex flex-col items-center py-20 px-4'>
      {/* Hero Section */}
      <div className='text-center max-w-3xl space-y-6'>
        <div className='inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-500 text-sm font-semibold mb-4'>
          🌍 EduMap Platform 2.0
        </div>
        <h1 className='text-5xl md:text-7xl font-extrabold tracking-tight'>
          Bản đồ Giáo dục <span className='text-blue-500'>Thông minh</span>
        </h1>
        <p className='text-xl opacity-70'>
          Khám phá không gian học tập, kết nối Mentor và chinh phục các cơ hội mới.
        </p>
        <div className='flex gap-4 justify-center pt-8'>
          <a href='/map'><Button size='lg' className='bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8'>Mở Bản đồ</Button></a>
          <a href='/ai-chat'><Button size='lg' variant='outline' className='rounded-full px-8'>Hỏi AI Chatbot</Button></a>
        </div>
      </div>

      {/* Stats Section */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-8 mt-24 w-full max-w-5xl'>
        <div className='text-center'>
          <div className='text-4xl font-bold text-blue-500'>500+</div>
          <div className='text-sm opacity-60'>Điểm Giáo dục</div>
        </div>
        <div className='text-center'>
          <div className='text-4xl font-bold text-blue-500'>10k+</div>
          <div className='text-sm opacity-60'>Học liệu Free</div>
        </div>
        <div className='text-center'>
          <div className='text-4xl font-bold text-blue-500'>200+</div>
          <div className='text-sm opacity-60'>Mentors</div>
        </div>
        <div className='text-center'>
          <div className='text-4xl font-bold text-blue-500'>1M+</div>
          <div className='text-sm opacity-60'>Points Awarded</div>
        </div>
      </div>

      {/* Features Grid */}
      <div className='grid md:grid-cols-3 gap-6 mt-32 w-full max-w-6xl'>
        <Card className='bg-card/50 backdrop-blur-sm border-white/10'>
          <CardHeader>
            <MapIcon className='w-10 h-10 text-blue-500 mb-2' />
            <CardTitle>Bản đồ Tương tác</CardTitle>
          </CardHeader>
          <CardContent className='opacity-70'>
            Tìm kiếm trường học, thư viện, và các không gian học tập quanh bạn một cách dễ dàng.
          </CardContent>
        </Card>
        
        <Card className='bg-card/50 backdrop-blur-sm border-white/10'>
          <CardHeader>
            <MessageSquare className='w-10 h-10 text-blue-500 mb-2' />
            <CardTitle>AI Assistant</CardTitle>
          </CardHeader>
          <CardContent className='opacity-70'>
            Trợ lý ảo hỗ trợ 24/7 giúp giải đáp thắc mắc và định hướng lộ trình học tập.
          </CardContent>
        </Card>

        <Card className='bg-card/50 backdrop-blur-sm border-white/10'>
          <CardHeader>
            <Library className='w-10 h-10 text-blue-500 mb-2' />
            <CardTitle>Thư viện Số</CardTitle>
          </CardHeader>
          <CardContent className='opacity-70'>
            Kho tài liệu khổng lồ với sách điện tử, video bài giảng và podcast chất lượng.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
"""

fix_file('frontend/app/page.tsx', page_content)
print("Successfully fixed frontend/app/page.tsx")
