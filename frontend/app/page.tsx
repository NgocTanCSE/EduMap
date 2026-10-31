import type { Metadata } from 'next';
import HomeGate from '@/components/landing/HomeGate';

export const metadata: Metadata = {
  title: 'EduMap — Khám phá tri thức. Định hướng tương lai.',
  description:
    'EduMap kết nối bản đồ giáo dục, khám phá nghề nghiệp và trí tuệ nhân tạo, giúp bạn tiếp cận thông tin và tìm ra hướng đi phù hợp trên cùng một nền tảng.',
  keywords: [
    'EduMap',
    'bản đồ giáo dục',
    'Biên Hòa',
    'Đồng Nai',
    'hướng nghiệp',
    'trợ lý AI',
    'học bổng',
    'việc làm',
  ],
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: 'https://edumap.vn',
    siteName: 'EduMap',
    title: 'EduMap — Khám phá tri thức. Định hướng tương lai.',
    description:
      'Bản đồ giáo dục, khám phá nghề nghiệp và trợ lý AI trong cùng một nền tảng dành cho học sinh, sinh viên và nhà giáo dục.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EduMap — Khám phá tri thức. Định hướng tương lai.',
    description:
      'Bản đồ giáo dục, khám phá nghề nghiệp và trợ lý AI trong cùng một nền tảng.',
  },
  alternates: {
    canonical: 'https://edumap.vn',
  },
};

export default function HomePage() {
  return <HomeGate />;
}
