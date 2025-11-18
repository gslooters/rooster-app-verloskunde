import { RosterPeriodStaffing, updateRosterPeriodStaffingMinMax } from '@/lib/planning/roster-period-staffing-storage';
import { DayCell } from './DayCell';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  serviceId: string;
  records: RosterPeriodStaffing[];
  days: string[];
  holidays: string[];
  onUpdate: (id: string, updates: Partial<RosterPeriodStaffing>) => void;
}

interface ServiceInfo {
  code: string;
  naam: string;
  kleur: string;
}

type TeamType = 'groen' | 'oranje' | 'praktijk';

export function ServiceRow({ serviceId, records, days, holidays, onUpdate }: Props) {
  const recordMap = new Map(records.map(r => [r.date, r]));
  const firstRecord = records[0];
  const [serviceInfo, setServiceInfo] = useState<ServiceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadServiceInfo() {
      try {
        const { data, error } = await supabase
          .from('service_types')
          .select('code, naam, kleur')
          .eq('id', serviceId)
          .single();
        
        if (error) {
          console.error('Error loading service info:', error);
          setServiceInfo({
            code: serviceId.toUpperCase(),
            naam: serviceId,
            kleur: '#10B981'
          });
        } else if (data) {
          setServiceInfo({
            code: data.code,
            naam: data.naam,
            kleur: data.kleur || '#10B981'
          });
        }
      } catch (err) {
        console.error('Failed to load service info:', err);
        setServiceInfo({
          code: serviceId.toUpperCase(),
          naam: serviceId,
          kleur: '#10B981'
        });
      } finally {
        setLoading(false);
      }
    }

    loadServiceInfo();
  }, [serviceId]);

  async function handleMinMaxChange(id: string, min: number, max: number) {
    await updateRosterPeriodStaffingMinMax(id, min, max);
    onUpdate(id, { min_staff: min, max_staff: max });
  }

  if (loading || !serviceInfo) {
    return (
      <>
        {['groen', 'oranje', 'praktijk'].map((team, idx) => (
          <div key={`${serviceId}-${team}-loading`} className="flex border-b border-gray-200 bg-gray-50">
            {/* Dienst kolom (alleen bij eerste rij) */}
            {idx === 0 && (
              <div className="w-[180px] shrink-0 sticky left-0 bg-gray-50 border-r border-gray-300 p-3 z-10">
                <div className="animate-pulse flex items-center gap-2">
                  <div className="w-12 h-8 bg-gray-300 rounded"></div>
                  <div className="flex-1 h-4 bg-gray-300 rounded"></div>
                </div>
              </div>
            )}
            {/* Team kolom */}
            <div className="w-[60px] shrink-0 sticky bg-gray-50 border-r-2 border-gray-400 p-2 z-10" style={{ left: idx === 0 ? '180px' : '0' }}>
              <div className="animate-pulse w-10 h-6 bg-gray-300 rounded"></div>
            </div>
          </div>
        ))}
      </>
    );
  }

  // Definieer teams met hun eigenschappen
  const teams: Array<{ type: TeamType; label: string; color: string; active: boolean }> = [
    { type: 'groen', label: 'Groen', color: '#10B981', active: firstRecord.team_gro },
    { type: 'oranje', label: 'Oranje', color: '#F97316', active: firstRecord.team_ora },
    { type: 'praktijk', label: 'Praktijk', color: '#3B82F6', active: firstRecord.team_tot }
  ];

  return (
    <>
      {teams.map((team, teamIndex) => (
        <div 
          key={`${serviceId}-${team.type}`} 
          className="flex border-b border-gray-200 hover:bg-blue-50 transition-colors group"
        >
          {/* Dienst kolom (alleen bij eerste team-rij met rowspan effect) */}
          {teamIndex === 0 && (
            <div 
              className="w-[180px] shrink-0 sticky left-0 bg-white group-hover:bg-blue-50 border-r border-gray-300 flex items-center gap-2 p-3 z-10 shadow-sm transition-colors"
              style={{ 
                position: 'sticky',
                alignSelf: 'stretch'
              }}
            >
              {/* Kleurvak met dienstcode */}
              <div 
                className="w-14 h-8 shrink-0 rounded font-bold text-white flex items-center justify-center text-xs shadow-sm"
                style={{ backgroundColor: serviceInfo.kleur }}
                title={`${serviceInfo.code} - ${serviceInfo.naam}`}
              >
                {serviceInfo.code}
              </div>

              {/* Dienst naam (met ellipsis) */}
              <div 
                className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0" 
                title={serviceInfo.naam}
              >
                {serviceInfo.naam}
              </div>
            </div>
          )}

          {/* Team kolom */}
          <div 
            className="w-[60px] shrink-0 sticky bg-white group-hover:bg-blue-50 border-r-2 border-gray-400 flex items-center justify-center p-2 z-10 shadow-sm transition-colors"
            style={{ left: teamIndex === 0 ? '180px' : '0' }}
          >
            <div 
              className="w-12 h-6 rounded text-white flex items-center justify-center text-[10px] font-bold shadow-sm"
              style={{ backgroundColor: team.active ? team.color : '#D1D5DB' }}
              title={`${team.label}${team.active ? ' - actief' : ' - inactief'}`}
            >
              {team.label.substring(0, 3).toUpperCase()}
            </div>
          </div>

          {/* Data cellen: 35 dagen */}
          {days.map(day => {
            const record = recordMap.get(day);
            if (!record) {
              const date = new Date(day + 'T00:00:00');
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const isHoliday = holidays.includes(day);
              const bgClass = isHoliday ? 'bg-red-50' : isWeekend ? 'bg-gray-50' : 'bg-white';
              return (
                <div 
                  key={day} 
                  className={`w-[60px] border-l border-gray-200 ${bgClass} flex items-center justify-center`}
                >
                  <span className="text-xs text-gray-400" title="Geen data beschikbaar">-</span>
                </div>
              );
            }
            return (
              <DayCell
                key={`${record.id}-${team.type}`}
                record={record}
                isHoliday={holidays.includes(day)}
                isWeekend={new Date(day + 'T00:00:00').getDay() === 0 || new Date(day + 'T00:00:00').getDay() === 6}
                onChange={handleMinMaxChange}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}
