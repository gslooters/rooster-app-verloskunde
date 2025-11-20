'use client';

import React from 'react';

export function StatusLegenda() {
  return (
    <div className="status-legenda bg-white border-b border-gray-200 py-3 px-4 sticky top-[80px] z-25">
      <div className="flex items-center gap-6 text-sm">
        <div className="legenda-item flex items-center gap-2">
          <span className="status-dot bg-red-500 w-3 h-3 rounded-full inline-block"></span>
          <span className="text-gray-700">MOET - Verplicht (standaard 1)</span>
        </div>
        <div className="legenda-item flex items-center gap-2">
          <span className="status-dot bg-green-500 w-3 h-3 rounded-full inline-block"></span>
          <span className="text-gray-700">MAG - Optioneel (standaard 1)</span>
        </div>
        <div className="legenda-item flex items-center gap-2">
          <span className="status-dot bg-gray-500 w-3 h-3 rounded-full inline-block"></span>
          <span className="text-gray-700">MAG_NIET - Niet toegestaan (standaard 0)</span>
        </div>
        <div className="legenda-item flex items-center gap-2">
          <span className="status-dot bg-blue-500 w-3 h-3 rounded-full inline-block"></span>
          <span className="text-gray-700">AANGEPAST - Handmatig gewijzigd</span>
        </div>
      </div>
    </div>
  );
}