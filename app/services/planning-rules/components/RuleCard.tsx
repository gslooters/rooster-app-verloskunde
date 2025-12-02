'use client';
import { useState } from 'react';
import { PlanningConstraint, PRIORITY_COLORS, TYPE_LABELS } from '@/lib/types/planning-constraint';
import { Lock, LockOpen, AlertCircle } from 'lucide-react';

interface RuleCardProps {
  constraint: PlanningConstraint;
  onToggle: (id: string, newValue: boolean) => Promise<void>;
}

export function RuleCard({ constraint, onToggle }: RuleCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [actief, setActief] = useState(constraint.actief);

  const handleToggle = async () => {
    // DRAAD96A: Fixed isfixed -> is_fixed
    if (constraint.is_fixed) return; // Vaste regels niet wijzigen
    
    setIsToggling(true);
    try {
      await onToggle(constraint.id, !actief);
      setActief(!actief);
    } catch (error) {
      console.error('Toggle failed:', error);
    } finally {
      setIsToggling(false);
    }
  };

  // Kleur bepalen op basis van priority
  const priorityColor = PRIORITY_COLORS[constraint.priority];
  const priorityLabel = [
    '',
    '🔴 Kritiek',
    '🟠 Hoog',
    '🟡 Normaal',
    '🔵 Laag'
  ][constraint.priority];

  return (
    <div
      className={`
        rounded-xl p-6 border-2 transition-all duration-300
        ${
          // DRAAD96A: Fixed isfixed -> is_fixed
          constraint.is_fixed
            ? 'bg-gray-50 border-gray-300'
            : actief
            ? 'bg-white border-purple-300 shadow-md'
            : 'bg-gray-50 border-gray-200 opacity-70'
        }
      `}
    >
      {/* Header met naam en status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {/* DRAAD96A: Fixed isfixed -> is_fixed and canrelax -> can_relax */}
            {constraint.is_fixed && (
              <Lock className="w-4 h-4 text-gray-600" />
            )}
            {!constraint.is_fixed && constraint.can_relax && (
              <LockOpen className="w-4 h-4 text-blue-600" />
            )}
            <h3 className="font-bold text-lg text-gray-900">
              {constraint.naam}
            </h3>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span
              className="px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: `${priorityColor}20`,
                color: priorityColor
              }}
            >
              {priorityLabel}
            </span>
            <span className="text-gray-600">
              {TYPE_LABELS[constraint.type] || constraint.type}
            </span>
            {constraint.team && (
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                Team {constraint.team}
              </span>
            )}
          </div>
        </div>

        {/* Toggle switch */}
        <div className="flex flex-col items-end gap-2">
          {/* DRAAD96A: Fixed isfixed -> is_fixed */}
          {constraint.is_fixed ? (
            <div className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium">
              Vast
            </div>
          ) : (
            <button
              onClick={handleToggle}
              disabled={isToggling}
              className={`
                relative inline-flex h-7 w-14 items-center rounded-full transition-colors
                ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${actief ? 'bg-green-500' : 'bg-gray-300'}
              `}
            >
              <span
                className={`
                  inline-block h-5 w-5 transform rounded-full bg-white transition-transform
                  ${actief ? 'translate-x-8' : 'translate-x-1'}
                `}
              />
            </button>
          )}
          <span className="text-xs text-gray-500">
            {/* DRAAD96A: Fixed isfixed -> is_fixed */}
            {constraint.is_fixed ? 'Niet aanpasbaar' : actief ? 'Actief' : 'Uit'}
          </span>
        </div>
      </div>

      {/* Beschrijving */}
      {constraint.beschrijving && (
        <p className="text-sm text-gray-700 mb-3 leading-relaxed">
          {constraint.beschrijving}
        </p>
      )}

      {/* Parameters preview */}
      {Object.keys(constraint.parameters).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2 font-medium">Parameters:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(constraint.parameters).slice(0, 4).map(([key, value]) => (
              <span
                key={key}
                className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-mono"
              >
                {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            ))}
            {Object.keys(constraint.parameters).length > 4 && (
              <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-500 text-xs">
                +{Object.keys(constraint.parameters).length - 4} meer
              </span>
            )}
          </div>
        </div>
      )}

      {/* Waarschuwing voor vaste regels */}
      {/* DRAAD96A: Fixed isfixed -> is_fixed */}
      {constraint.is_fixed && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-start gap-2 text-xs text-gray-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Deze regel is vast en kan niet worden uitgeschakeld. Dit garandeert correcte roosterplanning.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
