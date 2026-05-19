import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "EduMap - Bản đồ Giáo dục Thông minh",
  description: "Khám phá không gian học tập, cơ hội và cộng đồng",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="flex flex-col min-h-screen bg-background text-foreground selection:bg-blue-500/20 antialiased">
        <Header />
        <div className="flex-grow">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}

