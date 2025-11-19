'use client';

import { Download } from 'lucide-react';

interface ActionBarProps {
  children?: React.ReactNode;
}

/**
 * Action bar for week dagdelen view
 * Contains team filters and PDF export button
 * Sticky positioned below page header
 */
export default function ActionBar({ children }: ActionBarProps) {
  return (
    <div className="sticky top-[80px] z-10 bg-gray-50 border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Team filter toggles (DRAAD 39.7) */}
          <div className="flex items-center gap-3">
            {children || (
              <span className="text-sm text-gray-500">
                Team filters worden hier geplaatst
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Right side: PDF Export button (DRAAD 39.8) */}
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-md text-sm font-medium cursor-not-allowed transition-colors"
            title="PDF export wordt geïmplementeerd in DRAAD 39.8"
          >
            <Download className="w-4 h-4" />
            <span>PDF Exporteren</span>
          </button>
        </div>
      </div>
    </div>
  );
}
