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
  const [hasChanges, setHasChanges] = useState(false);

  function handleBlur() {
    if (min !== record.minstaff || max !== record.maxstaff) {
      onChange(record.id, min, max);
      setHasChanges(false);
    }
  }

  function handleMinChange(value: number) {
    setMin(value);
    setHasChanges(true);
  }

  function handleMaxChange(value: number) {
    setMax(value);
    setHasChanges(true);
  }

  const tag = getBezettingTag(min, max);
  const tagClass = getBezettingTagClass(min, max);
  const bgClass = isHoliday 
    ? 'bg-red-50 hover:bg-red-100' 
    : isWeekend 
    ? 'bg-gray-50 hover:bg-gray-100' 
    : 'bg-white hover:bg-blue-50';

  return (
    <div 
      className={`w-[60px] p-1.5 border-l border-gray-200 transition-colors ${
        bgClass
      } ${
        hasChanges ? 'ring-2 ring-blue-400 ring-inset' : ''
      }`}
    >
      {/* MIN | MAX inputs */}
      <div className="flex items-center justify-center gap-1 mb-1.5">
        <input
          type="number"
          min={0}
          max={99}
          value={min}
          onChange={e => handleMinChange(Number(e.target.value))}
          onBlur={handleBlur}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleBlur();
              e.currentTarget.blur();
            }
          }}
          className="w-7 h-7 text-center text-xs font-semibold border border-gray-300 rounded focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all hover:border-gray-400"
          title="Minimum aantal medewerkers"
        />
        <span className="text-gray-400 text-xs font-bold">|</span>
        <input
          type="number"
          min={0}
          max={99}
          value={max}
          onChange={e => handleMaxChange(Number(e.target.value))}
          onBlur={handleBlur}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleBlur();
              e.currentTarget.blur();
            }
          }}
          className="w-7 h-7 text-center text-xs font-semibold border border-gray-300 rounded focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all hover:border-gray-400"
          title="Maximum aantal medewerkers"
        />
      </div>

      {/* Auto-label */}
      <div
        className={`text-[9px] text-center px-1 py-1 rounded border font-semibold uppercase ${tagClass} transition-all`}
        title={`Bezetting: ${tag} (min: ${min}, max: ${max})`}
      >
        {tag}
      </div>
    </div>
  );
}
