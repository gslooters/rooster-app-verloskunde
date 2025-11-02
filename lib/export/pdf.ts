// PDF Export Utility using jsPDF + autoTable (iteration 2: align with blue feedback)

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExportRoster, ExportEmployee } from './types';

const COLORS = {
  text: [33, 37, 41] as [number, number, number],
  header: [236, 245, 243] as [number, number, number],
  danger: [230, 57, 70] as [number, number, number],
};

const SERVICE_COLORS: Record<string, [number, number, number]> = {
  s: [139, 92, 246],
  d: [59, 130, 246],
  sp: [5, 150, 105],
  echo: [234, 88, 12],
  vrij: [180, 140, 20],
};

function dayParts(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const map = ['zo','ma','di','wo','do','vr','za'] as const;
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return { dow: map[d.getDay()], dd, mm };
}

function dayLabel1(iso: string) {
  const { dow } = dayParts(iso);
  return dow;
}
function dayLabel2(iso: string) {
  const { dd } = dayParts(iso);
  return dd;
}
function dayLabel3(iso: string) {
  const { mm } = dayParts(iso);
  return mm;
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

function drawNBCell(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const [r, g, b] = COLORS.danger;
  doc.setDrawColor(r, g, b);
  for (let i = -h; i < w + h; i += 5) {
    doc.line(x + i, y, x + i + h, y + h);
  }
}

function footerTimestamp(doc: jsPDF) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2,'0');
  const mm = String(now.getMonth()+1).padStart(2,'0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2,'0');
  const mi = String(now.getMinutes()).padStart(2,'0');
  const text = `Geexporteerd: ${dd}-${mm}-${yyyy} ${hh}:${mi}`;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.text(text, w - 10, h - 6, { align: 'right' });
}

// TOTAL ROSTER
export function exportRosterToPDF(roster: ExportRoster): void {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  doc.setTextColor(...COLORS.text);

  doc.setFontSize(14); doc.text('Verloskunde Rooster', 12, 12);
  doc.setFontSize(10); doc.text(`Periode: ${roster.period}`, 12, 18);

  // 3-lijns dagkop per kolom
  const head = [[
    'Medewerker',
    ...roster.days.map(d => dayLabel1(d))
  ], [
    '',
    ...roster.days.map(d => dayLabel2(d))
  ], [
    '',
    ...roster.days.map(d => dayLabel3(d))
  ]];

  const body = roster.employees.map(emp => (
    [emp.name, ...roster.days.map(d => {
      const cell = roster.cells[d]?.[emp.id];
      if (!cell) return '';
      const svc = cell.service && cell.service !== '-' ? (cell.service.length > 3 ? cell.service.slice(0,3) : cell.service) : '';
      return svc;
    })]
  ));

  autoTable(doc, {
    head,
    body,
    startY: 24,
    styles: { fontSize: 7, cellPadding: 1.4 },
    headStyles: { fillColor: COLORS.header as any, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' } },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index > 0) {
        const day = roster.days[data.column.index - 1];
        const emp = roster.employees[data.row.index];
        const cell = roster.cells[day]?.[emp.id];
        if (!cell) return;
        const { x, y, width, height } = data.cell;
        if (cell.unavailable) drawNBCell(doc, x, y, width, height);
        const code = cell.service && cell.service !== '-' ? (cell.service.length>3?cell.service.slice(0,3):cell.service) : '';
        if (code) {
          const rgb = SERVICE_COLORS[code as keyof typeof SERVICE_COLORS] || SERVICE_COLORS.d;
          doc.setFont(undefined, 'bold');
          doc.setTextColor(rgb[0], rgb[1], rgb[2]);
          doc.text(code, x + 1.2, y + height - 1.2);
          doc.setTextColor(...COLORS.text);
          doc.setFont(undefined, 'normal');
        }
      }
    },
    margin: { left: 10, right: 10 },
  });

  // Weeklabels boven kolommen
  let i = 0; let cursorX = 10 + 28; doc.setFontSize(8);
  const last = (doc as any).lastAutoTable; const colWidth = last?.columnStyles?.[1]?.cellWidth || 7;
  while (i < roster.days.length) {
    const w = getWeekNumber(roster.days[i]);
    let j = i + 1; while (j < roster.days.length && getWeekNumber(roster.days[j]) === w) j++;
    const span = j - i; const centerX = cursorX + (span * colWidth) / 2;
    doc.text(`Week ${w}`, centerX, 22, { align: 'center' });
    cursorX += span * colWidth; i = j;
  }

  footerTimestamp(doc);
  const filename = `Rooster_${roster.period.replace(/[^\w\s-]/g, '_')}.pdf`;
  doc.save(filename);
}

// EMPLOYEE ROSTER
export function exportEmployeeToPDF(roster: ExportRoster, employee: ExportEmployee): void {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(14); doc.text(`Rooster: ${employee.name}`, 12, 12);
  doc.setFontSize(10); doc.text(`Periode: ${roster.period}`, 12, 18);

  // We build rows: for each day -> one row "ma 24-11  svc"
  const weeks: { week: number; rows: { label: string; svc: string; unavailable?: boolean }[] }[] = [];
  roster.days.forEach(d => {
    const w = getWeekNumber(d);
    const parts = dayParts(d);
    const label = `${parts.dow} ${parts.dd}-${parts.mm}`;
    const cell = roster.cells[d]?.[employee.id];
    const svc = cell?.service && cell.service !== '-' ? (cell.service.length>3?cell.service.slice(0,3):cell.service) : '';
    let group = weeks.find(x => x.week === w); if (!group) { group = { week: w, rows: [] }; weeks.push(group); }
    group.rows.push({ label, svc, unavailable: cell?.unavailable });
  });

  const head = [weeks.map(w => `Week ${w.week}`)];
  const maxRows = Math.max(...weeks.map(w => w.rows.length));
  const body: string[][] = [];
  for (let r = 0; r < maxRows; r++) {
    const row: string[] = [];
    weeks.forEach(w => { const it = w.rows[r]; row.push(it ? `${it.label}${it.svc? '  '+it.svc : ''}` : ''); });
    body.push(row);
  }

  autoTable(doc, {
    head,
    body,
    startY: 24,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: COLORS.header as any, fontStyle: 'bold' },
    margin: { left: 10, right: 10 },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        const weekIndex = data.column.index; const rowIndex = data.row.index;
        const it = weeks[weekIndex]?.rows[rowIndex]; if (!it) return; const { x, y, width, height } = data.cell;
        if (it.unavailable) drawNBCell(doc, x, y, width, height);
        if (it.svc) {
          const rgb = SERVICE_COLORS[it.svc as keyof typeof SERVICE_COLORS] || SERVICE_COLORS.d;
          doc.setFont(undefined, 'bold'); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
          // Overwrite right side with colored svc (right aligned)
          doc.text(it.svc, x + width - 2, y + height - 1.5, { align: 'right' });
          doc.setTextColor(...COLORS.text); doc.setFont(undefined, 'normal');
        }
      }
    }
  });

  footerTimestamp(doc);
  const filename = `Rooster_${employee.name}_${roster.period.replace(/[^\w\s-]/g, '_')}.pdf`;
  doc.save(filename);
}
