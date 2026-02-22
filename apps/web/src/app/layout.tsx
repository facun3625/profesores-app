// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import { Roboto, Geist_Mono, Montserrat_Alternates } from "next/font/google";
import "./globals.css";
import ClientLayout from "./layout.client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ReactQueryProvider } from "@/components/ReactQueryProvider";
import { Toaster } from "sonner";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserratAlternates = Montserrat_Alternates({
  weight: ["400", "500", "600"],
  variable: "--font-logo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "profly | Exámenes Inteligentes",
  description: "Sistema de gestión y generación de exámenes",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${roboto.variable} ${geistMono.variable} ${montserratAlternates.variable} font-sans antialiased`}>
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