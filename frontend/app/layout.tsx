import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { AuthProvider } from "@/src/contexts/AuthContext";
import ClientProviders from "@/src/components/ClientProviders";
import AppLayout from "@/components/AppLayout";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// themeColor + viewport được thu thập tại đây (không còn trong `metadata` export).
// Nguồn: https://nextjs.org/docs/app/api-reference/functions/generate-viewport
export const viewport: Viewport = {
  themeColor: "#E07A5F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "EduMap - Bản đồ Giáo dục Thông minh Biên Hòa",
  description: "Khám phá không gian học tập, cơ hội thực tập, học bổng và cộng đồng giáo dục tại Biên Hòa, Đồng Nai.",
  manifest: "/manifest.json",
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
    <html lang="vi">
      <body className={`${inter.variable} font-sans flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/20 antialiased`}>
        <LanguageProvider>
          <AuthProvider>
            <Toaster richColors position="top-right" closeButton />
            {/* ClientProviders boots the socket.io realtime client (notifications)
                so it is connected for the lifetime of the app shell. */}
            <ClientProviders>
              <AppLayout>{children}</AppLayout>
            </ClientProviders>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
