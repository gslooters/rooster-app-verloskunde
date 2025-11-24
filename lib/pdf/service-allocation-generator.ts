// ============================================================================
// DRAAD48 - PDF GENERATOR: SERVICE ALLOCATION
// Purpose: Generate PDF for service allocation per team per day per dagdeel
// Format: A4 Landscape, one week per page
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
// CONSTANTS
// ============================================================================

const TEAMS = ['GRO', 'ORA', 'TOT'];
const TEAM_LABELS: { [key: string]: string } = {
  GRO: 'Groen',
  ORA: 'Oranje',
  TOT: 'Praktijk'
};

const DAGDELEN = ['O', 'M', 'A'];
const DAGDEEL_LABELS: { [key: string]: string } = {
  O: 'Ochtend',
  M: 'Middag',
  A: 'Avond/Nacht'
};

const STATUS_COLORS: { [key: string]: string } = {
  MOET: '🔴',
  MAG: '🟢',
  AANGEPAST: '🔵'
};

const WEEKDAYS = [
  'Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 
  'Donderdag', 'Vrijdag', 'Zaterdag'
];

const MONTHS = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const weekday = WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
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

function formatServiceCell(services: ServiceBlock[]): string {
  if (!services || services.length === 0) return '';
  
  return services.map(s => {
    const emoji = STATUS_COLORS[s.status] || '⚪';
    return `${s.code} ${emoji} ${s.aantal}`;
  }).join('  ');
}

// ============================================================================
// PDF GENERATION
// ============================================================================

export function generateServiceAllocationPDF(
  rosterInfo: RosterInfo,
  data: PDFData
): jsPDF {
  // Initialize PDF in landscape mode
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Page dimensions (A4 landscape)
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 20; // 2cm = 20mm

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

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const headerText = `Te plannen diensten per team: Periode van ${formatDateLong(rosterInfo.start_date)} tot en met ${formatDateLong(rosterInfo.end_date)}`;
    doc.text(headerText, margin, margin);

    doc.setFontSize(12);
    doc.text(`Week ${weekNum}`, margin, margin + 8);

    // Current Y position
    let currentY = margin + 15;

    // For each date in this week
    dates.forEach(dateStr => {
      const dayData = data[dateStr];
      
      // Date header (merged cell)
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const dateText = formatDateLong(dateStr);
      doc.text(dateText, margin, currentY);
      currentY += 7;

      // Table data
      const tableData: any[][] = [];
      
      TEAMS.forEach(team => {
        const row: any[] = [TEAM_LABELS[team]];
        
        DAGDELEN.forEach(dagdeel => {
          const services = dayData[team]?.[dagdeel] || [];
          row.push(formatServiceCell(services));
        });
        
        tableData.push(row);
      });

      // Generate table
      autoTable(doc, {
        startY: currentY,
        head: [['Team', 'Ochtend', 'Middag', 'Avond/Nacht']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3,
          lineColor: [200, 200, 200],
          lineWidth: 0.5
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 25, fontStyle: 'normal' },
          1: { cellWidth: 70 },
          2: { cellWidth: 70 },
          3: { cellWidth: 70 }
        },
        margin: { left: margin, right: margin },
        tableWidth: 'auto'
      });

      // Update Y position
      currentY = (doc as any).lastAutoTable.finalY + 5;

      // Check if we need a new page
      if (currentY > pageHeight - margin - 15) {
        doc.addPage();
        currentY = margin;
        
        // Repeat header on new page
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(headerText, margin, currentY);
        currentY += 10;
      }
    });

    // Footer with print date/time
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const now = new Date();
    const printTime = `print: ${now.toLocaleDateString('nl-NL')} ${now.toLocaleTimeString('nl-NL')}`;
    doc.text(printTime, margin, pageHeight - 10);
  });

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
