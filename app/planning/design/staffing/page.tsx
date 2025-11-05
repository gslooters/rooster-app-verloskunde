'use client';

import React from 'react';
import StaffingManager from '../_components/StaffingManager';
import { getRosters } from '../libAliases';

export default function DesignStaffingPage({ searchParams }: { searchParams: { rosterId?: string; start?: string } }) {
  const rosterId = searchParams.rosterId || '';
  const rosters = getRosters() as any[];
  const roster = rosters.find(r => r.id === rosterId);
  if (!roster) return <div className="p-6 text-red-600">Geen rooster gevonden.</div>;

  return (
    <StaffingManager
      rosterId={rosterId}
      rosterPeriod={`${roster.start_date} t/m ${roster.end_date}`}
      startDate={roster.start_date}
      onClose={() => { window.location.href = `/planning/design?rosterId=${rosterId}`; }}
      onLocked={() => { window.location.href = `/planning/design?rosterId=${rosterId}`; }}
    />
  );
}
