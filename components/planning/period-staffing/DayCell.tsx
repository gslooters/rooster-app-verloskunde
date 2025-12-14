import { useState } from 'react';
import { RosterPeriodStaffingDagdeel, DEFAULT_AANTAL_PER_STATUS } from '@/lib/types/roster-period-staffing-dagdeel';
import { getBezettingTag, getBezettingTagClass } from '@/lib/utils/bezetting-tags';

interface Props {
  record: RosterPeriodStaffingDagdeel;
  isHoliday: boolean;
  isWeekend: boolean;
  onChange: (id: string, aantal: number) => void;
}

export function DayCell({ record, isHoliday, isWeekend, onChange }: Props) {
  const [aantal, setAantal] = useState(record.aantal);
  const [hasChanges, setHasChanges] = useState(false);

  function handleBlur() {
    if (aantal !== record.aantal) {
      onChange(record.id, aantal);
      setHasChanges(false);
    }
  }

  function handleAantalChange(value: number) {
    setAantal(value);
    setHasChanges(true);
  }

  // DRAAD176 FIX: Convert status STRING to min/max NUMBERS for getBezettingTag
  // record.status is DagdeelStatus string ('MOET' | 'MAG' | 'MAG_NIET' | 'AANGEPAST')
  // record.aantal is the actual number (0-9)
  // getBezettingTag expects (min: number, max: number)
  // DRAAD177: Added defensive check - DEFAULT_AANTAL_PER_STATUS now includes 'AANGEPAST'
  const statusMin = record.status === 'MAG_NIET' ? 0 : (DEFAULT_AANTAL_PER_STATUS[record.status] ?? 1);
  const statusMax = aantal;  // Current value is the max
  
  const tag = getBezettingTag(statusMin, statusMax);
  const tagClass = getBezettingTagClass(statusMin, statusMax);
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
      {/* AANTAL input */}
      <div className="flex items-center justify-center gap-1 mb-1.5">
        <input
          type="number"
          min={0}
          max={9}
          value={aantal}
          onChange={e => handleAantalChange(Number(e.target.value))}
          onBlur={handleBlur}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleBlur();
              e.currentTarget.blur();
            }
          }}
          className="w-7 h-7 text-center text-xs font-semibold border border-gray-300 rounded focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all hover:border-gray-400"
          title="Aantal medewerkers"
        />
      </div>

      {/* Auto-label */}
      <div
        className={`text-[9px] text-center px-1 py-1 rounded border font-semibold uppercase ${tagClass} transition-all`}
        title={`Status: ${record.status} (aantal: ${aantal})`}
      >
        {tag}
      </div>
    </div>
  );
}
