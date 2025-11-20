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
   * Get team badge styling
   */
  const getTeamBadge = (team: TeamDagdeel) => {
    const badges = {
      GRO: {
        icon: '🟢',
        label: 'Groen',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-700'
      },
      ORA: {
        icon: '🟠',
        label: 'Oranje',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-700'
      },
      TOT: {
        icon: '⚪',
        label: 'Praktijk',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-700'
      }
    };
    
    return badges[team];
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
              const teamBadge = getTeamBadge(teamCode);
              
              return (
                <tr
                  key={`${dienst.dienstId}-${teamCode}`}
                  className={`
                    ${groupBg}
                    hover:bg-gray-100
                    transition-colors
                    ${!isLastDienst && teamIndex === 2 ? 'border-b border-gray-300' : ''}
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
                        border-r border-gray-200
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
                      border-r border-gray-200
                      min-w-[120px]
                      align-middle
                    "
                  >
                    <div
                      className={`
                        inline-flex items-center gap-2
                        px-2 py-1
                        rounded-md
                        border
                        ${teamBadge.bgColor}
                        ${teamBadge.borderColor}
                        ${teamBadge.textColor}
                      `}
                    >
                      <span className="text-base">{teamBadge.icon}</span>
                      <span className="text-xs font-medium">{teamBadge.label}</span>
                    </div>
                  </td>

                  {/* Kolom 3-23: Dagdeel cellen (21 cellen: 7 dagen x 3 dagdelen) */}
                  {teamData.dagen.map((dag) => (
                    <React.Fragment key={`${dienst.dienstId}-${teamCode}-${dag.datum}`}>
                      {/* Ochtend */}
                      <DagdeelCell
                        dienstId={dienst.dienstId}
                        dienstCode={dienst.dienstCode}
                        team={teamCode}
                        teamLabel={teamBadge.label}
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
                        teamLabel={teamBadge.label}
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
                        teamLabel={teamBadge.label}
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
