// PDF Export Utility using jsPDF + autoTable (improved layouts)

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExportRoster, ExportEmployee } from './types';

// Colors (aligned to softer healthcare palette)
const COLORS = {
  text: [33, 37, 41] as [number, number, number],
  grayLight: [245, 247, 250] as [number, number, number],
  header: [236, 245, 243] as [number, number, number], // soft teal tint
  line: [220, 226, 230] as [number, number, number],
  danger: [230, 57, 70] as [number, number, number],
};

const SERVICE_COLORS: Record<string, [number, number, number]> = {
  s: [139, 92, 246], // paars
  d: [59, 130, 246], // blauw
  sp: [5, 150, 105], // groen
  echo: [234, 88, 12], // oranje
  vrij: [254, 243, 199], // lichtgeel achtergrond (we gebruiken alleen textkleur hier)
};

function dayLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const map = ['zo','ma','di','wo','do','vr','za'] as const;
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return `${map[d.getDay()]} ${dd}-${mm}`; // ma 24-11
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

// Draw NB diagonal hatch for unavailable
function drawNBCell(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const [r, g, b] = COLORS.danger;
  doc.setDrawColor(r, g, b);
  for (let i = -h; i < w + h; i += 5) {
    doc.line(x + i, y, x + i + h, y + h);
  }
}

// Export complete roster - A4 Landscape, compact grid
export function exportRosterToPDF(roster: ExportRoster): void {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  doc.setTextColor(...COLORS.text);

  // Title
  doc.setFontSize(14);
  doc.text('Verloskunde Rooster', 12, 12);
  doc.setFontSize(10);
  doc.text(`Periode: ${roster.period}`, 12, 18);

  // Header row: medewerker + days
  const head = [[
    'Medewerker',
    ...roster.days.map(d => dayLabel(d))
  ]];

  // Body rows
  const body = roster.employees.map(emp => (
    [emp.name, ...roster.days.map(d => {
      const cell = roster.cells[d]?.[emp.id];
      if (!cell) return '';
      const v = cell.service === '-' ? '' : (cell.service || '');
      return v;
    })]
  ));

  autoTable(doc, {
    head,
    body,
    startY: 24,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: COLORS.header as any, textColor: COLORS.text as any },
    columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' } },
    didDrawCell: (data) => {
      // Colorize services and draw NB hatch
      if (data.section === 'body' && data.column.index > 0) {
        const day = roster.days[data.column.index - 1];
        const emp = roster.employees[data.row.index];
        const cell = roster.cells[day]?.[emp.id];
        if (!cell) return;

        const { x, y, width, height } = data.cell;
        if (cell.unavailable) {
          drawNBCell(doc, x, y, width, height);
        }
        const code = cell.service || '';
        const rgb = SERVICE_COLORS[code as keyof typeof SERVICE_COLORS];
        if (rgb) {
          doc.setTextColor(rgb[0], rgb[1], rgb[2]);
          doc.text(code, x + 1.5, y + height - 1.5);
          doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
        }
      }
    },
    margin: { left: 10, right: 10 },
  });

  // Week numbers above columns
  let x = 10 + 28; // start after first column
  let i = 0;
  doc.setFontSize(8);
  // Estimate column width from autoTable state (fallback 7)
  const last = (doc as any).lastAutoTable;
  const colWidth = last?.columnStyles?.[1]?.cellWidth || 7;
  while (i < roster.days.length) {
    const w = getWeekNumber(roster.days[i]);
    let j = i + 1;
    while (j < roster.days.length && getWeekNumber(roster.days[j]) === w) j++;
    const span = j - i;
    const centerX = x + (span * colWidth) / 2;
    doc.text(`Week ${w}`, centerX, 22, { align: 'center' });
    x += span * colWidth; i = j;
  }

  const filename = `Rooster_${roster.period.replace(/[^\w\s-]/g, '_')}.pdf`;
  doc.save(filename);
}

// Export individual employee - A4 Landscape, 5 weeks as columns
export function exportEmployeeToPDF(roster: ExportRoster, employee: ExportEmployee): void {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  doc.setTextColor(...COLORS.text);

  doc.setFontSize(14);
  doc.text(`Rooster: ${employee.name}`, 12, 12);
  doc.setFontSize(10);
  doc.text(`Periode: ${roster.period}`, 12, 18);

  // Build per-week columns
  const weeks: { week: number; rows: { label: string; svc: string; unavailable?: boolean }[] }[] = [];
  roster.days.forEach(d => {
    const w = getWeekNumber(d);
    const label = dayLabel(d);
    const cell = roster.cells[d]?.[employee.id];
    const svc = cell?.service && cell.service !== '-' ? cell.service : '';
    let group = weeks.find(x => x.week === w);
    if (!group) { group = { week: w, rows: [] }; weeks.push(group); }
    group.rows.push({ label, svc, unavailable: cell?.unavailable });
  });

  const head = [weeks.map(w => `Week ${w.week}`)];
  const body: string[][] = [];
  for (let r = 0; r < 7; r++) {
    const row: string[] = [];
    weeks.forEach(w => {
      const it = w.rows[r];
      row.push(it ? `${it.label}` : '');
    });
    body.push(row);
    const rowSvc: string[] = [];
    weeks.forEach(w => {
      const it = w.rows[r];
      rowSvc.push(it ? (it.svc || '') : '');
    });
    body.push(rowSvc);
  }

  autoTable(doc, {
    head,
    body,
    startY: 24,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: COLORS.header as any, textColor: COLORS.text as any, fontStyle: 'bold' },
    margin: { left: 10, right: 10 },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        const rowIndex = data.row.index;
        const isSvcRow = rowIndex % 2 === 1; // even=labels, odd=service codes
        const weekIndex = data.column.index;
        const itemIndex = Math.floor(rowIndex / 2);
        const week = weeks[weekIndex];
        const it = week?.rows[itemIndex];
        if (!it) return;
        const { x, y, width, height } = data.cell;
        if (!isSvcRow && it.unavailable) {
          drawNBCell(doc, x, y, width, height);
        }
        if (isSvcRow && it.svc) {
          const rgb = SERVICE_COLORS[it.svc as keyof typeof SERVICE_COLORS];
          if (rgb) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); doc.text(it.svc, x + 1.5, y + height - 1.5); doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]); }
        }
      }
    }
  });

  const filename = `Rooster_${employee.name}_${roster.period.replace(/[^\w\s-]/g, '_')}.pdf`;
  doc.save(filename);
}
