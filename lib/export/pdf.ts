// PDF Export Utility using jsPDF + autoTable

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExportRoster, ExportEmployee } from './types';

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

// Export complete roster - A4 Landscape
export function exportRosterToPDF(roster: ExportRoster): void {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  // Title
  doc.setFontSize(16);
  doc.text('Verloskunde Rooster', 20, 20);
  doc.setFontSize(12);
  doc.text(`Periode: ${roster.period}`, 20, 30);
  
  // Prepare table data
  const tableData: string[][] = [];
  
  // Header with week numbers
  const weekHeaders: string[] = [''];
  const dayHeaders: string[] = ['Medewerker'];
  
  let currentWeek = -1;
  let weekSpan = 0;
  const weekPositions: { week: number; start: number; span: number }[] = [];
  
  roster.days.forEach((day, index) => {
    const week = getWeekNumber(day);
    if (week !== currentWeek) {
      if (currentWeek !== -1) {
        weekPositions.push({ week: currentWeek, start: weekHeaders.length - weekSpan, span: weekSpan });
      }
      currentWeek = week;
      weekSpan = 1;
    } else {
      weekSpan++;
    }
    
    weekHeaders.push('');
    dayHeaders.push(formatDate(day).replace('\n', ' '));
    
    if (index === roster.days.length - 1) {
      weekPositions.push({ week: currentWeek, start: weekHeaders.length - weekSpan, span: weekSpan });
    }
  });
  
  // Employee data rows
  roster.employees.forEach(emp => {
    const row = [emp.name];
    roster.days.forEach(day => {
      const cell = roster.cells[day]?.[emp.id];
      const service = cell?.service || '';
      row.push(service === '-' ? '' : service);
    });
    tableData.push(row);
  });
  
  // Create table
  autoTable(doc, {
    head: [dayHeaders],
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 25, fontStyle: 'bold' }, // Employee name column
    },
    margin: { left: 10, right: 10 },
    tableWidth: 'auto',
  });
  
  // Add week headers manually (simplified approach)
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  weekPositions.forEach(weekPos => {
    const x = 35 + (weekPos.start - 1) * 7 + (weekPos.span * 7) / 2;
    doc.text(`Week ${weekPos.week}`, x, 35, { align: 'center' });
  });
  
  // Download
  const filename = `Rooster_${roster.period.replace(/[^\w\s-]/g, '_')}.pdf`;
  doc.save(filename);
}

// Export individual employee roster - A4 Landscape
export function exportEmployeeToPDF(roster: ExportRoster, employee: ExportEmployee): void {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  // Title
  doc.setFontSize(16);
  doc.text(`Rooster: ${employee.name}`, 20, 20);
  doc.setFontSize(12);
  doc.text(`Periode: ${roster.period}`, 20, 30);
  
  // Group days by week
  const weekGroups: { week: number; days: { date: string; dayName: string; service: string }[] }[] = [];
  let currentWeekGroup: { week: number; days: { date: string; dayName: string; service: string }[] } | null = null;
  
  roster.days.forEach(day => {
    const week = getWeekNumber(day);
    const date = new Date(day + 'T00:00:00');
    const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    const dayName = dayNames[date.getDay()];
    const dateShort = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const cell = roster.cells[day]?.[employee.id];
    const service = cell?.service || '-';
    
    if (!currentWeekGroup || currentWeekGroup.week !== week) {
      currentWeekGroup = { week, days: [] };
      weekGroups.push(currentWeekGroup);
    }
    
    currentWeekGroup.days.push({ date: dateShort, dayName, service });
  });
  
  // Create table data
  const tableData: string[][] = [];
  weekGroups.forEach(weekGroup => {
    weekGroup.days.forEach((day, index) => {
      const weekLabel = index === 0 ? `Week ${weekGroup.week}` : '';
      tableData.push([weekLabel, day.dayName, day.date, day.service === '-' ? '' : day.service]);
    });
  });
  
  // Create table
  autoTable(doc, {
    head: [['Week', 'Dagsoort', 'Datum', 'Dienst']],
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 20 }, // Week
      1: { cellWidth: 30 }, // Dagsoort  
      2: { cellWidth: 25 }, // Datum
      3: { cellWidth: 30 }, // Dienst
    },
    margin: { left: 20 },
  });
  
  // Download
  const filename = `Rooster_${employee.name}_${roster.period.replace(/[^\w\s-]/g, '_')}.pdf`;
  doc.save(filename);
}