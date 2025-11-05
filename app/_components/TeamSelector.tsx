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
    
    // Simplified logic for team scope toggling
    if (scope === 'total') {
      // If clicking 'total', always set to total (exclusive with teams)
      onChange('total');
    } else if (scope === 'groen') {
      if (currentScope === 'total' || currentScope === 'oranje') {
        // From total or oranje to groen only
        onChange('groen');
      } else if (currentScope === 'groen') {
        // Toggle off groen - go back to total
        onChange('total');
      } else if (currentScope === 'both') {
        // From both to just oranje
        onChange('oranje');
      }
    } else if (scope === 'oranje') {
      if (currentScope === 'total' || currentScope === 'groen') {
        // From total to oranje, or from groen to both
        onChange(currentScope === 'groen' ? 'both' : 'oranje');
      } else if (currentScope === 'oranje') {
        // Toggle off oranje - go back to total
        onChange('total');
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
    const baseClass = "px-2 py-1 text-xs font-semibold rounded transition-all duration-200 border cursor-pointer select-none";
    
    if (disabled) {
      return `${baseClass} bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed`;
    }
    
    if (active) {
      // Active states with team colors
      switch (config.color) {
        case 'blue':
          return `${baseClass} bg-blue-500 text-white border-blue-600 hover:bg-blue-600 shadow-sm`;
        case 'green':
          return `${baseClass} bg-green-500 text-white border-green-600 hover:bg-green-600 shadow-sm`;
        case 'orange':
          return `${baseClass} bg-orange-500 text-white border-orange-600 hover:bg-orange-600 shadow-sm`;
        default:
          return `${baseClass} bg-gray-500 text-white border-gray-600 hover:bg-gray-600 shadow-sm`;
      }
    } else {
      // Inactive state - subtle colors
      switch (config.color) {
        case 'blue':
          return `${baseClass} bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300`;
        case 'green':
          return `${baseClass} bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:border-green-300`;
        case 'orange':
          return `${baseClass} bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 hover:border-orange-300`;
        default:
          return `${baseClass} bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300`;
      }
    }
  };
  
  const getTooltipText = (scope: TeamScope): string => {
    const config = getTeamScopeConfig(scope);
    const active = isActive(scope);
    
    if (scope === 'total') {
      return active ? 'Actief voor alle medewerkers' : 'Klik om alle medewerkers in te schakelen';
    } else {
      return active ? `Actief voor ${config.description}` : `Klik om ${config.description} in te schakelen`;
    }
  };
  
  // Visual indicator for current state
  const getStateDescription = (): string => {
    switch (currentScope) {
      case 'total': return 'Alle medewerkers';
      case 'groen': return 'Alleen Team Groen';
      case 'oranje': return 'Alleen Team Oranje';
      case 'both': return 'Team Groen + Oranje';
      default: return 'Onbekend';
    }
  };
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1" title={`Actieve scope: ${getStateDescription()}`}>
        <button
          onClick={() => handleToggle('total')}
          className={getButtonClass('total')}
          disabled={disabled}
          title={getTooltipText('total')}
        >
          {TEAM_SCOPE_CONFIG.total.label}
        </button>
        <button
          onClick={() => handleToggle('groen')}
          className={getButtonClass('groen')}
          disabled={disabled}
          title={getTooltipText('groen')}
        >
          {TEAM_SCOPE_CONFIG.groen.label}
        </button>
        <button
          onClick={() => handleToggle('oranje')}
          className={getButtonClass('oranje')}
          disabled={disabled}
          title={getTooltipText('oranje')}
        >
          {TEAM_SCOPE_CONFIG.oranje.label}
        </button>
      </div>
      
      {/* Optional: Visual state indicator */}
      <div className="text-xs text-gray-500 text-center leading-tight" style={{ fontSize: '10px' }}>
        {currentScope === 'both' ? 'Beide' : 
         currentScope === 'total' ? 'Alle' :
         currentScope === 'groen' ? 'Groen' : 'Oranje'}
      </div>
    </div>
  );
}