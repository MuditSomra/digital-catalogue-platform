import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PwaProvider } from "@/components/pwa/PwaContext";
import { IosInstallPrompt } from "@/components/pwa/IosInstallPrompt";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Somra - Kitchen Appliance Digital Showroom & Management",
    template: "%s | Somra",
  },
  description:
    "Somra Kitchen Appliance Digital Showroom, Inventory & Retail Management. Explore premium appliances, demonstrations, and real-time inventory.",
  applicationName: "Somra",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Somra",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans min-h-screen flex flex-col bg-background text-foreground`}>
        <PwaProvider>
          {children}
          <IosInstallPrompt />
        </PwaProvider>
      </body>
    </html>
  );
}

