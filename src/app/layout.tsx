import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sueño Binaural",
  description: "Optimiza tu descanso con sonidos binaurales diseñados por expertos.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sueño Binaural",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0E1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className={`${inter.className} min-h-full bg-[#0A0E1A] text-white`}>
        <div className="flex flex-col min-h-screen">
          <main className="flex-1 pb-16">
            {children}
          </main>
          <Navbar />
        </div>
      </body>
    </html>
  );
}
