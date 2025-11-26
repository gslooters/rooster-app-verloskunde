'use client';
import React from 'react';
import { DienstDagdelenWeek, TeamDagdeel, TEAM_ORDER, DagdeelStatus } from '@/lib/types/week-dagdelen';
import DagdeelCell from './DagdeelCell';

interface WeekTableBodyProps {
  rosterId: string; // 🔥 DRAAD44: NIEUW - Nodig voor cel-level data lookup
  diensten: DienstDagdelenWeek[];
  onDagdeelUpdate?: (dagdeelId: string, nieuweStatus: DagdeelStatus, nieuwAantal: number) => Promise<void>;
  disabled?: boolean;
}

/**
 * DRAAD44: Frontend Cellogica Fix
 * DRAAD40B5: Verbeterde Layout voor Diensten per Dagdeel
 * DRAAD40C: BoxShadow op frozen columns voor visuele consistency
 * 
 * DRAAD44 WIJZIGINGEN:
 * - Toegevoegd rosterId prop (doorgeven aan DagdeelCell voor DB lookup)
 * - Toegevoegd dagdeelType mapping ('O'/'M'/'A' voor ochtend/middag/avond)
 * - Correcte dienstId doorgeven aan elke cel
 * 
 * Wijzigingen:
 * - CODE + NAAM in één kolom ("Dienst"), alleen getoond bij eerste team (Groen)
 * - Team in aparte kolom met badge
 * - Compactere styling voor 100% zoom zichtbaarheid  
 * - Sortering op dienstcode (alfabetisch)
 * - Teamrijen gefilterd: skip rendering als team.dagen leeg is
 * - Dienst wordt altijd getoond (ook als alle teams gefilterd zijn)
 * - BoxShadow op sticky columns voor visuele scheiding
 * 
 * Layout per dienst:
 * - Dienst kolom: Code + Naam (rowspan=aantal zichtbare teams)
 * - Team kolom: Groen / Oranje / Praktijk badge
 * - 21 dagdeel cellen (7 dagen × 3 dagdelen)
 */

// Team label mapping: database gebruikt TOT, UI toont Praktijk
const TEAM_LABELS: Record<TeamDagdeel, string> = {
  GRO: 'Groen',
  ORA: 'Oranje',
  TOT: 'Praktijk'  // Database gebruikt TOT, UI toont Praktijk
};

// Team badge styling consistent met ActionBar
const TEAM_BADGE_COLORS: Record<TeamDagdeel, { icon: string; bgColor: string; borderColor: string; textColor: string }> = {
  GRO: {
    icon: '🟢',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    textColor: 'text-green-800'
  },
  ORA: {
    icon: '🟠',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-800'
  },
  TOT: {
    icon: '🟣',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800'
  }
};

// 🔥 DRAAD44: Dagdeel type mapping voor database compatibiliteit
const DAGDEEL_TYPE_MAP: Record<string, 'O' | 'M' | 'A'> = {
  'ochtend': 'O',
  'middag': 'M',
  'avond': 'A'
};

