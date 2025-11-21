'use client';

import React from 'react';
import Link from 'next/link';
import type { WeekDagdeelData } from '@/lib/planning/weekDagdelenData';
import { DagdeelCell } from './DagdeelCell';
import { StatusBadge } from './StatusBadge';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';

interface WeekDagdelenTableV2Props {
  weekData: WeekDagdeelData;
  rosterId: string;
  periodStart: string;
}

/**
 * WeekDagdelenTableV2 Component
 * 
 * 🔥 DRAAD40C V2 - NUCLEAR OPTION:
 * - PURE INLINE CSS (geen Tailwind conflicts)
 * - GEEN container wrappers
 * - FULLWIDTH GEGARANDEERD
 * - Sticky headers met z-index control
 * - Frozen left column voor dagdeel labels
 * 
 * Volledig functionele weekplanning tabel met:
 * - Grid layout: 8 kolommen (dagdeel header + 7 dagen)
 * - 4 rijen per dagdeel type (ochtend, middag, avond, nacht)
 * - 100% viewport width
 * - Horizontaal scrollen
 */
export function WeekDagdelenTableV2({ weekData, rosterId, periodStart }: WeekDagdelenTableV2Props) {
  const dagdelen = [
    { key: 'ochtend' as const, label: 'Ochtend', tijd: '07:00 - 15:00' },
    { key: 'middag' as const, label: 'Middag', tijd: '15:00 - 23:00' },
    { key: 'avond' as const, label: 'Avond', tijd: '23:00 - 07:00' },
    { key: 'nacht' as const, label: 'Nacht', tijd: '07:00 - 19:00' },
  ];

  // Bereken totale bezetting per dag
  const getDayTotals = (dayIndex: number) => {
    const day = weekData.days[dayIndex];
    if (!day) return 0;
    
    const ochtendTotaal = day.dagdelen.ochtend.reduce((sum, a) => sum + (a.aantal || 0), 0);
    const middagTotaal = day.dagdelen.middag.reduce((sum, a) => sum + (a.aantal || 0), 0);
    const avondTotaal = day.dagdelen.avond.reduce((sum, a) => sum + (a.aantal || 0), 0);
    const nachtTotaal = day.dagdelen.nacht.reduce((sum, a) => sum + (a.aantal || 0), 0);
    
    return ochtendTotaal + middagTotaal + avondTotaal + nachtTotaal;
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Info Header */}
      <div style={{
        marginBottom: '24px',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '16px'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '4px'
            }}>
              Diensten per week aanpassen: Week {weekData.weekNummer} - {weekData.jaar}
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#4b5563'
            }}>
              {weekData.startDatum} t/m {weekData.eindDatum}
            </p>
          </div>
          <div>
            <Link
              href={`/planning/design/dagdelen-dashboard?roster_id=${rosterId}&period_start=${periodStart}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            >
              Terug naar Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* 🔥 FULLWIDTH TABLE CONTAINER - GEEN MAX-WIDTH! */}
      <div style={{
        width: '100%',
        overflowX: 'auto',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}>
        <div style={{ minWidth: '1024px' }}>
          {/* Grid Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '200px repeat(7, 1fr)',
            gap: '2px',
            backgroundColor: '#d1d5db'
          }}>
            
            {/* HEADER ROW: Sticky header */}
            <div style={{
              backgroundColor: '#f3f4f6',
              padding: '16px',
              position: 'sticky',
              top: 0,
              zIndex: 20,
              borderBottom: '2px solid #9ca3af'
            }}>
              <div style={{
                fontWeight: 'bold',
                color: '#374151',
                fontSize: '14px'
              }}>
                Dagdeel
              </div>
            </div>
            
            {weekData.days.map((day, index) => {
              const datum = parseISO(day.datum);
              const totaal = getDayTotals(index);
              
              return (
                <div
                  key={day.datum}
                  style={{
                    backgroundColor: '#f3f4f6',
                    padding: '16px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    borderBottom: '2px solid #9ca3af'
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontWeight: 'bold',
                      color: '#111827',
                      textTransform: 'capitalize'
                    }}>
                      {format(datum, 'EEEE', { locale: nl })}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#4b5563',
                      marginTop: '4px'
                    }}>
                      {format(datum, 'd MMM', { locale: nl })}
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <StatusBadge count={totaal} />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* DATA ROWS: Per dagdeel */}
            {dagdelen.map((dagdeel) => (
              <React.Fragment key={dagdeel.key}>
                {/* Sticky linker kolom */}
                <div style={{
                  backgroundColor: '#f9fafb',
                  padding: '16px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 10,
                  borderRight: '2px solid #9ca3af'
                }}>
                  <div style={{
                    fontWeight: 'bold',
                    color: '#111827',
                    fontSize: '16px',
                    marginBottom: '4px'
                  }}>
                    {dagdeel.label}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#4b5563'
                  }}>
                    {dagdeel.tijd}
                  </div>
                </div>

                {/* Cellen voor elke dag */}
                {weekData.days.map((day) => (
                  <div 
                    key={`${day.datum}-${dagdeel.key}`} 
                    style={{ backgroundColor: 'white' }}
                  >
                    <DagdeelCell
                      assignments={day.dagdelen[dagdeel.key]}
                      dagdeel={dagdeel.key}
                      datum={day.datum}
                    />
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div style={{
        marginTop: '24px',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px'
      }}>
        <h3 style={{
          fontWeight: 'bold',
          color: '#111827',
          marginBottom: '12px'
        }}>
          Legenda
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px'
        }}>
          <div>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Bezettingsstatus
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusBadge count={2} />
                <span style={{ fontSize: '14px', color: '#4b5563' }}>
                  Voldoende (2+ medewerkers)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusBadge count={1} />
                <span style={{ fontSize: '14px', color: '#4b5563' }}>
                  Onderbezet (1 medewerker)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusBadge count={0} />
                <span style={{ fontSize: '14px', color: '#4b5563' }}>
                  Kritiek (geen bezetting)
                </span>
              </div>
            </div>
          </div>
          <div>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Team Kleuren
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '64px',
                  height: '24px',
                  backgroundColor: '#dbeafe',
                  border: '2px solid #93c5fd',
                  borderRadius: '4px'
                }} />
                <span style={{ fontSize: '14px', color: '#4b5563' }}>Team A</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '64px',
                  height: '24px',
                  backgroundColor: '#dcfce7',
                  border: '2px solid #86efac',
                  borderRadius: '4px'
                }} />
                <span style={{ fontSize: '14px', color: '#4b5563' }}>Team B</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '64px',
                  height: '24px',
                  backgroundColor: '#f3e8ff',
                  border: '2px solid #c084fc',
                  borderRadius: '4px'
                }} />
                <span style={{ fontSize: '14px', color: '#4b5563' }}>Team C</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
