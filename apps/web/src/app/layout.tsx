// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "./layout.client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ReactQueryProvider } from "@/components/ReactQueryProvider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "profly",
  description: "Sistema de gestión y generación de exámenes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ErrorBoundary>
          <ReactQueryProvider>
            <ClientLayout>{children}</ClientLayout>
            <Toaster position="top-right" richColors />
          </ReactQueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}