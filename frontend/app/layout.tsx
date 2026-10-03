import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import { Toaster } from 'sonner';
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { AuthProvider } from "@/src/contexts/AuthContext";
import TopBar from "@/components/TopBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

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
      <body className={`${inter.variable} font-sans flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/20 antialiased`}>
        <LanguageProvider>
          <AuthProvider>
            <Toaster richColors position="top-right" closeButton />
            <TopBar />
            <div className="flex-grow">
            {children}
            </div>
            <Footer />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
