import type { Metadata } from "next";
import "./globals.css";
import DRAAD121_CACHEBUST from "@/lib/cache-bust-draad121";
import DRAAD122_CACHEBUST from "@/lib/cache-bust-draad122";

export const metadata: Metadata = {
  title: "RoosterApp - Verloskundigen Praktijk",
  description: "Rooster planning voor verloskundigen praktijk",
};

// DRAAD121: Cache-bust - Forces Railway redeploy
if (DRAAD121_CACHEBUST) {
  console.log('[CACHE-BUST] DRAAD121 loaded at', new Date().toISOString());
}

// DRAAD122: Cache-bust - Forces Railway rebuild after UPSERT fix
if (DRAAD122_CACHEBUST) {
  console.log('[CACHE-BUST] DRAAD122 loaded at', DRAAD122_CACHEBUST.deployed_at);
  console.log('[CACHE-BUST] DRAAD122 fix:', DRAAD122_CACHEBUST.fix);
  console.log('[CACHE-BUST] DRAAD122 impact:', DRAAD122_CACHEBUST.impact);
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