export default function WeekTableBody({
  rosterId, // 🔥 DRAAD44: NIEUW
  diensten,
  onDagdeelUpdate,
  disabled = false
}: WeekTableBodyProps) {
  
  /**
   * DRAAD40B5: Sorteer diensten op code (alfabetisch)
   */
  const gesorteerdeDiensten = React.useMemo(() => {
    return [...diensten].sort((a, b) => a.dienstCode.localeCompare(b.dienstCode));
  }, [diensten]);
  
  /**
   * Get team badge component
   */
  const TeamBadge = ({ team }: { team: TeamDagdeel }) => {
    const badge = TEAM_BADGE_COLORS[team];
    const label = TEAM_LABELS[team];
    
    return (
      <div
        className={
          `inline-flex items-center gap-1.5
          px-2.5 py-1
          rounded-md
          border
          ${badge.bgColor}
          ${badge.borderColor}
          ${badge.textColor}`
        }
      >
        <span className="text-sm">{badge.icon}</span>
        <span className="text-xs font-semibold">{label}</span>
      </div>
    );
  };

  /**
   * Get alternating background for dienst group
   */
  const getDienstGroupBg = (index: number): string => {
    return index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
  };
  
  /**
   * Get dagdeel label for accessibility
   */
  const getDagdeelLabel = (dagdeel: '0' | 'M' | 'A'): string => {
    const labels = {
      '0': 'Ochtend',
      'M': 'Middag',
      'A': 'Avond'
    };
    return labels[dagdeel];
  };
  
  /**
   * Create update handler for specific dagdeel
   */
  const createUpdateHandler = (dagdeelId: string) => {
    return async (nieuweStatus: DagdeelStatus, nieuwAantal: number) => {
      if (onDagdeelUpdate) {
        await onDagdeelUpdate(dagdeelId, nieuweStatus, nieuwAantal);
      }
    };
  };

  return (
    <tbody>
      {gesorteerdeDiensten.map((dienst, dienstIndex) => {
        const groupBg = getDienstGroupBg(dienstIndex);
        const isLastDienst = dienstIndex === gesorteerdeDiensten.length - 1;
        
        // 🔥 FIX DRAAD61B: match nu direct op teamcode
        const zichtbareTeams = TEAM_ORDER.filter(teamCode => {
          const teamData = dienst.teams[teamCode];
          return teamData && teamData.dagen && teamData.dagen.length > 0;
        });
        
        if (zichtbareTeams.length === 0) {
          return null;
        }
        
        const dienstRowSpan = zichtbareTeams.length;
        
        return (
          <React.Fragment key={dienst.dienstId}>
            {zichtbareTeams.map((teamCode, visibleTeamIndex) => {
              const isFirstRow = visibleTeamIndex === 0;
              const isLastRow = visibleTeamIndex === zichtbareTeams.length - 1;
              const teamData = dienst.teams[teamCode];
              
              return (
                <tr
                  key={`${dienst.dienstId}-${teamCode}`}
                  className={
                    `${groupBg}
                    hover:bg-gray-100
                    transition-colors
                    ${isLastDienst && isLastRow ? 'border-b-2 border-gray-400' : ''}`
                  }
                >
                  {isFirstRow && (
                    <td
                      rowSpan={dienstRowSpan}
                      className="
                        sticky left-0 z-10
                        px-3 py-2
                        bg-inherit
                        border-r-2 border-gray-300
                        min-w-[140px] max-w-[140px]
                        align-middle
                      "
                      style={{
                        boxShadow: '2px 0 4px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="font-bold text-gray-900 text-xs leading-tight">
                          {dienst.dienstCode}
                        </div>
                        <div className="text-[11px] text-gray-600 leading-tight">
                          {dienst.dienstNaam}
                        </div>
                      </div>
                    </td>
                  )}

                  <td
                    className="
                      sticky left-[140px] z-10
                      px-2 py-1.5
                      bg-inherit
                      border-r-2 border-gray-300
                      min-w-[110px] max-w-[110px]
                      align-middle
                    "
                    style={{
                      boxShadow: '2px 0 4px rgba(0,0,0,0.05)'
                    }}
                  >
                    <TeamBadge team={teamCode} />
                  </td>

                  {teamData.dagen.map((dag) => (
                    <React.Fragment key={`${dienst.dienstId}-${teamCode}-${dag.datum}`}>
                      <DagdeelCell
                        rosterId={rosterId}
                        dienstId={dienst.dienstId}
                        dienstCode={dienst.dienstCode}
                        team={teamCode}
                        teamLabel={TEAM_LABELS[teamCode]}
                        datum={dag.datum}
                        dagdeelLabel={getDagdeelLabel('0')}
                        dagdeelType="O"
                        dagdeelWaarde={dag.dagdeelWaarden.ochtend}
                        onUpdate={createUpdateHandler(dag.dagdeelWaarden.ochtend.id)}
                        disabled={disabled}
                      />
                      <DagdeelCell
                        rosterId={rosterId}
                        dienstId={dienst.dienstId}
                        dienstCode={dienst.dienstCode}
                        team={teamCode}
                        teamLabel={TEAM_LABELS[teamCode]}
                        datum={dag.datum}
                        dagdeelLabel={getDagdeelLabel('M')}
                        dagdeelType="M"
                        dagdeelWaarde={dag.dagdeelWaarden.middag}
                        onUpdate={createUpdateHandler(dag.dagdeelWaarden.middag.id)}
                        disabled={disabled}
                      />
                      <DagdeelCell
                        rosterId={rosterId}
                        dienstId={dienst.dienstId}
                        dienstCode={dienst.dienstCode}
                        team={teamCode}
                        teamLabel={TEAM_LABELS[teamCode]}
                        datum={dag.datum}
                        dagdeelLabel={getDagdeelLabel('A')}
                        dagdeelType="A"
                        dagdeelWaarde={dag.dagdeelWaarden.avond}
                        onUpdate={createUpdateHandler(dag.dagdeelWaarden.avond.id)}
                        disabled={disabled}
                      />
                    </React.Fragment>
                  ))}
                </tr>
              );
            })}
          </React.Fragment>
        );
      })}
    </tbody>
  );
}

// Cache busting + railway dummy trigger
if (typeof window !== 'undefined') {
  window.__DRAAD61B_BUSTRIGGER = Date.now();
}