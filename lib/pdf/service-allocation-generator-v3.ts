// ============================================================================
// DRAAD54 - PDF GENERATOR V3: DIENSTEN-ROOSTER-DASHBOARD
// Purpose: Generate PDF met gekleurde dienst-badges en 2-kolom grid layout
// Format: A4 Portrait, elke week op één pagina
// Features: 
// - Gekleurde dienst-badges (afgeronde rechthoeken, witte tekst)
// - 2-kolom grid per dagdeel (dienst1-dienst2 | dienst3-dienst4)
// - Verticale uitlijning van diensten binnen cellen
// - Dikke lijn (3px) tussen dagen
// - Header lichtgrijs (#E0E0E0)
// - Compacte datum ("Ma 24 nov" op één regel)
// ============================================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ServiceBlock {
  code: string;
  status: string;
  aantal: number;
  kleur?: string; // Kleur uit database
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
const DAGDEEL_LABELS: { [key: string]: string } = {
  O: 'Ochtend',
  M: 'Middag',
  A: 'Avond/Nacht'
};

const WEEKDAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Fallback kleuren als dienst geen kleur heeft in database
const FALLBACK_COLOR = '#808080'; // Grijs

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [128, 128, 128]; // Fallback grijs
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
// V3 SPECIFIC: DIENST BADGE RENDERING
// ============================================================================

/**
 * Render een dienst als gekleurde badge (afgeronde rechthoek, witte tekst)
 * @param doc - jsPDF document
 * @param x - X positie
 * @param y - Y positie
 * @param width - Breedte van badge
 * @param code - Dienstcode
 * @param aantal - Aantal diensten
 * @param kleur - Hex kleur uit database
 */
function renderServiceBadge(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  code: string,
  aantal: number,
  kleur: string
): number {
  const height = 5; // Badge hoogte
  const radius = 1.5; // Afronding hoeken
  const rgb = hexToRgb(kleur);
  
  // Teken afgeronde rechthoek (badge achtergrond)
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.roundedRect(x, y, width, height, radius, radius, 'F');
  
  // Teken witte tekst (dienst + aantal)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const text = `${code} (${aantal})`;
  doc.text(text, x + width / 2, y + height / 2 + 1, { align: 'center', baseline: 'middle' });
  
  return height + 1; // Retourneer hoogte + spacing voor volgende badge
}

/**
 * Render diensten in 2-kolom grid layout
 * @param doc - jsPDF document
 * @param x - Start X positie
 * @param y - Start Y positie
 * @param cellWidth - Breedte van cel
 * @param services - Array van diensten
 * @param serviceColors - Mapping van dienstcode naar kleur
 */
function renderServicesGrid(
  doc: jsPDF,
  x: number,
  y: number,
  cellWidth: number,
  services: ServiceBlock[],
  serviceColors: { [code: string]: string }
): number {
  if (services.length === 0) {
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(8);
    doc.text('-', x + cellWidth / 2, y + 4, { align: 'center' });
    return 8;
  }
  
  const badgeWidth = (cellWidth - 2) / 2; // 2 kolommen met 2mm spacing
  let currentY = y + 2;
  
  for (let i = 0; i < services.length; i += 2) {
    const service1 = services[i];
    const service2 = services[i + 1];
    
    // Badge 1 (linker kolom)
    const kleur1 = serviceColors[service1.code] || FALLBACK_COLOR;
    renderServiceBadge(doc, x, currentY, badgeWidth, service1.code, service1.aantal, kleur1);
    
    // Badge 2 (rechter kolom) als die bestaat
    if (service2) {
      const kleur2 = serviceColors[service2.code] || FALLBACK_COLOR;
      renderServiceBadge(doc, x + badgeWidth + 2, currentY, badgeWidth, service2.code, service2.aantal, kleur2);
    }
    
    currentY += 6; // Verspring naar volgende rij
  }
  
  return currentY - y + 2; // Totale hoogte
}

// ============================================================================
// MAIN PDF GENERATION FUNCTION
// ============================================================================

