// RosterRuleCard: Individuele regel kaart met visual distinction
// DRAAD95D: Rooster-specifieke Planregels UI Implementatie
'use client';

import { RosterPlanningConstraint } from '@/lib/types/planning-constraint';
import { TYPE_LABELS, PRIORITY_COLORS } from '@/lib/types/planning-constraint';
import { useState } from 'react';

interface RosterRuleCardProps {
  rule: RosterPlanningConstraint;
  onEdit: () => void;
  onReset: () => void;
  onDelete: () => void;
  isFixed?: boolean; // Van base constraint (indien gekoppeld)
}

export default function RosterRuleCard({
  rule,
  onEdit,
  onReset,
  onDelete,
  isFixed = false
}: RosterRuleCardProps) {
  const [showFullParams, setShowFullParams] = useState(false);
  
  // Visual state bepaling
  const isOverride = rule.isoverride;
  const isAdHoc = !rule.baseconstraintid;
  
  // Border en badge kleuren
  let borderColor = 'border-green-300'; // Standaard
  let bgColor = 'bg-green-50';
  let badgeColor = 'bg-green-100 text-green-800';
  let badgeText = 'Standaard';
  
  if (isAdHoc) {
    borderColor = 'border-purple-300';
    bgColor = 'bg-purple-50';
    badgeColor = 'bg-purple-100 text-purple-800';
    badgeText = 'Periode-specifiek';
  } else if (isOverride) {
    borderColor = 'border-orange-300';
    bgColor = 'bg-orange-50';
    badgeColor = 'bg-orange-100 text-orange-800';
    badgeText = 'Aangepast';
  }
  
  // Priority indicator
  const priorityColor = PRIORITY_COLORS[rule.priority];
  const priorityLabels = {
    1: 'Kritiek',
    2: 'Hoog',
    3: 'Normaal',
    4: 'Laag'
  };
  
  // Parameters display
  const paramsString = JSON.stringify(rule.parameters, null, 2);
  const paramsLines = paramsString.split('\n');
  const shouldTruncate = paramsLines.length > 4;
  const displayParams = shouldTruncate && !showFullParams
    ? paramsLines.slice(0, 3).join('\n') + '\n  ...'
    : paramsString;
  
  return (
    <div className={`border-2 ${borderColor} ${bgColor} rounded-lg p-4 transition-all hover:shadow-md`}>
      {/* Header met naam en badges */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-gray-900">{rule.naam}</h4>
            {isFixed && (
              <span className="text-gray-400" title="Vaste regel kan niet worden aangepast">
                🔒
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${badgeColor}`}>
              {badgeText}
            </span>
            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
              {TYPE_LABELS[rule.type]}
            </span>
            {rule.team && (
              <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                Team: {rule.team}
              </span>
            )}
          </div>
        </div>
        
        {/* Priority indicator */}
        <div
          className="ml-3 px-2 py-1 rounded text-xs font-bold text-white"
          style={{ backgroundColor: priorityColor }}
          title={`Prioriteit: ${priorityLabels[rule.priority]}`}
        >
          P{rule.priority}
        </div>
      </div>
      
      {/* Beschrijving */}
      {rule.beschrijving && (
        <p className="text-sm text-gray-600 mb-3">{rule.beschrijving}</p>
      )}
      
      {/* Parameters */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500">Parameters:</span>
          {shouldTruncate && (
            <button
              onClick={() => setShowFullParams(!showFullParams)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              {showFullParams ? 'Minder tonen' : 'Volledig tonen'}
            </button>
          )}
        </div>
        <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-x-auto">
          {displayParams}
        </pre>
      </div>
      
      {/* Status indicators */}
      <div className="flex items-center gap-4 mb-3 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-gray-600">Actief:</span>
          {rule.actief ? (
            <span className="text-green-600 font-semibold">✓ Ja</span>
          ) : (
            <span className="text-gray-400">✗ Nee</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-600">Kan relaxen:</span>
          {rule.canrelax ? (
            <span className="text-blue-600 font-semibold">✓ Ja</span>
          ) : (
            <span className="text-gray-400">✗ Nee</span>
          )}
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2 pt-3 border-t border-gray-200">
        {!isFixed && !isAdHoc && (
          <button
            onClick={onEdit}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              isOverride
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isOverride ? '✏️ Bewerken' : '✏️ Aanpassen'}
          </button>
        )}
        
        {!isFixed && isAdHoc && (
          <button
            onClick={onEdit}
            className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            ✏️ Bewerken
          </button>
        )}
        
        {isOverride && !isFixed && (
          <button
            onClick={onReset}
            className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            ↶ Terugzetten
          </button>
        )}
        
        {isAdHoc && (
          <button
            onClick={onDelete}
            className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors"
          >
            🗑️ Verwijderen
          </button>
        )}
        
        {isFixed && (
          <span className="text-xs text-gray-500 italic">
            Vaste regel - geen bewerkingen mogelijk
          </span>
        )}
      </div>
    </div>
  );
}
