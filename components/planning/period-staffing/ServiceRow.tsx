// components/planning/period-staffing/ServiceRow.tsx
import { RosterPeriodStaffing, updateRosterPeriodStaffingMinMax } from '@/lib/planning/roster-period-staffing-storage';
import { DayCell } from './DayCell';

interface Props {
  serviceId: string;
  records: RosterPeriodStaffing[];
  days: string[];
  holidays: string[];
  onUpdate: (id: string, updates: Partial<RosterPeriodStaffing>) => void;
}

export function ServiceRow({ serviceId, records, days, holidays, onUpdate }: Props) {
  const recordMap = new Map(records.map(r => [r.date, r]));
  const firstRecord = records[0];

  async function handleMinMaxChange(id: string, min: number, max: number) {
    await updateRosterPeriodStaffingMinMax(id, min, max);
    onUpdate(id, { minstaff: min, maxstaff: max });
  }

  return (
    <div className="flex border-b border-gray-200 hover:bg-gray-50">
      {/* Sticky links: Team knoppen + Dienst code */}
      <div className="w-[240px] shrink-0 sticky left-0 bg-white border-r border-gray-300 flex items-center gap-2 p-2">
        {/* Team knoppen horizontaal */}
        <div className="flex gap-1">
          <button
            className={`px-2 py-1 text-xs font-semibold rounded ${
              firstRecord.teamtot ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}
            title="Totaal"
          >
            Tot
          </button>
          <button
            className={`px-2 py-1 text-xs font-semibold rounded ${
              firstRecord.teamgro ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}
            title="Groen"
          >
            Gro
          </button>
          <button
            className={`px-2 py-1 text-xs font-semibold rounded ${
              firstRecord.teamora ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}
            title="Oranje"
          >
            Ora
          </button>
        </div>

        {/* Dienst code (max 3 chars) */}
        <div className="text-sm font-bold truncate" title={serviceId}>
          {serviceId.substring(0, 3).toUpperCase()}
        </div>
      </div>

      {/* Data cellen: 35 dagen */}
      {days.map(day => {
        const record = recordMap.get(day);
        if (!record) return <div key={day} className="w-[60px]" />;
        return (
          <DayCell
            key={record.id}
            record={record}
            isHoliday={holidays.includes(day)}
            isWeekend={new Date(day).getDay() === 0 || new Date(day).getDay() === 6}
            onChange={handleMinMaxChange}
          />
        );
      })}
    </div>
  );
}
