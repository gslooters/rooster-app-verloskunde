'use client';

import React from 'react';

interface StatusBadgeProps {
  count: number;
  isExplicitlyAssigned?: boolean;
}

/**
 * StatusBadge Component
 * 
 * Toont bezettingsstatus met kleurcodering:
 * - 🟢 Voldoende: 2+ medewerkers
 * - 🟡 Onderbezet: 1 medewerker
 * - 🔴 Kritiek: 0 medewerkers
 * - 🔵 Toegewezen: Expliciet toegewezen status
 */
export function StatusBadge({ count, isExplicitlyAssigned = false }: StatusBadgeProps) {
  // Bepaal status op basis van count
  let statusClass = '';
  let statusText = '';
  let statusIcon = '';

  if (isExplicitlyAssigned) {
    statusClass = 'bg-blue-100 text-blue-800 border-blue-300';
    statusText = 'Toegewezen';
    statusIcon = '🔵';
  } else if (count === 0) {
    statusClass = 'bg-red-100 text-red-800 border-red-300';
    statusText = 'Kritiek';
    statusIcon = '🔴';
  } else if (count === 1) {
    statusClass = 'bg-yellow-100 text-yellow-800 border-yellow-300';
    statusText = 'Onderbezet';
    statusIcon = '🟡';
  } else {
    statusClass = 'bg-green-100 text-green-800 border-green-300';
    statusText = 'Voldoende';
    statusIcon = '🟢';
  }

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${statusClass}`}>
      <span className="mr-1">{statusIcon}</span>
      <span>{statusText} ({count})</span>
    </div>
  );
}
