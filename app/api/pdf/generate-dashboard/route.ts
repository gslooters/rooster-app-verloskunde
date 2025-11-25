import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Functie om tekstkleur te bepalen (wit of zwart) op basis van achtergrondkleur
function getTextColor(hexColor: string): string {
  // Verwijder # indien aanwezig
  const color = hexColor.replace('#', '');
  
  // Convert hex naar RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  
  // Relative luminance berekenen
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Threshold: 0.5 (lichte kleur → zwart tekst, donkere kleur → wit tekst)
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// Interface voor service type
interface ServiceType {
  code: string;
  naam: string;
  kleur: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { weekStart, weekEnd, rosterId } = body;

    // Stap 3.1: Database kleuren ophalen
    const { data: serviceTypes, error: serviceError } = await supabase
      .from('service_types')
      .select('code, naam, kleur')
      .in('code', ['DDA', 'DDO', 'DIO', 'DIA', 'ECH', 'GRB', 'MSP', 'OSP'])
      .eq('actief', true)
      .order('code');

    if (serviceError) {
      console.error('Error fetching service types:', serviceError);
      throw serviceError;
    }

    // Maak een lookup map voor snelle toegang
    const serviceColorMap = new Map<string, { color: string; name: string }>();
    serviceTypes?.forEach((st: ServiceType) => {
      serviceColorMap.set(st.code, {
        color: st.kleur.startsWith('#') ? st.kleur : `#${st.kleur}`,
        name: st.naam
      });
    });

    // Haal rooster data op
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select(`
        id,
        datum,
        dagdeel,
        team_id,
        service_id,
        teams!inner(naam, kleur),
        service_types!inner(code, naam)
      `)
      .eq('roster_id', rosterId)
      .gte('datum', weekStart)
      .lte('datum', weekEnd)
      .order('datum')
      .order('team_id')
      .order('dagdeel');

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      throw shiftsError;
    }

    // Stap 3.3: Badge template genereren (HTML)
    const generateDienstBadge = (serviceCode: string, count: number = 1): string => {
      const serviceInfo = serviceColorMap.get(serviceCode);
      if (!serviceInfo) return '';

      const bgColor = serviceInfo.color;
      const textColor = getTextColor(bgColor);
      const tooltip = `${serviceCode} - ${serviceInfo.name}`;

      return `
        <span 
          class="dienst-badge" 
          style="background-color: ${bgColor}; color: ${textColor};"
          data-tooltip="${tooltip}"
        >
          ${serviceCode} (${count})
        </span>
      `;
    };

    // Genereer PDF HTML
    const pdfHtml = `
      <!DOCTYPE html>
      <html lang="nl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Diensten Rooster Dashboard</title>
        <style>
          /* FASE 3: Dienst-badge styling (Stap 3.3 & 3.4) */
          .dienst-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 10pt;
            font-weight: 600;
            text-align: center;
            min-width: 50px;
            margin: 2px;
            transition: all 0.2s ease;
          }

          .dienst-badge:hover {
            opacity: 0.85;
            cursor: pointer;
            transform: scale(1.02);
          }

          /* Stap 3.4: Multi-badge layout */
          .dienst-cel {
            display: flex;
            flex-wrap: wrap;
            gap: 2px;
            align-items: flex-start;
          }

          /* Team badges (Fase 2) */
          .team-badge {
            display: inline-block;
            padding: 3px 12px;
            border-radius: 4px;
            font-size: 10pt;
            font-weight: 600;
            text-align: center;
            min-width: 80px;
            color: #FFFFFF;
          }

          .team-groen { background-color: #4CAF50; }
          .team-oranje { background-color: #FF9800; }
          .team-praktijk { background-color: #2196F3; }

          /* Algemene tabel styling (Fase 1) */
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 15mm 12mm;
            background: white;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #CCCCCC;
          }

          th {
            background-color: #F5F5F5;
            font-size: 11pt;
            font-weight: 600;
            padding: 6px;
            border: 1px solid #CCCCCC;
            text-align: center;
          }

          td {
            padding: 4px;
            border: 1px solid #CCCCCC;
            vertical-align: top;
            font-size: 10pt;
          }

          .datum-cel {
            font-weight: 600;
            text-align: center;
          }

          .team-cel {
            text-align: center;
            vertical-align: middle;
          }

          /* Dikke lijn tussen datums (Fase 1.6) */
          .datum-separator {
            border-top: 2px solid #666666;
          }

          /* Week header */
          .week-header {
            padding: 8px;
            margin-bottom: 10px;
            border-bottom: 2px solid #CCCCCC;
          }

          .week-header .week-number {
            font-size: 14pt;
            font-weight: 700;
          }

          .week-header .week-dates {
            font-size: 14pt;
            font-weight: 400;
          }

          /* Footer */
          .footer {
            position: fixed;
            bottom: 10px;
            right: 10px;
            font-size: 8pt;
            color: #666666;
          }

          /* Tooltip (Fase 4.1) */
          .tooltip {
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 9pt;
            pointer-events: none;
            z-index: 1000;
            white-space: nowrap;
            display: none;
          }

          /* Print optimization (Fase 4.3) */
          @media print {
            .dienst-badge:hover {
              transform: none;
              opacity: 1;
            }

            .week-page {
              page-break-after: always;
            }

            .week-page:last-child {
              page-break-after: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="week-header">
          <span class="week-number">Week ${getWeekNumber(new Date(weekStart))}</span>
          <span class="week-dates"> | ${formatDateRange(weekStart, weekEnd)}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px;">Datum</th>
              <th style="width: 85px;">Team</th>
              <th style="width: 180px;">Ochtend</th>
              <th style="width: 180px;">Middag</th>
              <th style="width: 180px;">Avond/Nacht</th>
            </tr>
          </thead>
          <tbody>
            ${generateTableRows(shifts, serviceColorMap, generateDienstBadge)}
          </tbody>
        </table>

        <div class="footer">
          Gegenereerd: ${formatDateTime(new Date())}
        </div>

        <script>
          // Stap 4.1: Tooltip systeem voor digitale weergave
          document.querySelectorAll('.dienst-badge').forEach(badge => {
            badge.addEventListener('mouseenter', function(e) {
              const tooltip = this.getAttribute('data-tooltip');
              showTooltip(e.clientX, e.clientY, tooltip);
            });
            
            badge.addEventListener('mouseleave', function() {
              hideTooltip();
            });
          });

          let tooltipElement = null;

          function showTooltip(x, y, text) {
            if (!tooltipElement) {
              tooltipElement = document.createElement('div');
              tooltipElement.className = 'tooltip';
              document.body.appendChild(tooltipElement);
            }
            tooltipElement.textContent = text;
            tooltipElement.style.left = (x + 10) + 'px';
            tooltipElement.style.top = (y - 30) + 'px';
            tooltipElement.style.display = 'block';
          }

          function hideTooltip() {
            if (tooltipElement) {
              tooltipElement.style.display = 'none';
            }
          }
        </script>
      </body>
      </html>
    `;

    return NextResponse.json({ 
      success: true,
      html: pdfHtml,
      serviceTypes: Array.from(serviceColorMap.entries()).map(([code, info]) => ({
        code,
        ...info
      }))
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper functions
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  
  return `${days[startDate.getDay()]} ${startDate.getDate()}/${months[startDate.getMonth()]}/${startDate.getFullYear()} - ${days[endDate.getDay()]} ${endDate.getDate()}/${months[endDate.getMonth()]}/${endDate.getFullYear()}`;
}

function formatDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

function generateTableRows(
  shifts: any[],
  serviceColorMap: Map<string, { color: string; name: string }>,
  generateDienstBadge: (code: string, count: number) => string
): string {
  // Group shifts by date and team
  const grouped: Map<string, Map<string, Map<string, any[]>>> = new Map();
  
  shifts.forEach(shift => {
    const date = shift.datum;
    const teamName = shift.teams.naam;
    const dagdeel = shift.dagdeel;
    
    if (!grouped.has(date)) {
      grouped.set(date, new Map());
    }
    if (!grouped.get(date)!.has(teamName)) {
      grouped.get(date)!.set(teamName, new Map());
    }
    if (!grouped.get(date)!.get(teamName)!.has(dagdeel)) {
      grouped.get(date)!.get(teamName)!.set(dagdeel, []);
    }
    grouped.get(date)!.get(teamName)!.get(dagdeel)!.push(shift);
  });

  let html = '';
  let prevDate: string | null = null;
  const teams = ['Groen', 'Oranje', 'Praktijk'];

  Array.from(grouped.keys()).sort().forEach(date => {
    const dateData = grouped.get(date)!;
    const dateObj = new Date(date);
    const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
    const monthNames = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const dateLabel = `${dayNames[dateObj.getDay()]} ${dateObj.getDate()} ${monthNames[dateObj.getMonth()]}`;

    teams.forEach((teamName, teamIndex) => {
      const isFirstTeam = teamIndex === 0;
      const teamData = dateData.get(teamName) || new Map();
      
      // Add separator line before first team of new date (except first date)
      const separatorClass = prevDate !== null && isFirstTeam ? ' datum-separator' : '';
      
      html += `<tr class="${separatorClass}">`;
      
      // Datum cell (rowspan 3 for all teams)
      if (isFirstTeam) {
        html += `<td class="datum-cel" rowspan="3">${dateLabel}</td>`;
      }
      
      // Team badge
      const teamClass = teamName === 'Groen' ? 'team-groen' : teamName === 'Oranje' ? 'team-oranje' : 'team-praktijk';
      html += `<td class="team-cel"><span class="team-badge ${teamClass}">${teamName}</span></td>`;
      
      // Diensten per dagdeel
      ['Ochtend', 'Middag', 'Avond/Nacht'].forEach(dagdeel => {
        const shiftsForDagdeel = teamData.get(dagdeel) || [];
        html += '<td><div class="dienst-cel">';
        
        // Stap 3.5: Generate badge for each service
        if (shiftsForDagdeel.length > 0) {
          shiftsForDagdeel.forEach(shift => {
            const serviceCode = shift.service_types.code;
            html += generateDienstBadge(serviceCode, 1);
          });
        }
        
        html += '</div></td>';
      });
      
      html += '</tr>';
    });
    
    prevDate = date;
  });

  return html;
}
