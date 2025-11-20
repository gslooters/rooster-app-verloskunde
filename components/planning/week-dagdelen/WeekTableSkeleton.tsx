'use client';

import React from 'react';

/**
 * DRAAD40B5 FASE 5: Skeleton Loader Component
 * 
 * Toont een loading state tijdens data ophalen of navigatie.
 * 
 * Features:
 * - Animate-pulse voor smooth animatie
 * - Realistische table layout (header + 8 dienst-groepen)
 * - Frozen kolommen simulatie
 * - 21 dagdeel cellen per rij (7 dagen × 3 dagdelen)
 */

export function WeekTableSkeleton() {
  return (
    <div className="week-table-skeleton p-4">
      {/* Header skeleton */}
      <div className="mb-4 space-y-2">
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
      </div>
      
      {/* Table skeleton */}
      <div className="space-y-1">
        {/* 8 dienst-groepen (3 rijen per groep = 24 rijen totaal) */}
        {Array.from({ length: 8 }).map((_, dienstIndex) => (
          <div key={dienstIndex} className="space-y-px">
            {/* 3 team rijen per dienst */}
            {Array.from({ length: 3 }).map((_, teamIndex) => (
              <div key={teamIndex} className="flex gap-2">
                {/* Dienst kolom (alleen in eerste rij van groep) */}
                {teamIndex === 0 && (
                  <div className="w-40 h-16 bg-gray-200 rounded animate-pulse" />
                )}
                {/* Spacer voor andere rijen in groep */}
                {teamIndex !== 0 && (
                  <div className="w-40 h-16 bg-transparent" />
                )}
                
                {/* Team kolom */}
                <div className="w-28 h-16 bg-gray-200 rounded animate-pulse" />
                
                {/* Dagdeel cellen (21 cellen: 7 dagen × 3 dagdelen) */}
                {Array.from({ length: 21 }).map((_, celIndex) => {
                  // Afwisselende kleuren voor visueel effect
                  const bgColor = celIndex % 3 === 0 
                    ? 'bg-gray-100' 
                    : celIndex % 3 === 1 
                    ? 'bg-gray-150' 
                    : 'bg-gray-200';
                  
                  return (
                    <div 
                      key={celIndex} 
                      className={`w-12 h-16 rounded ${bgColor} animate-pulse`}
                      style={{
                        animationDelay: `${(celIndex * 50)}ms`
                      }}
                    />
                  );
                })}
              </div>
            ))}
            
            {/* Border tussen dienst-groepen */}
            {dienstIndex < 7 && (
              <div className="h-px bg-gray-300 my-1" />
            )}
          </div>
        ))}
      </div>
      
      {/* Loading text */}
      <div className="mt-6 text-center">
        <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-blue-700">
            Week data wordt geladen...
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact skeleton voor snelle navigatie
 * (optioneel - kan gebruikt worden voor smoother transitions)
 */
export function WeekTableSkeletonCompact() {
  return (
    <div className="week-table-skeleton-compact p-4">
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="w-40 h-12 bg-gray-200 rounded animate-pulse" />
            <div className="w-28 h-12 bg-gray-200 rounded animate-pulse" />
            <div className="flex-1 h-12 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-center text-sm text-gray-500">
        <div className="inline-flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Laden...
        </div>
      </div>
    </div>
  );
}