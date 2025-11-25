// ============================================================================
// DRAAD53.2 FASE 2 - PDF GENERATOR: SERVICE ALLOCATION (AANGEPAST LAYOUT)
// Purpose: Generate PDF for service allocation per team per day per dagdeel
// Format: A4 Portrait, aangepast volgens formulier voorbeeld
// Changes: Layout aangepast met verbeterde tabel structuur en kleuren
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
// CONSTANTS - DIENST & TEAM KLEUREN (AANGEPAST)
// ============================================================================

const TEAMS = ['GRO', 'ORA', 'TOT'];
const TEAM_LABELS: { [key: string]: string } = {
  GRO: 'Groen',
  ORA: 'Oranje',
  TOT: 'Praktijk'
};

// Team kleuren (RGB values aangepast voor beter contrast)
const TEAM_COLORS: { [key: string]: [number, number, number] } = {
  GRO: [34, 139, 34],      // Forest Green
  ORA: [255, 140, 0],      // Dark Orange
  TOT: [70, 130, 180]      // Steel Blue
};

// Dienst codes met kleuren (geoptimaliseerd voor leesbaarheid)
const SERVICE_COLORS: { [key: string]: [number, number, number] } = {
  DDA: [44, 62, 80],       // Donkerblauw
  DDO: [233, 30, 140],     // Magenta
  DJA: [155, 89, 182],     // Paars
  DJO: [241, 196, 15],     // Geel
  ECH: [177, 156, 217],    // Lichtpaars
  GRB: [230, 126, 34],     // Oranje
  MSP: [93, 173, 226],     // Blauw
  OSP: [93, 173, 226]      // Blauw
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
// PDF GENERATION - AANGEPASTE LAYOUT (FASE 2)
// ============================================================================

export function generateServiceAllocationPDF(
  rosterInfo: RosterInfo,
  data: PDFData
): jsPDF {
  // Initialize PDF in PORTRAIT mode
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Page dimensions (A4 portrait)
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10; // Kleinere margin voor meer ruimte

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
    // HEADER - Compacter formaat
    // ========================================================================
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`Diensten Rooster - Week ${weekNum}`, margin, margin + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const periodText = `${formatDateLong(firstDate)} - ${formatDateLong(lastDate)}`;
    doc.text(periodText, margin, margin + 13);

    let currentY = margin + 18;

    // ========================================================================
    // TABLE: Aangepaste tabel met verbeterde structuur
    // ========================================================================
    
    const tableData: any[] = [];
    const sortedDates = dates.sort();

    sortedDates.forEach(dateStr => {
      const dayData = data[dateStr];
      const dateLabel = formatDateShort(dateStr);
      
      TEAMS.forEach((team, teamIndex) => {
        const row: any = {};
        
        // First column: Date (gegroepeerd per dag)
        if (teamIndex === 0) {
          row.date = dateLabel;
          row.rowSpan = TEAMS.length;
        } else {
          row.date = '';
        }
        
        // Second column: Team met label
        row.team = TEAM_LABELS[team];
        row.teamCode = team;
        row.teamColor = TEAM_COLORS[team];
        
        // Dagdelen columns met verbeterde formatting
        DAGDELEN.forEach(dagdeel => {
          const services = dayData[team]?.[dagdeel] || [];
          const serviceLines: string[] = [];
          const serviceCodes: string[] = [];
          
          services.forEach(s => {
            // Compacte weergave: CODE (aantal)
            serviceLines.push(`${s.code} (${s.aantal})`);
            serviceCodes.push(s.code);
          });
          
          row[dagdeel] = serviceLines.join('\n');
          row[`${dagdeel}_codes`] = serviceCodes;
        });
        
        tableData.push(row);
      });
    });

    // Generate aangepaste tabel
    autoTable(doc, {
      startY: currentY,
      head: [[
        { content: 'Datum', styles: { halign: 'center', fontStyle: 'bold', fillColor: [50, 50, 50] } },
        { content: 'Team', styles: { halign: 'center', fontStyle: 'bold', fillColor: [50, 50, 50] } },
        { content: 'Ochtend (O)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [50, 50, 50] } },
        { content: 'Middag (M)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [50, 50, 50] } },
        { content: 'Avond/Nacht (A)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [50, 50, 50] } }
      ]],
      body: tableData.map((row: any) => [
        row.date,
        row.team,
        row.O || '-',
        row.M || '-',
        row.A || '-'
      ]),
      theme: 'grid',
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        lineColor: [150, 150, 150],
        lineWidth: 0.4,
        halign: 'left',
        valign: 'top',
        minCellHeight: 12
      },
      headStyles: {
        fillColor: [50, 50, 50],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] },
        1: { cellWidth: 28, fontStyle: 'bold', halign: 'center' },
        2: { cellWidth: 44 },
        3: { cellWidth: 44 },
        4: { cellWidth: 44 }
      },
      margin: { left: margin, right: margin },
      didParseCell: function(data: any) {
        const rowData = tableData[data.row.index];
        if (!rowData) return;
        
        // Color team column
        if (data.column.index === 1 && rowData.teamColor) {
          data.cell.styles.fillColor = rowData.teamColor;
          const textColor = getTextColor(rowData.teamColor);
          data.cell.styles.textColor = textColor;
          data.cell.styles.fontStyle = 'bold';
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
              const textColor = getTextColor(color);
              data.cell.styles.textColor = textColor;
              data.cell.styles.fontStyle = 'bold';
            }
          } else {
            // Lege cellen: lichtgrijze achtergrond
            data.cell.styles.fillColor = [250, 250, 250];
            data.cell.styles.textColor = [150, 150, 150];
          }
        }
      }
    });

    // ========================================================================
    // LEGENDA - Onderaan pagina
    // ========================================================================
    const finalY = (doc as any).lastAutoTable.finalY || currentY + 100;
    
    if (finalY + 40 < pageHeight - margin) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('Legenda Teams:', margin, finalY + 10);
      
      doc.setFont('helvetica', 'normal');
      let legendY = finalY + 15;
      
      TEAMS.forEach(team => {
        const color = TEAM_COLORS[team];
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(margin, legendY - 3, 5, 4, 'F');
        doc.setTextColor(60, 60, 60);
        doc.text(`${TEAM_LABELS[team]} (${team})`, margin + 7, legendY);
        legendY += 5;
      });
    }

    // ========================================================================
    // FOOTER - Metadata
    // ========================================================================
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    const now = new Date();
    const printTime = `Gegenereerd: ${now.toLocaleDateString('nl-NL')} om ${now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(printTime, margin, pageHeight - 6);
    
    const pageText = `Pagina ${weekIndex + 1} van ${weekKeys.length}`;
    doc.text(pageText, pageWidth / 2, pageHeight - 6, { align: 'center' });
    
    const rosterText = `${formatDateLong(rosterInfo.start_date)} t/m ${formatDateLong(rosterInfo.end_date)}`;
    doc.text(rosterText, pageWidth - margin, pageHeight - 6, { align: 'right' });
  });

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
