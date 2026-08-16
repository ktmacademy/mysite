import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// Next 14's next/font/google has no Geist (added in Next 15), so Inter backs
// the --font-sans token the shadcn components expect.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "CTEVT+ Admin Panel",
  description: "Admin panel for CTEVT+ mobile app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
