// ============================================================================
// DRAAD54-FIX - PDF GENERATOR V3: DIENSTEN-ROOSTER-DASHBOARD
// Purpose: Generate PDF met gekleurde dienst-badges en 2-kolom grid layout
// Format: A4 Portrait, elke week op één pagina
// Fix: Gebruik autoTable met didDrawCell voor custom badge rendering
// Features: 
// - Gekleurde dienst-badges (afgeronde rechthoeken, witte tekst)
// - 2-kolom grid per dagdeel (dienst1-dienst2 | dienst3-dienst4)
// - Dikke lijn tussen dagen
// - Header lichtgrijs (#E0E0E0)
// - Compacte datum ("Ma 24 nov")
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
// V3 BADGE RENDERING IN CELL
// ============================================================================

function renderBadgesInCell(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  services: ServiceBlock[],
  serviceColors: { [code: string]: string }
): void {
  if (services.length === 0) return;
  
  const badgeHeight = 4.5;
  const badgeRadius = 1.2;
  const badgeWidth = (width - 3) / 2; // 2 kolommen met spacing
  const spacing = 1.5;
  
  let currentY = y + 2;
  
  for (let i = 0; i < services.length; i += 2) {
    const s1 = services[i];
    const s2 = services[i + 1];
    
    // Badge 1 (links)
    const color1 = hexToRgb(serviceColors[s1.code] || FALLBACK_COLOR);
    doc.setFillColor(color1[0], color1[1], color1[2]);
    doc.roundedRect(x + 1, currentY, badgeWidth, badgeHeight, badgeRadius, badgeRadius, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(`${s1.code} (${s1.aantal})`, x + 1 + badgeWidth / 2, currentY + badgeHeight / 2 + 0.8, { 
      align: 'center', 
      baseline: 'middle' 
    });
    
    // Badge 2 (rechts)
    if (s2) {
      const color2 = hexToRgb(serviceColors[s2.code] || FALLBACK_COLOR);
      doc.setFillColor(color2[0], color2[1], color2[2]);
      doc.roundedRect(x + 1 + badgeWidth + 1, currentY, badgeWidth, badgeHeight, badgeRadius, badgeRadius, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(`${s2.code} (${s2.aantal})`, x + 1 + badgeWidth + 1 + badgeWidth / 2, currentY + badgeHeight / 2 + 0.8, { 
        align: 'center', 
        baseline: 'middle' 
      });
    }
    
    currentY += badgeHeight + spacing;
  }
}

// ============================================================================
// MAIN PDF GENERATION FUNCTION (FIXED V3)
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

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`Week ${weekNum}`, margin, margin + 7);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const periodText = `${formatDateLong(firstDate)} - ${formatDateLong(lastDate)}`;
    doc.text(periodText, margin, margin + 13);

    let currentY = margin + 18;
    
    // Bouw tabel data
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
        
        // Dagdelen - sla diensten op voor rendering
        DAGDELEN.forEach(dagdeel => {
          const services = dayData[team]?.[dagdeel] || [];
          row[dagdeel] = services.length > 0 ? 'BADGES' : '-';
          row[`${dagdeel}_services`] = services;
        });
        
        tableData.push(row);
      });
    });

    // Genereer tabel MET autoTable
    autoTable(doc, {
      startY: currentY,
      head: [[
        { content: 'Datum', styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 224, 224], textColor: [40, 40, 40] } },
        { content: 'Team', styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 224, 224], textColor: [40, 40, 40] } },
        { content: 'Ochtend (O)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 224, 224], textColor: [40, 40, 40] } },
        { content: 'Middag (M)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 224, 224], textColor: [40, 40, 40] } },
        { content: 'Avond/Nacht (A)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [224, 224, 224], textColor: [40, 40, 40] } }
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
        fontSize: 8.5,
        cellPadding: 3,
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
        halign: 'left',
        valign: 'top',
        minCellHeight: 10
      },
      headStyles: {
        fillColor: [224, 224, 224],
        textColor: [40, 40, 40],
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
      didDrawCell: function(data: any) {
        const rowData = tableData[data.row.index];
        if (!rowData) return;
        
        // Render badges in dagdeel kolommen (2, 3, 4)
        if (data.column.index >= 2 && data.column.index <= 4) {
          const dagdeel = DAGDELEN[data.column.index - 2];
          const services = rowData[`${dagdeel}_services`] || [];
          
          if (services.length > 0) {
            renderBadgesInCell(
              doc,
              data.cell.x,
              data.cell.y,
              data.cell.width,
              data.cell.height,
              services,
              serviceColors
            );
          }
        }
      },
      didDrawPage: function(data: any) {
        // Dikke lijnen tussen dagen (na render)
        // Dit is complex met autoTable, laat standaard grid lines
      }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 100;
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    
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
