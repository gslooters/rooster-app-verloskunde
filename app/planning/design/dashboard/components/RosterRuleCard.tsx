// RosterRuleCard: Vereenvoudigde regel kaart met toggle switch
// DRAAD95F: Vereenvoudigde Planregels UI - Toggle-Only Interface
'use client';

import { RosterPlanningConstraint } from '@/lib/types/planning-constraint';
import { TYPE_LABELS, PRIORITY_COLORS } from '@/lib/types/planning-constraint';
import { useState } from 'react';
import ToggleSwitch from './ToggleSwitch';

interface RosterRuleCardProps {
  rule: RosterPlanningConstraint;
  isFixed: boolean;
  onToggle: (ruleId: string, currentActive: boolean) => void;
}

export default function RosterRuleCard({
  rule,
  isFixed,
  onToggle
}: RosterRuleCardProps) {
  const [showFullParams, setShowFullParams] = useState(false);
  
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
  const shouldTruncate = paramsLines.length > 6;
  const displayParams = shouldTruncate && !showFullParams
    ? paramsLines.slice(0, 5).join('\n') + '\n  ...'
    : paramsString;
  
  return (
    <div className="border border-gray-200 bg-white rounded-lg p-4 transition-all hover:shadow-md">
      {/* Header met naam en toggle/lock */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-3">
          <h4 className="font-bold text-gray-900 mb-2 truncate" title={rule.naam}>
            {rule.naam}
          </h4>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority badge */}
            <span
              className="inline-block px-2 py-1 rounded text-xs font-bold text-white"
              style={{ backgroundColor: priorityColor }}
              title={`Prioriteit: ${priorityLabels[rule.priority]}`}
            >
              P{rule.priority} · {priorityLabels[rule.priority]}
            </span>
            
            {/* Type badge */}
            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
              {TYPE_LABELS[rule.type]}
            </span>
            
            {/* Team badge */}
            {rule.team && (
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                rule.team === 'groen' ? 'bg-green-100 text-green-700' :
                rule.team === 'oranje' ? 'bg-orange-100 text-orange-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                Team: {rule.team.charAt(0).toUpperCase() + rule.team.slice(1)}
              </span>
            )}
          </div>
        </div>
        
        {/* Toggle of Lock icon */}
        <div className="flex-shrink-0">
          {isFixed ? (
            <div 
              className="text-2xl text-gray-400 cursor-help" 
              title="Deze regel kan niet worden uitgeschakeld"
            >
              🔒
            </div>
          ) : (
            <ToggleSwitch 
              checked={rule.actief}
              onChange={() => onToggle(rule.id, rule.actief)}
            />
          )}
        </div>
      </div>
      
      {/* Beschrijving */}
      {rule.beschrijving && (
        <p className="text-sm text-gray-600 mb-3 leading-relaxed">
          {rule.beschrijving}
        </p>
      )}
      
      {/* Parameters - altijd zichtbaar, read-only */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500">Parameters:</span>
          {shouldTruncate && (
            <button
              onClick={() => setShowFullParams(!showFullParams)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              {showFullParams ? '▲ Minder' : '▼ Volledig'}
            </button>
          )}
        </div>
        <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto font-mono">
          {displayParams}
        </pre>
      </div>
    </div>
  );
}
