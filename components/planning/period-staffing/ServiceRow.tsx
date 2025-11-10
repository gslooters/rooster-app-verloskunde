import { RosterPeriodStaffing, updateRosterPeriodStaffingMinMax } from '@/lib/planning/roster-period-staffing-storage';
import { DayCell } from './DayCell';

interface Props {
  serviceId: string;
  records: RosterPeriodStaffing[];
  days: string[];
  holidays: string[];
  onUpdate: (id: string, updates: Partial<RosterPeriodStaffing>) => void;
}

// Helper functie om dienst ID te formatteren naar leesbare naam
function formatServiceName(serviceId: string): string {
  // Converteer snake_case of kebab-case naar Title Case
  return serviceId
    .split(/[-_]/)  
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function ServiceRow({ serviceId, records, days, holidays, onUpdate }: Props) {
  const recordMap = new Map(records.map(r => [r.date, r]));
  const firstRecord = records[0];
  const serviceName = formatServiceName(serviceId);

  async function handleMinMaxChange(id: string, min: number, max: number) {
    await updateRosterPeriodStaffingMinMax(id, min, max);
    onUpdate(id, { min_staff: min, max_staff: max });
  }

  return (
    <div className="flex border-b border-gray-200 hover:bg-blue-50 transition-colors group">
      {/* Sticky links: Team knoppen + Dienst naam */}
      <div className="w-[240px] shrink-0 sticky left-0 bg-white group-hover:bg-blue-50 border-r-2 border-gray-400 flex items-center gap-2 p-3 z-10 shadow-sm transition-colors">
        {/* Team knoppen horizontaal */}
        <div className="flex gap-1 shrink-0">
          <button
            className={`px-2 py-1.5 text-xs font-bold rounded transition-all ${
              firstRecord.team_tot 
                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
            }`}
            title={firstRecord.team_tot ? 'Team Totaal actief' : 'Team Totaal inactief'}
            disabled
          >
            Tot
          </button>
          <button
            className={`px-2 py-1.5 text-xs font-bold rounded transition-all ${
              firstRecord.team_gro 
                ? 'bg-green-600 text-white shadow-md hover:bg-green-700' 
                : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
            }`}
            title={firstRecord.team_gro ? 'Team Groen actief' : 'Team Groen inactief'}
            disabled
          >
            Gro
          </button>
          <button
            className={`px-2 py-1.5 text-xs font-bold rounded transition-all ${
              firstRecord.team_ora 
                ? 'bg-orange-600 text-white shadow-md hover:bg-orange-700' 
                : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
            }`}
            title={firstRecord.team_ora ? 'Team Oranje actief' : 'Team Oranje inactief'}
            disabled
          >
            Ora
          </button>
        </div>

        {/* Dienst naam (volledige naam met ellipsis) */}
        <div 
          className="text-sm font-bold text-gray-800 truncate flex-1 min-w-0" 
          title={serviceName}
        >
          {serviceName}
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
