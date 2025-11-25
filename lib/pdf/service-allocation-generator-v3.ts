// ============================================================================
// DRAAD55 - PDF GENERATOR V3: DIENSTEN-ROOSTER-DASHBOARD - COMPACT LAYOUT
// Purpose: Generate PDF met gekleurde cellen en compacte tekst (geen badges)
// Format: A4 Portrait, elke week op één pagina
// Features: 
// - Celkleuren op basis van dominante dienst
// - Compacte tekst: "CODE (aantal), CODE (aantal)" in zwart
// - Prominente datum en weeknummer headers
// - 1 week per pagina, optimale kolombreedte
// - Footer met "(V3)" indicator
// ============================================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ServiceBlock {
  code: string;
  status: string;
  aantal: number;
  kleur?: string;
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

interface ServiceType {
  code: string;
  kleur: string;
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
const WEEKDAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const FALLBACK_COLOR = '#808080';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [128, 128, 128];
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const weekday = WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${weekday} ${day} ${month}`;
}

function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
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

// ============================================================================
// COMPACT TEXT FORMATTING FOR SERVICES
// ============================================================================

function formatServicesAsText(services: ServiceBlock[]): string {
  if (services.length === 0) return '-';
  
  return services
    .map(s => `${s.code} (${s.aantal})`)
    .join(', ');
}

// ============================================================================
// DETERMINE DOMINANT SERVICE COLOR FOR CELL
// ============================================================================

function getDominantServiceColor(
  services: ServiceBlock[],
  serviceColors: { [code: string]: string }
): string | null {
  if (services.length === 0) return null;
  
  // Gebruik de eerste dienst voor de kleur (of dienst met hoogste aantal)
  const dominant = services.reduce((prev, current) => 
    current.aantal > prev.aantal ? current : prev
  );
  
  return serviceColors[dominant.code] || FALLBACK_COLOR;
}

// ============================================================================
// MAIN PDF GENERATION FUNCTION (V3 - COMPACT LAYOUT)
// ============================================================================

export function generateServiceAllocationPDFV3(
  rosterInfo: RosterInfo,
  data: PDFData,
  serviceTypes: ServiceType[]
): jsPDF {
  // Kleur mapping
  const serviceColors: { [code: string]: string } = {};
  serviceTypes.forEach(st => {
    serviceColors[st.code] = st.kleur || FALLBACK_COLOR;
  });
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  
  const weekGroups = groupByWeek(data);
  const weekKeys = Object.keys(weekGroups).sort();

  let isFirstPage = true;

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
    // PROMINENTE HEADER: Week nummer en datumbereik
    // ========================================================================
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`Week ${weekNum}`, pageWidth / 2, margin + 8, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    const periodText = `${formatDateLong(firstDate)} - ${formatDateLong(lastDate)}`;
    doc.text(periodText, pageWidth / 2, margin + 15, { align: 'center' });

    let currentY = margin + 24;
    
    // Bouw tabel data met kleuren en compacte tekst
    const tableData: any[] = [];
    const sortedDates = dates.sort();

    sortedDates.forEach(dateStr => {
      const dayData = data[dateStr];
      const dateLabel = formatDateShort(dateStr);
      
      TEAMS.forEach((team, teamIndex) => {
        const row: any = {};
        
        // Datum kolom (alleen bij eerste team)
        if (teamIndex === 0) {
          row.date = dateLabel;
        } else {
          row.date = '';
        }
        
        // Team kolom
        row.team = TEAM_LABELS[team];
        row.teamCode = team;
        
        // Dagdelen - sla diensten en kleuren op
        DAGDELEN.forEach(dagdeel => {
          const services = dayData[team]?.[dagdeel] || [];
          row[dagdeel] = formatServicesAsText(services);
          row[`${dagdeel}_color`] = getDominantServiceColor(services, serviceColors);
        });
        
        tableData.push(row);
      });
    });

    // ========================================================================
    // GENEREER TABEL MET COMPACTE TEKST EN CELKLEUREN
    // ========================================================================
    autoTable(doc, {
      startY: currentY,
      head: [[
        { content: 'Datum', styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [30, 30, 30] } },
        { content: 'Team', styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [30, 30, 30] } },
        { content: 'Ochtend (O)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [30, 30, 30] } },
        { content: 'Middag (M)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [30, 30, 30] } },
        { content: 'Avond/Nacht (A)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [30, 30, 30] } }
      ]],
      body: tableData.map(row => [
        row.date,
        row.team,
        row.O,
        row.M,
        row.A
      ]),
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        lineColor: [180, 180, 180],
        lineWidth: 0.3,
        halign: 'left',
        valign: 'middle',
        minCellHeight: 8,
        textColor: [0, 0, 0] // Zwarte tekst
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [30, 30, 30],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 3.5
      },
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] },
        1: { cellWidth: 26, fontStyle: 'bold', halign: 'center', fillColor: [250, 250, 250] },
        2: { cellWidth: 42 },
        3: { cellWidth: 42 },
        4: { cellWidth: 42 }
      },
      margin: { left: margin, right: margin },
      didParseCell: function(data: any) {
        const rowData = tableData[data.row.index];
        if (!rowData) return;
        
        // Pas celkleur toe op dagdeel kolommen (2, 3, 4) op basis van dienst
        if (data.column.index >= 2 && data.column.index <= 4) {
          const dagdeel = DAGDELEN[data.column.index - 2];
          const color = rowData[`${dagdeel}_color`];
          
          if (color) {
            const rgb = hexToRgb(color);
            // Lichtere versie van de kleur voor achtergrond (verhoog helderheid)
            const lightRgb: [number, number, number] = [
              Math.min(255, rgb[0] + 80),
              Math.min(255, rgb[1] + 80),
              Math.min(255, rgb[2] + 80)
            ];
            data.cell.styles.fillColor = lightRgb;
          }
        }
      }
    });

    // ========================================================================
    // FOOTER
    // ========================================================================
    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 100;
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    const now = new Date();
    const genTime = `Gegenereerd: ${formatDateLong(now.toISOString().split('T')[0])} ${now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(genTime, margin, pageHeight - 6);
    
    const pageText = `Pagina ${weekIndex + 1} van ${weekKeys.length} (V3)`;
    doc.text(pageText, pageWidth / 2, pageHeight - 6, { align: 'center' });
    
    const rosterText = `Rooster: ${formatDateLong(rosterInfo.start_date)} - ${formatDateLong(rosterInfo.end_date)}`;
    doc.text(rosterText, pageWidth - margin, pageHeight - 6, { align: 'right' });
  });

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
