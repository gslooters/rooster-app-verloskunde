import type { Metadata } from "next";
import "./globals.css";
import DRAAD121_CACHEBUST from "@/lib/cache-bust-draad121";

export const metadata: Metadata = {
  title: "RoosterApp - Verloskundigen Praktijk",
  description: "Rooster planning voor verloskundigen praktijk",
};

// DRAAD121: Cache-bust - Forces Railway redeploy
if (DRAAD121_CACHEBUST) {
  console.log('[CACHE-BUST] DRAAD121 loaded at', new Date().toISOString());
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>
        {children}
      </body>
    </html>
  );
}
