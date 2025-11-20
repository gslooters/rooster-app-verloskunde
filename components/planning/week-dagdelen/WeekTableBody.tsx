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
 * DRAAD40B5 FASE 5: Team Label Mapping
 * 
 * Wijzigingen:
 * - TOT wordt consequent getoond als "Praktijk" in UI
 * - Team badge kleuren consistent met ActionBar
 * - Verbeterde badge styling met grotere tekst
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

/**
 * DRAAD39.4/39.5: Table Body met Dienst Groepering en Inline Editing
 * 
 * Layout per dienst:
 * - 3 rijen: Groen, Oranje, Praktijk (TOT)
 * - Eerste kolom: frozen left, rowspan=3 met dienstcode + naam
 * - Tweede kolom: team badge per rij
 * - 21 dagdeel cellen per rij (7 dagen × 3 dagdelen)
 * 
 * Styling:
 * - Alternerende achtergrond per dienst-groep
 * - Border tussen groepen
 * - Frozen eerste kolom voor horizontaal scrollen
 * 
 * DRAAD39.5 Update:
 * - Inline editable cells met onUpdate handler
 * - Proper context passed to DagdeelCell (dienst code, team label, dagdeel label)
 */
export default function WeekTableBody({
  diensten,
  onDagdeelUpdate,
  disabled = false
}: WeekTableBodyProps) {
  
  /**
   * Get team badge component
   */
  const TeamBadge = ({ team }: { team: TeamDagdeel }) => {
    const badge = TEAM_BADGE_COLORS[team];
    const label = TEAM_LABELS[team];
    
    return (
      <div
        className={`
          inline-flex items-center gap-2
          px-3 py-1.5
          rounded-md
          border
          ${badge.bgColor}
          ${badge.borderColor}
          ${badge.textColor}
        `}
      >
        <span className="text-base">{badge.icon}</span>
        <span className="text-sm font-semibold">{label}</span>
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
      {diensten.map((dienst, dienstIndex) => {
        const groupBg = getDienstGroupBg(dienstIndex);
        const isLastDienst = dienstIndex === diensten.length - 1;
        
        return (
          <React.Fragment key={dienst.dienstId}>
            {TEAM_ORDER.map((teamCode, teamIndex) => {
              const isFirstRow = teamIndex === 0;
              const teamData = dienst.teams[
                teamCode === 'GRO' ? 'groen' : 
                teamCode === 'ORA' ? 'oranje' : 
                'totaal'
              ];
              
              return (
                <tr
                  key={`${dienst.dienstId}-${teamCode}`}
                  className={`
                    ${groupBg}
                    hover:bg-gray-100
                    transition-colors
                    ${!isLastDienst && teamIndex === 2 ? 'border-b-2 border-gray-400' : ''}
                  `}
                >
                  {/* Kolom 1: Dienst info (frozen left, rowspan=3 alleen in eerste rij) */}
                  {isFirstRow && (
                    <td
                      rowSpan={3}
                      className="
                        sticky left-0 z-10
                        px-4 py-3
                        bg-inherit
                        border-r-2 border-gray-300
                        min-w-[180px]
                        align-middle
                      "
                    >
                      <div className="flex flex-col gap-1">
                        <div className="font-bold text-gray-900 text-sm">
                          {dienst.dienstCode}
                        </div>
                        <div className="text-xs text-gray-600">
                          {dienst.dienstNaam}
                        </div>
                      </div>
                    </td>
                  )}

                  {/* Kolom 2: Team badge (frozen left) */}
                  <td
                    className="
                      sticky left-[180px] z-10
                      px-3 py-2
                      bg-inherit
                      border-r-2 border-gray-300
                      min-w-[130px]
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
