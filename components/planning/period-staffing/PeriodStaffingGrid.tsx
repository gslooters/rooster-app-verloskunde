'use client';
// components/planning/period-staffing/PeriodStaffingGrid.tsx
import { useEffect, useState } from 'react';
import { getRosterPeriodStaffing, generateRosterPeriodStaffing, RosterPeriodStaffing } from '@/lib/planning/roster-period-staffing-storage';
import { getFallbackHolidays } from '@/lib/data/dutch-holidays-fallback';
import { WeekHeader } from './WeekHeader';
import { ServiceRow } from './ServiceRow';

interface Props {
  rosterId: string;
  startDate: string;
  endDate: string;
}

export function PeriodStaffingGrid({ rosterId, startDate, endDate }: Props) {
  const [staffing, setStaffing] = useState<RosterPeriodStaffing[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Genereer 35-dagen array
  const days: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split('T')[0]);
  }

  useEffect(() => {
    async function init() {
      await generateRosterPeriodStaffing(rosterId, startDate, endDate);
      const records = await getRosterPeriodStaffing(rosterId);
      const holidayList = await getFallbackHolidays(startDate, endDate);
      setStaffing(records);
      setHolidays(holidayList);
      setLoading(false);
    }
    init();
  }, [rosterId, startDate, endDate]);

  // Groepeer per dienst
  const serviceGroups: Record<string, RosterPeriodStaffing[]> = {};
  staffing.forEach(entry => {
    if (!serviceGroups[entry.serviceid]) serviceGroups[entry.serviceid] = [];
    serviceGroups[entry.serviceid].push(entry);
  });

  function handleUpdate(id: string, updates: Partial<RosterPeriodStaffing>) {
    setStaffing(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }

  if (loading) return <div className="p-8 text-lg">Bezetting laden...</div>;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[2400px]">
        {/* 3-niveau header */}
        <WeekHeader days={days} holidays={holidays} />
        
        {/* Dienst rijen */}
        <div className="border-t border-gray-300">
          {Object.entries(serviceGroups).map(([serviceId, records]) => (
            <ServiceRow
              key={serviceId}
              serviceId={serviceId}
              records={records}
              days={days}
              holidays={holidays}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
