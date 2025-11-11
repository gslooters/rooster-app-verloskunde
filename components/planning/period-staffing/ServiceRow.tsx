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
          // Fallback: gebruik service_id als code
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
      <div className="flex border-b border-gray-200 bg-gray-50">
        <div className="w-[240px] shrink-0 sticky left-0 bg-gray-50 border-r-2 border-gray-400 p-3 z-10">
          <div className="animate-pulse flex items-center gap-2">
            <div className="w-12 h-8 bg-gray-300 rounded"></div>
            <div className="flex-1 h-4 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex border-b border-gray-200 hover:bg-blue-50 transition-colors group">
      {/* Sticky links: Kleurvak met code + Dienstnaam + Team knoppen */}
      <div className="w-[240px] shrink-0 sticky left-0 bg-white group-hover:bg-blue-50 border-r-2 border-gray-400 flex items-center gap-2 p-3 z-10 shadow-sm transition-colors">
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

        {/* Team knoppen verticaal rechts uitgelijnd */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            className={`w-9 h-5 text-[10px] font-bold rounded transition-all ${
              firstRecord.team_tot 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-gray-200 text-gray-400'
            }`}
            title={firstRecord.team_tot ? 'Team Totaal actief' : 'Team Totaal inactief'}
            disabled
          >
            Tot
          </button>
          <button
            className={`w-9 h-5 text-[10px] font-bold rounded transition-all ${
              firstRecord.team_gro 
                ? 'bg-green-600 text-white shadow-sm' 
                : 'bg-gray-200 text-gray-400'
            }`}
            title={firstRecord.team_gro ? 'Team Groen actief' : 'Team Groen inactief'}
            disabled
          >
            Gro
          </button>
          <button
            className={`w-9 h-5 text-[10px] font-bold rounded transition-all ${
              firstRecord.team_ora 
                ? 'bg-orange-600 text-white shadow-sm' 
                : 'bg-gray-200 text-gray-400'
            }`}
            title={firstRecord.team_ora ? 'Team Oranje actief' : 'Team Oranje inactief'}
            disabled
          >
            Ora
          </button>
        </div>
      </div>

      {/* Data cellen: 35 dagen */}
      {days.map(day => {
        const record = recordMap.get(day);
        if (!record) {
          // Lege cel voor ontbrekende data
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
            key={record.id}
            record={record}
            isHoliday={holidays.includes(day)}
            isWeekend={new Date(day + 'T00:00:00').getDay() === 0 || new Date(day + 'T00:00:00').getDay() === 6}
            onChange={handleMinMaxChange}
          />
        );
      })}
    </div>
  );
}
