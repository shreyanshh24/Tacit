import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SourcesProvider } from "@/components/SourcesProvider";
import { SessionProvider } from "@/components/SessionProvider";
import LoginGate from "@/components/LoginGate";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tacit — A company that never forgets",
  description: "AI-powered organizational memory for NimbusPay.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SessionProvider>
          <SourcesProvider>
            <LoginGate>{children}</LoginGate>
          </SourcesProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
