// Excel Export Utility using SheetJS

import * as XLSX from 'xlsx';
import { ExportRoster, ServiceConfig } from './types';

const SERVICES: ServiceConfig[] = [
  { code: 's', label: 'Shift (24u)', color: '#8B5CF6' },
  { code: 'd', label: 'Dag', color: '#3B82F6' },
  { code: 'sp', label: 'Spreekuur', color: '#059669' },
  { code: 'echo', label: 'Echoscopie', color: '#EA580C' },
  { code: 'vrij', label: 'Vrij', color: '#FEF3C7' },
  { code: '-', label: '—', color: '#FFFFFF' },
];

function formatDate(iso: string): string {
  const date = new Date(iso + 'T00:00:00');
  const dayNames = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA'];
  const dayShort = dayNames[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dayShort}\n${dd}-${mm}`;
}

function getWeekNumber(iso: string): number {
  const date = new Date(iso + 'T00:00:00');
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const ftDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - ftDay + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

export function exportToExcel(roster: ExportRoster): void {
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Prepare data matrix
  const data: (string | number)[][] = [];
  
  // Header row 1: Week numbers
  const weekHeader = [''];
  let currentWeek = -1;
  let weekSpan = 0;
  
  roster.days.forEach((day, index) => {
    const week = getWeekNumber(day);
    if (week !== currentWeek) {
      if (currentWeek !== -1) {
        // Fill previous week span
        for (let i = 0; i < weekSpan; i++) {
          if (i === Math.floor(weekSpan / 2)) {
            weekHeader.push(`Week ${currentWeek}`);
          } else {
            weekHeader.push('');
          }
        }
      }
      currentWeek = week;
      weekSpan = 1;
    } else {
      weekSpan++;
    }
    
    // Handle last week
    if (index === roster.days.length - 1) {
      for (let i = 0; i < weekSpan; i++) {
        if (i === Math.floor(weekSpan / 2)) {
          weekHeader.push(`Week ${currentWeek}`);
        } else {
          weekHeader.push('');
        }
      }
    }
  });
  
  data.push(weekHeader);
  
  // Header row 2: Day headers
  const dayHeader = ['Medewerker'];
  roster.days.forEach(day => {
    dayHeader.push(formatDate(day));
  });
  data.push(dayHeader);
  
  // Employee rows
  roster.employees.forEach(emp => {
    const row = [emp.name];
    roster.days.forEach(day => {
      const cell = roster.cells[day]?.[emp.id];
      const service = cell?.service || '';
      row.push(service === '-' ? '' : service);
    });
    data.push(row);
  });
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Apply styling (basic coloring)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  // Set column widths
  const colWidths = [{ width: 15 }]; // Employee name column
  roster.days.forEach(() => colWidths.push({ width: 8 })); // Day columns
  ws['!cols'] = colWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Rooster');
  
  // Download file
  const filename = `Rooster_${roster.period.replace(/[^\w\s-]/g, '_')}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportToCSV(roster: ExportRoster): void {
  const data: string[][] = [];
  
  // Header
  const header = ['Medewerker'];
  roster.days.forEach(day => {
    header.push(formatDate(day).replace('\n', ' '));
  });
  data.push(header);
  
  // Employee rows
  roster.employees.forEach(emp => {
    const row = [emp.name];
    roster.days.forEach(day => {
      const cell = roster.cells[day]?.[emp.id];
      const service = cell?.service || '';
      row.push(service === '-' ? '' : service);
    });
    data.push(row);
  });
  
  // Convert to CSV
  const csvContent = data.map(row => 
    row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `Rooster_${roster.period.replace(/[^\w\s-]/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}