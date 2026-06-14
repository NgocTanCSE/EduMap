import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Toaster } from 'sonner';
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

export const metadata: Metadata = {
  title: "EduMap - Bản đồ Giáo dục Thông minh Biên Hòa",
  description: "Khám phá không gian học tập, cơ hội thực tập, học bổng và cộng đồng giáo dục tại Biên Hòa, Đồng Nai.",
  manifest: "/manifest.json",
  themeColor: "#eab308",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  keywords: ["EduMap", "Biên Hòa", "Đồng Nai", "Bản đồ giáo dục", "Học bổng", "Thực tập", "STEM", "Wifi miễn phí"],
  authors: [{ name: "EduMap Team" }],
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "https://edumap.vn",
    title: "EduMap - Bản đồ Giáo dục Thông minh",
    description: "Kết nối tri thức, kiến tạo tương lai tại Biên Hòa",
    siteName: "EduMap",
    images: [{
      url: "/og-image.png",
      width: 1200,
      height: 630,
      alt: "EduMap Biên Hòa"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: "EduMap - Bản đồ Giáo dục Thông minh",
    description: "Khám phá không gian học tập tại Biên Hòa",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="flex flex-col min-h-screen bg-background text-foreground selection:bg-yellow-500/20 antialiased">
        <LanguageProvider>
            <Toaster richColors position="top-right" closeButton />
            <Header />
            <div className="flex-grow">
            {children}
            </div>
            <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
