import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoosterApp - Verloskundigen Praktijk",
  description: "Rooster planning voor verloskundigen praktijk",
};

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

