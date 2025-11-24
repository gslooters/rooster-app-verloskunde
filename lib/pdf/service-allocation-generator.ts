// ============================================================================
// DRAAD53 - PDF GENERATOR: SERVICE ALLOCATION (IMPROVED LAYOUT)
// Purpose: Generate PDF for service allocation per team per day per dagdeel
// Format: A4 Portrait, one week per page with improved colors and layout
// ============================================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ServiceBlock {
  code: string;
  status: string;
  aantal: number;
}

interface DayData {
  [team: string]: {
    [dagdeel: string]: ServiceBlock[];
  };
}

interface PDFData {
  [date: string]: DayData;
}

interface RosterInfo {
  naam?: string;
  start_date: string;
  end_date: string;
}

// ============================================================================
// CONSTANTS - DIENST & TEAM KLEUREN (UIT IMAGE)
// ============================================================================

const TEAMS = ['GRO', 'ORA', 'TOT'];
const TEAM_LABELS: { [key: string]: string } = {
  GRO: 'Groen',
  ORA: 'Oranje',
  TOT: 'Praktijk'
};

// Team kleuren (RGB values from image)
const TEAM_COLORS: { [key: string]: [number, number, number] } = {
  GRO: [40, 167, 69],      // Green #28a745
  ORA: [255, 152, 0],      // Orange #ff9800
  TOT: [33, 150, 243]      // Blue #2196f3
};

// Dienst codes met kleuren (RGB values from image table)
const SERVICE_COLORS: { [key: string]: [number, number, number] } = {
  DDA: [44, 62, 80],       // Donkerblauw #2c3e50
  DDO: [233, 30, 140],     // Magenta #e91e8c
  DJA: [155, 89, 182],     // Paars #9b59b6
  DJO: [241, 196, 15],     // Geel #f1c40f
  ECH: [177, 156, 217],    // Lichtpaars #b19cd9
  GRB: [230, 126, 34],     // Oranje #e67e22
  MSP: [93, 173, 226],     // Blauw #5dade2
  OSP: [93, 173, 226]      // Blauw #5dade2
};

const DAGDELEN = ['O', 'M', 'A'];
const DAGDEEL_LABELS: { [key: string]: string } = {
  O: 'Ochtend',
  M: 'Middag',
  A: 'Avond/Nacht'
};

const WEEKDAYS = [
  'Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'
];

const WEEKDAYS_FULL = [
  'Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 
  'Donderdag', 'Vrijdag', 'Zaterdag'
];

const MONTHS = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec'
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const weekday = WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${weekday} ${day} ${month}`;
}

function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const weekday = WEEKDAYS_FULL[date.getDay()];
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${weekday} ${day}/${month}/${year}`;
}

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  const target = new Date(date.valueOf());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function groupByWeek(data: PDFData): { [weekKey: string]: string[] } {
  const weeks: { [weekKey: string]: string[] } = {};
  
  Object.keys(data).sort().forEach(dateStr => {
    const weekNum = getWeekNumber(dateStr);
    const date = new Date(dateStr + 'T00:00:00');
    const year = date.getFullYear();
    const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;
    
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(dateStr);
  });
  
  return weeks;
}

function getTextColor(bgColor: [number, number, number]): [number, number, number] {
  // Calculate relative luminance
  const [r, g, b] = bgColor.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  
  // Return white text for dark backgrounds, black for light
  return luminance > 0.5 ? [0, 0, 0] : [255, 255, 255];
}

// ============================================================================
// PDF GENERATION
// ============================================================================

export function generateServiceAllocationPDF(
  rosterInfo: RosterInfo,
  data: PDFData
): jsPDF {
  // Initialize PDF in PORTRAIT mode for better one-week layout
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Page dimensions (A4 portrait)
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12; // Smaller margin for more space

  // Group dates by week
  const weekGroups = groupByWeek(data);
  const weekKeys = Object.keys(weekGroups).sort();

  let isFirstPage = true;

  // Generate one page per week
  weekKeys.forEach((weekKey, weekIndex) => {
    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    const dates = weekGroups[weekKey];
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const weekNum = getWeekNumber(firstDate);

    // ========================================================================
    // HEADER - Week nummer prominent weergeven
    // ========================================================================
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`Week ${weekNum}`, margin, margin + 8);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodText = `${formatDateLong(firstDate)} - ${formatDateLong(lastDate)}`;
    doc.text(periodText, margin, margin + 15);

    let currentY = margin + 22;

    // ========================================================================
    // TABLE: Diensten overzicht per dag
    // ========================================================================
    
    const tableData: any[] = [];
    const sortedDates = dates.sort();

    sortedDates.forEach(dateStr => {
      const dayData = data[dateStr];
      const dateLabel = formatDateShort(dateStr);
      
      TEAMS.forEach((team, teamIndex) => {
        const row: any = {};
        
        // First column: Date (only for first team of each day)
        if (teamIndex === 0) {
          row.date = dateLabel;
        } else {
          row.date = '';
        }
        
        // Second column: Team with color
        row.team = TEAM_LABELS[team];
        row.teamColor = TEAM_COLORS[team];
        
        // Dagdelen columns
        DAGDELEN.forEach(dagdeel => {
          const services = dayData[team]?.[dagdeel] || [];
          const serviceTexts: string[] = [];
          const serviceCodes: string[] = [];
          
          services.forEach(s => {
            serviceTexts.push(`${s.code} (${s.aantal})`);
            serviceCodes.push(s.code);
          });
          
          row[dagdeel] = serviceTexts.join('\n');
          row[`${dagdeel}_codes`] = serviceCodes;
        });
        
        tableData.push(row);
      });
    });

    // Generate compact table
    autoTable(doc, {
      startY: currentY,
      head: [[
        { content: 'Datum', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'Team', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'Ochtend', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'Middag', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'Avond/Nacht', styles: { halign: 'center', fontStyle: 'bold' } }
      ]],
      body: tableData.map((row: any) => [
        row.date,
        row.team,
        row.O || '',
        row.M || '',
        row.A || ''
      ]),
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
        halign: 'left',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [66, 66, 66],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 25, fontStyle: 'bold', halign: 'center' },
        1: { cellWidth: 25, fontStyle: 'bold' },
        2: { cellWidth: 45 },
        3: { cellWidth: 45 },
        4: { cellWidth: 45 }
      },
      margin: { left: margin, right: margin },
      didParseCell: function(data: any) {
        const rowData = tableData[data.row.index];
        if (!rowData) return;
        
        // Color team cells
        if (data.column.index === 1 && rowData.teamColor) {
          data.cell.styles.fillColor = rowData.teamColor;
          data.cell.styles.textColor = getTextColor(rowData.teamColor);
        }
        
        // Color service cells based on first service code
        if (data.column.index >= 2 && data.column.index <= 4) {
          const dagdeel = DAGDELEN[data.column.index - 2];
          const codes = rowData[`${dagdeel}_codes`] || [];
          
          if (codes.length > 0) {
            const firstCode = codes[0];
            const color = SERVICE_COLORS[firstCode];
            
            if (color) {
              data.cell.styles.fillColor = color;
              data.cell.styles.textColor = getTextColor(color);
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      }
    });

    // ========================================================================
    // FOOTER
    // ========================================================================
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const now = new Date();
    const printTime = `Gegenereerd: ${now.toLocaleDateString('nl-NL')} ${now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(printTime, margin, pageHeight - 8);
    doc.text(`Rooster: ${formatDateLong(rosterInfo.start_date)} - ${formatDateLong(rosterInfo.end_date)}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  });

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
