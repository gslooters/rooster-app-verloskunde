// components/planning/period-staffing/DayCell.tsx
import { useState } from 'react';
import { RosterPeriodStaffing } from '@/lib/planning/roster-period-staffing-storage';
import { getBezettingTag, getBezettingTagClass } from '@/lib/utils/bezetting-tags';

interface Props {
  record: RosterPeriodStaffing;
  isHoliday: boolean;
  isWeekend: boolean;
  onChange: (id: string, min: number, max: number) => void;
}

export function DayCell({ record, isHoliday, isWeekend, onChange }: Props) {
  const [min, setMin] = useState(record.minstaff);
  const [max, setMax] = useState(record.maxstaff);

  function handleBlur() {
    if (min !== record.minstaff || max !== record.maxstaff) {
      onChange(record.id, min, max);
    }
  }

  const tag = getBezettingTag(min, max);
  const tagClass = getBezettingTagClass(min, max);
  const bgClass = isHoliday ? 'bg-red-50' : isWeekend ? 'bg-gray-50' : 'bg-white';

  return (
    <div className={`w-[60px] p-1 border-l border-gray-200 ${bgClass}`}>
      {/* MIN | MAX inputs */}
      <div className="flex items-center justify-center gap-1 mb-1">
        <input
          type="number"
          min={0}
          max={9}
          value={min}
          onChange={e => setMin(Number(e.target.value))}
          onBlur={handleBlur}
          className="w-6 h-6 text-center text-xs border border-gray-300 rounded"
        />
        <span className="text-gray-400 text-xs">|</span>
        <input
          type="number"
          min={0}
          max={9}
          value={max}
          onChange={e => setMax(Number(e.target.value))}
          onBlur={handleBlur}
          className="w-6 h-6 text-center text-xs border border-gray-300 rounded"
        />
      </div>

      {/* Auto-label */}
      <div
        className={`text-[9px] text-center px-1 py-0.5 rounded border ${tagClass}`}
        title={tag}
      >
        {tag}
      </div>
    </div>
  );
}
