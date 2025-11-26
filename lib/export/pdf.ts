// PDF Export Utility using jsPDF + autoTable (iteration 4: NB via isAvailable, single service render in didDrawCell only)

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExportRoster, ExportEmployee } from './types';
import { isAvailable } from '@/app/planning/libAliases';
import { parseUTCDate, getUTCWeekNumber } from '@/lib/utils/date-utc';

const COLORS = {
  text: [33, 37, 41] as [number, number, number],
  headerBg: [236, 245, 243] as [number, number, number],
  headerText: [0, 0, 0] as [number, number, number],
  danger: [230, 57, 70] as [number, number, number],
};

function dayParts(iso: string) {
  const d = parseUTCDate(iso);
  const map = ['zo','ma','di','wo','do','vr','za'] as const;
  const dd = String(d.getUTCDate()).padStart(2,'0');
  const mm = String(d.getUTCMonth()+1).padStart(2,'0');
  return { dow: map[d.getUTCDay()], dd, mm };
}

function getWeekNumber(iso: string): number {
  const date = parseUTCDate(iso);
  const { week } = getUTCWeekNumber(date);
  return week;
}

function drawNBCell(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const [r, g, b] = COLORS.danger; doc.setDrawColor(r, g, b);
  for (let i = -h; i < w + h; i += 5) { doc.line(x + i, y, x + i + h, y + h); }
}

function footerTimestamp(doc: jsPDF) {
  const now = new Date(); const dd = String(now.getDate()).padStart(2,'0'); const mm = String(now.getMonth()+1).padStart(2,'0'); const yyyy = now.getFullYear(); const hh = String(now.getHours()).padStart(2,'0'); const mi = String(now.getMinutes()).padStart(2,'0');
  const text = `Geexporteerd: ${dd}-${mm}-${yyyy} ${hh}:${mi}`; const w = doc.internal.pageSize.getWidth(); const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8); doc.setTextColor(...COLORS.text); doc.text(text, w - 10, h - 6, { align: 'right' as any });
}

function setBold(doc: jsPDF, bold: boolean) { try { doc.setFont(undefined as any, bold ? 'bold' : 'normal'); } catch {} }

// TOTAL ROSTER
export function exportRosterToPDF(roster: ExportRoster): void {
  const doc = new jsPDF('landscape', 'mm', 'a4'); doc.setTextColor(...COLORS.text);
  doc.setFontSize(14); doc.text('Verloskunde Rooster', 12, 12);
  doc.setFontSize(10); doc.text(`Periode: ${roster.period}`, 12, 18);

  const header1 = ['Medewerker', ...roster.days.map(d => dayParts(d).dow)];
  const header2 = ['', ...roster.days.map(d => dayParts(d).dd)];
  const header3 = ['', ...roster.days.map(d => dayParts(d).mm)];

  // Body cells left empty; we'll render services in didDrawCell only
  const body = roster.employees.map(emp => [emp.name, ...roster.days.map(() => '')]);

  autoTable(doc, {
    head: [header1, header2, header3], body, startY: 24,
    styles: { fontSize: 7, cellPadding: 1.0, textColor: COLORS.text as any },
    headStyles: { fillColor: COLORS.headerBg as any, textColor: COLORS.headerText as any, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' } },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index > 0) {
        const day = roster.days[data.column.index - 1]; const emp = roster.employees[data.row.index];
        const avail = isAvailable(roster.id, emp.id, day); // definitive NB source
        const { x, y, width, height } = data.cell; if (!avail) drawNBCell(doc, x, y, width, height);

        // Single service render
        // Assume upstream grid uses `cells` map; where unavailable, service may be ''
        const svc = (roster as any).cells?.[day]?.[emp.id]?.service || '';
        if (svc && svc !== '-') { setBold(doc, true); doc.setTextColor(0,0,0); doc.text(String(svc), x + 1.2, y + height - 1.2); setBold(doc, false); doc.setTextColor(...COLORS.text); }
      }
    },
    margin: { left: 10, right: 10 },
  });

  // Week markers (optional vertical line before each Monday)
  // Not drawing extra lines here to avoid clutter; header shows weeks.
  let i = 0; let cursorX = 10 + 28; doc.setFontSize(8);
  const last = (doc as any).lastAutoTable; const colWidth = last?.columnStyles?.[1]?.cellWidth || 7;
  while (i < roster.days.length) { const w = getWeekNumber(roster.days[i]); let j = i + 1; while (j < roster.days.length && getWeekNumber(roster.days[j]) === w) j++; const span = j - i; const centerX = cursorX + (span * colWidth) / 2; doc.text(`Week ${w}`, centerX, 22, { align: 'center' as any }); cursorX += span * colWidth; i = j; }

  footerTimestamp(doc); doc.save(`Rooster_${roster.period.replace(/[^\w\s-]/g, '_')}.pdf`);
}

// EMPLOYEE ROSTER
export function exportEmployeeToPDF(roster: ExportRoster, employee: ExportEmployee): void {
  const doc = new jsPDF('landscape', 'mm', 'a4'); doc.setTextColor(...COLORS.text);
  doc.setFontSize(14); doc.text(`Rooster: ${employee.name}`, 12, 12); doc.setFontSize(10); doc.text(`Periode: ${roster.period}`, 12, 18);

  const weeks: { week: number; rows: { date: string; label: string }[] }[] = [];
  roster.days.forEach(d => { const w = getWeekNumber(d); const p = dayParts(d); const label = `${p.dow} ${p.dd}-${p.mm}`; let group = weeks.find(x => x.week === w); if (!group) { group = { week: w, rows: [] }; weeks.push(group); } group.rows.push({ date: d, label }); });

  const head = [weeks.map(w => `Week ${w.week}`)]; const maxRows = Math.max(...weeks.map(w => w.rows.length)); const body: string[][] = [];
  for (let r = 0; r < maxRows; r++) { const row: string[] = []; weeks.forEach(w => { const it = w.rows[r]; row.push(it ? it.label : ''); }); body.push(row); }

  autoTable(doc, {
    head, body, startY: 24, styles: { fontSize: 9, cellPadding: 1.2, textColor: COLORS.text as any }, headStyles: { fillColor: COLORS.headerBg as any, textColor: COLORS.headerText as any, fontStyle: 'bold' }, margin: { left: 10, right: 10 },
    didDrawCell: (data) => {
      if (data.section === 'body') { const weekIndex = data.column.index; const rowIndex = data.row.index; const row = weeks[weekIndex]?.rows[rowIndex]; if (!row) return; const { x, y, width, height } = data.cell;
        const avail = isAvailable(roster.id, employee.id, row.date); if (!avail) drawNBCell(doc, x, y, width, height);
        const svc = (roster as any).cells?.[row.date]?.[employee.id]?.service || '';
        if (svc && svc !== '-') { setBold(doc, true); doc.setTextColor(0,0,0); doc.text(String(svc), x + width - 2, y + height - 1.2, { align: 'right' as any }); setBold(doc, false); doc.setTextColor(...COLORS.text); }
      }
    }
  });

  footerTimestamp(doc); doc.save(`Rooster_${employee.name}_${roster.period.replace(/[^\w\s-]/g, '_')}.pdf`);
}