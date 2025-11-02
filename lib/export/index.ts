// Export Library Main Index

export * from './types';
export * from './excel';
export * from './pdf';

// Statistics Calculator
import { ExportRoster, ExportStats } from './types';

export function calculateStats(roster: ExportRoster): ExportStats {
  const employeeStats: Record<string, Record<string, number>> = {};
  const dailyOccupancy: Record<string, { occupied: number; total: number }> = {};
  const serviceBreakdown: Record<string, number> = {};
  
  // Initialize employee stats
  roster.employees.forEach(emp => {
    employeeStats[emp.id] = {};
  });
  
  // Process each day
  roster.days.forEach(day => {
    let occupied = 0;
    const total = roster.employees.length;
    
    roster.employees.forEach(emp => {
      const cell = roster.cells[day]?.[emp.id];
      const service = cell?.service || '';
      
      if (service && service !== '-' && service !== '') {
        occupied++;
        
        // Employee stats
        if (!employeeStats[emp.id][service]) {
          employeeStats[emp.id][service] = 0;
        }
        employeeStats[emp.id][service]++;
        
        // Service breakdown
        if (!serviceBreakdown[service]) {
          serviceBreakdown[service] = 0;
        }
        serviceBreakdown[service]++;
      }
    });
    
    dailyOccupancy[day] = { occupied, total };
  });
  
  return {
    employeeStats,
    dailyOccupancy,
    serviceBreakdown
  };
}

// Convert roster data from PlanningGrid format to ExportRoster
export function prepareRosterForExport(
  roster: { id: string; start_date: string; end_date: string; status: string },
  employees: { id: string; name: string }[],
  days: string[],
  cells: Record<string, Record<string, { service: string | null; locked: boolean }>>
): ExportRoster {
  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const format = (d: Date) => 
      `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    return `${format(startDate)} t/m ${format(endDate)}`;
  };
  
  return {
    id: roster.id,
    start_date: roster.start_date,
    end_date: roster.end_date,
    period: formatPeriod(roster.start_date, roster.end_date),
    employees: employees.map(emp => ({ id: emp.id, name: emp.name })),
    days,
    cells
  };
}