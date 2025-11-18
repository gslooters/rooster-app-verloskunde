import { getWeekNumber } from '@/lib/utils/date-helpers';

interface Props {
  days: string[];
  holidays: string[];
}

export function WeekHeader({ days, holidays }: Props) {
  // Groepeer dagen per week
  const weeks: Record<number, string[]> = {};
  days.forEach(day => {
    const weekNum = getWeekNumber(new Date(day + 'T00:00:00'));
    if (!weeks[weekNum]) weeks[weekNum] = [];
    weeks[weekNum].push(day);
  });

  const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

  return (
    <div className="sticky top-0 z-20 bg-white border-b-2 border-gray-400 shadow-sm">
      {/* Niveau 1: Weeknummers */}
      <div className="flex border-b border-gray-300">
        {/* Dienst kolom header */}
        <div className="w-[180px] shrink-0 sticky left-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-r border-gray-300 p-3 font-bold text-sm z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-blue-600">📋</span>
            <span>Dienst</span>
          </div>
        </div>
        {/* Team kolom header */}
        <div className="w-[60px] shrink-0 sticky bg-gradient-to-r from-blue-50 to-indigo-50 border-r-2 border-gray-400 p-3 font-bold text-xs z-10 shadow-sm" style={{ left: '180px' }}>
          <div className="flex items-center justify-center">
            <span className="text-blue-600">👥</span>
          </div>
        </div>
        {/* Week kolommen */}
        {Object.entries(weeks)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([weekNum, weekDays]) => (
            <div
              key={weekNum}
              className="flex-1 text-center p-3 font-bold text-base bg-gradient-to-b from-blue-100 to-blue-50 border-r border-blue-200"
              style={{ minWidth: `${weekDays.length * 60}px` }}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-blue-600">🗓️</span>
                <span>Week {weekNum}</span>
              </div>
            </div>
          ))
        }
      </div>

      {/* Niveau 2: Dagsoorten (Zo-Ma-Di-Wo-Do-Vr-Za) */}
      <div className="flex border-b border-gray-300">
        {/* Dienst kolom spacer */}
        <div className="w-[180px] shrink-0 sticky left-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-r border-gray-300 z-10" />
        {/* Team kolom spacer */}
        <div className="w-[60px] shrink-0 sticky bg-gradient-to-r from-blue-50 to-indigo-50 border-r-2 border-gray-400 z-10" style={{ left: '180px' }} />
        {/* Dagen */}
        {days.map(day => {
          const d = new Date(day + 'T00:00:00');
          const dayName = dayNames[d.getDay()];
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const isHoliday = holidays.includes(day);
          return (
            <div
              key={day}
              className={`w-[60px] text-center p-2 text-xs font-bold uppercase border-r border-gray-200 ${
                isHoliday 
                  ? 'bg-red-100 text-red-800' 
                  : isWeekend 
                  ? 'bg-gray-200 text-gray-700' 
                  : 'bg-white text-gray-800'
              }`}
            >
              {dayName}
            </div>
          );
        })}
      </div>

      {/* Niveau 3: Datum (dd/mm) */}
      <div className="flex">
        {/* Dienst kolom spacer */}
        <div className="w-[180px] shrink-0 sticky left-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-r border-gray-300 z-10" />
        {/* Team kolom spacer */}
        <div className="w-[60px] shrink-0 sticky bg-gradient-to-r from-blue-50 to-indigo-50 border-r-2 border-gray-400 z-10" style={{ left: '180px' }} />
        {/* Datums */}
        {days.map(day => {
          const [y, m, d] = day.split('-');
          const date = new Date(day + 'T00:00:00');
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const isHoliday = holidays.includes(day);
          return (
            <div
              key={day}
              className={`w-[60px] text-center p-2 text-xs font-medium border-r border-gray-200 ${
                isHoliday 
                  ? 'bg-red-50 text-red-700 font-bold' 
                  : isWeekend 
                  ? 'bg-gray-100 text-gray-600' 
                  : 'bg-white text-gray-700'
              }`}
              title={`${d}-${m}-${y}`}
            >
              {d}/{m}
            </div>
          );
        })}
      </div>
    </div>
  );
}