export function generateServiceAllocationPDFV3(
  rosterInfo: RosterInfo,
  data: PDFData,
  serviceTypes: ServiceType[]
): jsPDF {
  // Maak kleur mapping van dienstcode naar hex kleur
  const serviceColors: { [code: string]: string } = {};
  serviceTypes.forEach(st => {
    serviceColors[st.code] = st.kleur || FALLBACK_COLOR;
  });
  
  // Initialize PDF in PORTRAIT mode
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Page dimensions
  const pageWidth = 210;
  const pageHeight = 297;
  const marginTop = 12;
  const marginBottom = 12;
  const marginLeft = 8;
  const marginRight = 8;
  
  // Group dates by week
  const weekGroups = groupByWeek(data);
  const weekKeys = Object.keys(weekGroups).sort();

  let isFirstPage = true;

  // ============================================================================
  // RENDER EACH WEEK ON ONE A4 PAGE
  // ============================================================================
  
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
    // HEADER
    // ========================================================================
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`Week ${weekNum}`, marginLeft, marginTop + 6);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const periodText = `${formatDateLong(firstDate)} - ${formatDateLong(lastDate)}`;
    doc.text(periodText, marginLeft, marginTop + 12);

    let currentY = marginTop + 18;
    
    // ========================================================================
    // TABLE HEADER (Lichtgrijs #E0E0E0)
    // ========================================================================
    
    const tableX = marginLeft;
    const dateColWidth = 22;
    const teamColWidth = 20;
    const dagdeelColWidth = (pageWidth - marginLeft - marginRight - dateColWidth - teamColWidth) / 3;
    
    doc.setFillColor(224, 224, 224); // #E0E0E0 lichtgrijs
    doc.rect(tableX, currentY, pageWidth - marginLeft - marginRight, 8, 'F');
    
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    
    doc.text('Datum', tableX + dateColWidth / 2, currentY + 5, { align: 'center' });
    doc.text('Team', tableX + dateColWidth + teamColWidth / 2, currentY + 5, { align: 'center' });
    doc.text('Ochtend', tableX + dateColWidth + teamColWidth + dagdeelColWidth / 2, currentY + 5, { align: 'center' });
    doc.text('Middag', tableX + dateColWidth + teamColWidth + dagdeelColWidth * 1.5, currentY + 5, { align: 'center' });
    doc.text('Avond/Nacht', tableX + dateColWidth + teamColWidth + dagdeelColWidth * 2.5, currentY + 5, { align: 'center' });
    
    currentY += 8;
    
    // ========================================================================
    // TABLE BODY
    // ========================================================================
    
    const sortedDates = dates.sort();
    
    sortedDates.forEach((dateStr, dateIndex) => {
      const dayData = data[dateStr];
      const dateLabel = formatDateShort(dateStr);
      
      let dayStartY = currentY;
      let maxDayHeight = 0;
      
      TEAMS.forEach((team, teamIndex) => {
        let rowY = currentY;
        
        // Datum kolom (alleen bij eerste team van deze dag)
        if (teamIndex === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(tableX, rowY, dateColWidth, 15, 'F'); // Temp hoogte, adjust later
          
          doc.setTextColor(40, 40, 40);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text(dateLabel, tableX + dateColWidth / 2, rowY + 5, { align: 'center' });
        }
        
        // Team kolom
        doc.setFillColor(255, 255, 255);
        doc.rect(tableX + dateColWidth, rowY, teamColWidth, 15, 'F');
        
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(TEAM_LABELS[team], tableX + dateColWidth + teamColWidth / 2, rowY + 5, { align: 'center' });
        
        // Dagdeel kolommen met diensten (2-kolom grid)
        let maxRowHeight = 10;
        
        DAGDELEN.forEach((dagdeel, dagdeelIndex) => {
          const services = dayData[team]?.[dagdeel] || [];
          const cellX = tableX + dateColWidth + teamColWidth + dagdeelColWidth * dagdeelIndex;
          
          doc.setFillColor(255, 255, 255);
          doc.rect(cellX, rowY, dagdeelColWidth, 15, 'F');
          
          const cellHeight = renderServicesGrid(doc, cellX + 1, rowY, dagdeelColWidth - 2, services, serviceColors);
          maxRowHeight = Math.max(maxRowHeight, cellHeight);
        });
        
        // Update row height na bepaling van max cell height
        currentY += maxRowHeight;
        maxDayHeight += maxRowHeight;
      });
      
      // Dikke lijn (3px) tussen dagen
      if (dateIndex < sortedDates.length - 1) {
        doc.setDrawColor(60, 60, 60);
        doc.setLineWidth(0.8); // ~3px in mm
        doc.line(tableX, currentY, pageWidth - marginRight, currentY);
        currentY += 1;
      }
    });
    
    // ========================================================================
    // FOOTER
    // ========================================================================
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    
    const now = new Date();
    const genTime = `Gegenereerd: ${formatDateLong(now.toISOString().split('T')[0])} ${now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(genTime, marginLeft, pageHeight - 6);
    
    const pageText = `Pagina ${weekIndex + 1} van ${weekKeys.length}`;
    doc.text(pageText, pageWidth / 2, pageHeight - 6, { align: 'center' });
    
    const rosterText = `Rooster: ${formatDateLong(rosterInfo.start_date)} - ${formatDateLong(rosterInfo.end_date)}`;
    doc.text(rosterText, pageWidth - marginRight, pageHeight - 6, { align: 'right' });
  });

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
