'use client';

import { TeamScope, TEAM_SCOPE_CONFIG, getTeamScopeConfig } from '@/lib/types/daytype-staffing';

interface TeamSelectorProps {
  currentScope: TeamScope;
  onChange: (scope: TeamScope) => void;
  disabled?: boolean;
}

export default function TeamSelector({ currentScope, onChange, disabled = false }: TeamSelectorProps) {
  
  const handleToggle = (scope: TeamScope) => {
    if (disabled) return;
    
    // Logic for team scope toggling
    if (scope === 'total') {
      // If clicking 'total', always set to total (exclusive)
      onChange('total');
    } else if (scope === 'groen') {
      if (currentScope === 'total') {
        // From total to groen
        onChange('groen');
      } else if (currentScope === 'groen') {
        // Toggle off groen - go back to total
        onChange('total');
      } else if (currentScope === 'oranje') {
        // From oranje to both
        onChange('both');
      } else if (currentScope === 'both') {
        // From both to just oranje
        onChange('oranje');
      }
    } else if (scope === 'oranje') {
      if (currentScope === 'total') {
        // From total to oranje
        onChange('oranje');
      } else if (currentScope === 'oranje') {
        // Toggle off oranje - go back to total
        onChange('total');
      } else if (currentScope === 'groen') {
        // From groen to both
        onChange('both');
      } else if (currentScope === 'both') {
        // From both to just groen
        onChange('groen');
      }
    }
  };
  
  const isActive = (scope: TeamScope): boolean => {
    if (scope === 'total') return currentScope === 'total';
    if (scope === 'groen') return currentScope === 'groen' || currentScope === 'both';
    if (scope === 'oranje') return currentScope === 'oranje' || currentScope === 'both';
    return false;
  };
  
  const getButtonClass = (scope: TeamScope): string => {
    const config = getTeamScopeConfig(scope);
    const active = isActive(scope);
    const baseClass = "px-2 py-1 text-xs font-medium rounded transition-all duration-200 border";
    
    if (disabled) {
      return `${baseClass} bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed`;
    }
    
    if (active) {
      // Active states with team colors
      switch (config.color) {
        case 'blue':
          return `${baseClass} bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200`;
        case 'green':
          return `${baseClass} bg-green-100 text-green-800 border-green-300 hover:bg-green-200`;
        case 'orange':
          return `${baseClass} bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200`;
        default:
          return `${baseClass} bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200`;
      }
    } else {
      // Inactive state
      return `${baseClass} bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:border-gray-400`;
    }
  };
  
  return (
    <div className="flex gap-1" title={`Team scope: ${TEAM_SCOPE_CONFIG[currentScope].description}`}>
      <button
        onClick={() => handleToggle('total')}
        className={getButtonClass('total')}
        disabled={disabled}
        title="Totale praktijk - alle medewerkers"
      >
        {TEAM_SCOPE_CONFIG.total.label}
      </button>
      <button
        onClick={() => handleToggle('groen')}
        className={getButtonClass('groen')}
        disabled={disabled}
        title="Team Groen medewerkers"
      >
        {TEAM_SCOPE_CONFIG.groen.label}
      </button>
      <button
        onClick={() => handleToggle('oranje')}
        className={getButtonClass('oranje')}
        disabled={disabled}
        title="Team Oranje medewerkers"
      >
        {TEAM_SCOPE_CONFIG.oranje.label}
      </button>
    </div>
  );
}