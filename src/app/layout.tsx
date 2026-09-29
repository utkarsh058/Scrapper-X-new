import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LeadPilot — Find businesses that need a better website",
  description:
    "Discover businesses, uncover website opportunities, personalize outreach, and turn prospects into clients — all from one intelligent workspace.",
  keywords: [
    "lead generation",
    "B2B lead intelligence",
    "website audit",
    "cold outreach",
    "automated website demo",
    "agency tools",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className={`${inter.className} min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-teal-50 selection:text-teal-900`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
