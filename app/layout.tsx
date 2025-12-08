import type { Metadata } from "next";
import "./globals.css";
import DRAAD121_CACHEBUST from "@/lib/cache-bust-draad121";
import DRAAD122_CACHEBUST from "@/lib/cache-bust-draad122";
import DRAAD130_CACHEBUST from "@/lib/cache-bust-draad130";

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

// DRAAD130: Cache-bust - Status 1 Blocked Slots Fix
if (DRAAD130_CACHEBUST) {
  console.log('[CACHE-BUST] DRAAD130 loaded at', DRAAD130_CACHEBUST.DRAAD130_DEPLOYED);
  console.log('[CACHE-BUST] DRAAD130 timestamp:', DRAAD130_CACHEBUST.DRAAD130_TIMESTAMP);
  console.log('[CACHE-BUST] DRAAD130 random:', DRAAD130_CACHEBUST.DRAAD130_RANDOM);
  console.log('[CACHE-BUST] DRAAD130 fix:', DRAAD130_CACHEBUST.fix);
  console.log('[CACHE-BUST] DRAAD130 impact:', DRAAD130_CACHEBUST.impact);
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
