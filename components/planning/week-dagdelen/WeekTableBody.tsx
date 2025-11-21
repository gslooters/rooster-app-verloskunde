'use client';
import React from 'react';
import { DienstDagdelenWeek, TeamDagdeel, TEAM_ORDER, DagdeelStatus } from '@/lib/types/week-dagdelen';
import DagdeelCell from './DagdeelCell';

interface WeekTableBodyProps {
  diensten: DienstDagdelenWeek[];
  onDagdeelUpdate?: (dagdeelId: string, nieuweStatus: DagdeelStatus, nieuwAantal: number) => Promise<void>;
  disabled?: boolean;
}

/**
 * DRAAD40B5: Verbeterde Layout voor Diensten per Dagdeel
 * 
 * Wijzigingen:
 * - CODE + NAAM in één kolom ("Dienst"), alleen getoond bij eerste team (Groen)
 * - Team in aparte kolom met badge
 * - Compactere styling voor 100% zoom zichtbaarheid  
 * - Sortering op dienstcode (alfabetisch)
 * - Teamrijen gefilterd: skip rendering als team.dagen leeg is
 * - Dienst wordt altijd getoond (ook als alle teams gefilterd zijn)
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

export default function WeekTableBody({
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
        
        // DRAAD40B5: Bepaal welke teams zichtbaar zijn (hebben dagen data)
        const zichtbareTeams = TEAM_ORDER.filter(teamCode => {
          const teamData = dienst.teams[
            teamCode === 'GRO' ? 'groen' : 
            teamCode === 'ORA' ? 'oranje' : 
            'totaal'
          ];
          return teamData.dagen.length > 0;
        });
        
        // Als geen enkel team zichtbaar is, skip deze dienst
        if (zichtbareTeams.length === 0) {
          return null;
        }
        
        // Bereken rowspan voor dienst kolom (aantal zichtbare teams)
        const dienstRowSpan = zichtbareTeams.length;
        
        return (
          <React.Fragment key={dienst.dienstId}>
            {zichtbareTeams.map((teamCode, visibleTeamIndex) => {
              const isFirstRow = visibleTeamIndex === 0;
              const isLastRow = visibleTeamIndex === zichtbareTeams.length - 1;
              const teamData = dienst.teams[
                teamCode === 'GRO' ? 'groen' : 
                teamCode === 'ORA' ? 'oranje' : 
                'totaal'
              ];
              
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
                  {/* DRAAD40B5: Kolom 1 - Dienst (CODE + NAAM)
                      - Frozen left
                      - Rowspan = aantal zichtbare teams
                      - Code + Naam op aparte regels
                   */}
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

                  {/* DRAAD40B5: Kolom 2 - Team badge (frozen left) 
                      - Compacter, kleinere badge
                      - Elke rij heeft eigen team
                   */}
                  <td
                    className="
                      sticky left-[140px] z-10
                      px-2 py-1.5
                      bg-inherit
                      border-r-2 border-gray-300
                      min-w-[110px] max-w-[110px]
                      align-middle
                    "
                  >
                    <TeamBadge team={teamCode} />
                  </td>

                  {/* Kolom 3-23: Dagdeel cellen (21 cellen: 7 dagen x 3 dagdelen) */}
                  {teamData.dagen.map((dag) => (
                    <React.Fragment key={`${dienst.dienstId}-${teamCode}-${dag.datum}`}>
                      {/* Ochtend */}
                      <DagdeelCell
                        dienstId={dienst.dienstId}
                        dienstCode={dienst.dienstCode}
                        team={teamCode}
                        teamLabel={TEAM_LABELS[teamCode]}
                        datum={dag.datum}
                        dagdeelLabel={getDagdeelLabel('0')}
                        dagdeelWaarde={dag.dagdeelWaarden.ochtend}
                        onUpdate={createUpdateHandler(dag.dagdeelWaarden.ochtend.id)}
                        disabled={disabled}
                      />
                      {/* Middag */}
                      <DagdeelCell
                        dienstId={dienst.dienstId}
                        dienstCode={dienst.dienstCode}
                        team={teamCode}
                        teamLabel={TEAM_LABELS[teamCode]}
                        datum={dag.datum}
                        dagdeelLabel={getDagdeelLabel('M')}
                        dagdeelWaarde={dag.dagdeelWaarden.middag}
                        onUpdate={createUpdateHandler(dag.dagdeelWaarden.middag.id)}
                        disabled={disabled}
                      />
                      {/* Avond */}
                      <DagdeelCell
                        dienstId={dienst.dienstId}
                        dienstCode={dienst.dienstCode}
                        team={teamCode}
                        teamLabel={TEAM_LABELS[teamCode]}
                        datum={dag.datum}
                        dagdeelLabel={getDagdeelLabel('A')}
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