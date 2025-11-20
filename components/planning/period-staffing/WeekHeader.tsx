import { getWeekNumber } from '@/lib/utils/date-helpers';

interface Props {
  days: string[];
  holidays: string[];
}

const DAGDEEL_EMOJI = {
  O: '🌅',
  M: '☀️',
  A: '🌙'
} as const;

const DAGDEEL_LABELS = {
  O: 'Ochtend',
  M: 'Middag',
  A: 'Avond'
} as const;

export function WeekHeader({ days, holidays }: Props) {
  // Groepeer dagen per week
  const weeks: Record<number, string[]> = {};
  days.forEach(day => {
    const weekNum = getWeekNumber(new Date(day + 'T00:00:00'));
    if (!weeks[weekNum]) weeks[weekNum] = [];
    weeks[weekNum].push(day);
  });

  const dayNames = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA'];

  return (
    <div className="sticky top-0 z-20 bg-white shadow-md">
      {/* Niveau 1: Weeknummers */}
      <div className="flex border-b-2 border-gray-300">
        {/* Dienst kolom header */}
        <div className="w-[200px] shrink-0 sticky left-0 bg-blue-100 border-r-2 border-gray-400 z-10 shadow-sm">
          <div className="p-3 text-center">
            <div className="text-base font-bold text-blue-900">Dienst</div>
          </div>
        </div>
        
        {/* Team kolom header */}
        <div className="w-[100px] shrink-0 sticky bg-blue-100 border-r-2 border-gray-400 z-10 shadow-sm" style={{ left: '200px' }}>
          <div className="p-3 text-center">
            <div className="text-base font-bold text-blue-900">Team</div>
          </div>
        </div>
        
        {/* Week kolommen */}
        {Object.entries(weeks)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([weekNum, weekDays]) => (
            <div
              key={weekNum}
              className="flex-1 text-center bg-gradient-to-b from-blue-200 to-blue-100 border-r border-blue-300"
              style={{ minWidth: `${weekDays.length * 180}px` }}
            >
              <div className="p-3">
                <div className="text-lg font-bold text-blue-900">Week {weekNum}</div>
              </div>
            </div>
          ))
        }
      </div>

      {/* Niveau 2: Dagen (MA, DI, WO met datum) */}
      <div className="flex border-b border-gray-300">
        {/* Dienst kolom spacer */}
        <div className="w-[200px] shrink-0 sticky left-0 bg-blue-50 border-r-2 border-gray-400 z-10" />
        {/* Team kolom spacer */}
        <div className="w-[100px] shrink-0 sticky bg-blue-50 border-r-2 border-gray-400 z-10" style={{ left: '200px' }} />
        
        {/* Dag headers */}
        {days.map(day => {
          const date = new Date(day + 'T00:00:00');
          const dayName = dayNames[date.getDay()];
          const [y, m, d] = day.split('-');
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const isHoliday = holidays.includes(day);
          
          return (
            <div
              key={day}
              className={`w-[180px] text-center border-r border-gray-300 ${
                isHoliday 
                  ? 'bg-red-100' 
                  : isWeekend 
                  ? 'bg-gray-200' 
                  : 'bg-blue-50'
              }`}
            >
              <div className="p-2">
                <div className={`text-sm font-bold uppercase ${
                  isHoliday 
                    ? 'text-red-800' 
                    : isWeekend 
                    ? 'text-gray-700' 
                    : 'text-blue-900'
                }`}>
                  {dayName}
                </div>
                <div className={`text-xs font-medium mt-1 ${
                  isHoliday 
                    ? 'text-red-700' 
                    : isWeekend 
                    ? 'text-gray-600' 
                    : 'text-blue-700'
                }`}>
                  {d}/{m}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Niveau 3: Dagdelen (Ochtend, Middag, Avond) */}
      <div className="flex border-b-2 border-gray-400">
        {/* Dienst kolom spacer */}
        <div className="w-[200px] shrink-0 sticky left-0 bg-blue-50 border-r-2 border-gray-400 z-10" />
        {/* Team kolom spacer */}
        <div className="w-[100px] shrink-0 sticky bg-blue-50 border-r-2 border-gray-400 z-10" style={{ left: '200px' }} />
        
        {/* Dagdeel headers per dag */}
        {days.map(day => {
          const date = new Date(day + 'T00:00:00');
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const isHoliday = holidays.includes(day);
          
          return (
            <div key={day} className="flex w-[180px] border-r border-gray-300">
              {/* Ochtend */}
              <div className={`flex-1 text-center border-r border-gray-200 ${
                isHoliday 
                  ? 'bg-red-50' 
                  : isWeekend 
                  ? 'bg-gray-100' 
                  : 'bg-orange-50'
              }`}>
                <div className="p-2">
                  <div className="text-2xl" role="img" aria-label={DAGDEEL_LABELS.O}>
                    {DAGDEEL_EMOJI.O}
                  </div>
                  <div className={`text-[10px] font-medium uppercase mt-1 ${
                    isHoliday 
                      ? 'text-red-700' 
                      : isWeekend 
                      ? 'text-gray-600' 
                      : 'text-orange-700'
                  }`}>
                    {DAGDEEL_LABELS.O}
                  </div>
                </div>
              </div>
              
              {/* Middag */}
              <div className={`flex-1 text-center border-r border-gray-200 ${
                isHoliday 
                  ? 'bg-red-50' 
                  : isWeekend 
                  ? 'bg-gray-100' 
                  : 'bg-yellow-50'
              }`}>
                <div className="p-2">
                  <div className="text-2xl" role="img" aria-label={DAGDEEL_LABELS.M}>
                    {DAGDEEL_EMOJI.M}
                  </div>
                  <div className={`text-[10px] font-medium uppercase mt-1 ${
                    isHoliday 
                      ? 'text-red-700' 
                      : isWeekend 
                      ? 'text-gray-600' 
                      : 'text-yellow-700'
                  }`}>
                    {DAGDEEL_LABELS.M}
                  </div>
                </div>
              </div>
              
              {/* Avond */}
              <div className={`flex-1 text-center ${
                isHoliday 
                  ? 'bg-red-50' 
                  : isWeekend 
                  ? 'bg-gray-100' 
                  : 'bg-indigo-50'
              }`}>
                <div className="p-2">
                  <div className="text-2xl" role="img" aria-label={DAGDEEL_LABELS.A}>
                    {DAGDEEL_EMOJI.A}
                  </div>
                  <div className={`text-[10px] font-medium uppercase mt-1 ${
                    isHoliday 
                      ? 'text-red-700' 
                      : isWeekend 
                      ? 'text-gray-600' 
                      : 'text-indigo-700'
                  }`}>
                    {DAGDEEL_LABELS.A}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
