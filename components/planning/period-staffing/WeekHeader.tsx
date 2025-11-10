// components/planning/period-staffing/WeekHeader.tsx
import { getWeekNumber } from '@/lib/utils/date-helpers';

interface Props {
  days: string[];
  holidays: string[];
}

export function WeekHeader({ days, holidays }: Props) {
  // Groepeer dagen per week
  const weeks: Record<number, string[]> = {};
  days.forEach(day => {
    const weekNum = getWeekNumber(new Date(day));
    if (!weeks[weekNum]) weeks[weekNum] = [];
    weeks[weekNum].push(day);
  });

  const dayNames = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

  return (
    <div className="sticky top-0 z-20 bg-white border-b-2 border-gray-400">
      {/* Niveau 1: Weeknummers */}
      <div className="flex border-b border-gray-300">
        <div className="w-[240px] shrink-0 sticky left-0 bg-gray-50 border-r border-gray-300 p-2 font-bold text-sm">
          Team / Dienst
        </div>
        {Object.entries(weeks).map(([weekNum, weekDays]) => (
          <div
            key={weekNum}
            className="flex-1 text-center p-2 font-bold text-sm bg-blue-50"
            style={{ minWidth: `${weekDays.length * 60}px` }}
          >
            Week {weekNum}
          </div>
        ))}
      </div>

      {/* Niveau 2: Dagsoorten (ma-di-wo-do-vr-za-zo) */}
      <div className="flex border-b border-gray-300">
        <div className="w-[240px] shrink-0 sticky left-0 bg-gray-50 border-r border-gray-300" />
        {days.map(day => {
          const d = new Date(day);
          const dayName = dayNames[d.getDay()];
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const isHoliday = holidays.includes(day);
          return (
            <div
              key={day}
              className={`w-[60px] text-center p-1 text-xs font-semibold uppercase ${
                isHoliday ? 'bg-red-100 text-red-700' : isWeekend ? 'bg-gray-100' : 'bg-white'
              }`}
            >
              {dayName}
            </div>
          );
        })}
      </div>

      {/* Niveau 3: Datum (dd-mm) */}
      <div className="flex">
        <div className="w-[240px] shrink-0 sticky left-0 bg-gray-50 border-r border-gray-300" />
        {days.map(day => {
          const [y, m, d] = day.split('-');
          const isWeekend = new Date(day).getDay() === 0 || new Date(day).getDay() === 6;
          const isHoliday = holidays.includes(day);
          return (
            <div
              key={day}
              className={`w-[60px] text-center p-1 text-xs ${
                isHoliday ? 'bg-red-50 text-red-600' : isWeekend ? 'bg-gray-50' : 'bg-white'
              }`}
            >
              {d}-{m}
            </div>
          );
        })}
      </div>
    </div>
  );
}
