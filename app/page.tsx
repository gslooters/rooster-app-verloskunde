'use client';

import React, { useState, useEffect } from "react";
import Image from "next/image";

export default function HomePage() {
  // 🔥 FIX: Client-only date rendering (prevent hydration mismatch)
  const [buildInfo, setBuildInfo] = useState('laden...');
  
  useEffect(() => {
    // Safe: Dit draait alleen client-side
    const now = new Date();
    const datum = now.toLocaleDateString('nl-NL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    const tijd = now.toLocaleTimeString('nl-NL', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    setBuildInfo(`build ${datum} ${tijd}`);
  }, []);
  
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f4f7f6 0%, #e4e9ed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="flex flex-col items-center justify-center gap-6 p-8 rounded-2xl shadow-xl bg-white/70 border-2 border-blue-100 w-full max-w-xl mx-auto">
        <div className="flex items-center gap-2">
          <Image src="/verloskunde_icon.svg" alt="Logo" width={80} height={80} className="w-14 md:w-20" style={{filter:"drop-shadow(0 1px 6px #c9e5fa)"}}/>
          <span className="text-2xl md:text-4xl font-semibold text-blue-800 tracking-tight ml-2 drop-shadow">Rooster App Verloskundigen Arnhem</span>
        </div>
        <p className="text-lg mt-2 text-gray-700 italic" suppressHydrationWarning>
          in ontwikkeling: {buildInfo}
        </p>
        <div className="my-6">
          <svg width="160" height="75" viewBox="0 0 160 75" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="80" cy="52" rx="66" ry="18" fill="#D1EAFA"/>
            <ellipse cx="48" cy="31" rx="18" ry="12" fill="#FCEAF2"/>
            <ellipse cx="112" cy="22" rx="27" ry="14" fill="#D6F8F8"/>
            <ellipse cx="88" cy="46" rx="36" ry="10" fill="#E8EFFE"/>
            <ellipse cx="120" cy="66" rx="20" ry="6" fill="#FCEAF2"/>
          </svg>
        </div>
        <a href="/dashboard" className="px-8 py-3 bg-blue-600 text-white font-semibold rounded shadow hover:bg-blue-700 text-lg transition">→ Dashboard</a>
      </div>
    </div>
  );
}
