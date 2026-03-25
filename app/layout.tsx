import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./fetch-config";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RAM - Sistema de Gestión de Corte y Stock | Velvok",
  description: "Sistema industrial de gestión de corte y stock para operaciones metalúrgicas",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RM Velvok",
  },
  other: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
};

export const viewport = {
  themeColor: "#1e40af",
};

// Deshabilitar caché en todas las páginas
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className} suppressHydrationWarning={true}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
