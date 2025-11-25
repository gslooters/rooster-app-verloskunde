import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

// Functie om tekstkleur te bepalen (wit of zwart) op basis van achtergrondkleur
function getTextColor(hexColor: string): string {
  try {
    // Verwijder # indien aanwezig
    const color = hexColor.replace('#', '');
    
    // Valideer hex color format
    if (color.length !== 6) {
      return '#FFFFFF'; // Default wit voor ongeldige input
    }
    
    // Convert hex naar RGB - GEBRUIK substring() i.p.v. deprecated substr()
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    
    // Check voor NaN values
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return '#FFFFFF';
    }
    
    // Relative luminance berekenen
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Threshold: 0.5 (lichte kleur → zwart tekst, donkere kleur → wit tekst)
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  } catch (error) {
    console.error('Error in getTextColor:', error);
    return '#FFFFFF'; // Veilige default
  }
}

// Interface voor service type
interface ServiceType {
  code: string;
  naam: string;
  kleur: string;
}

export async function POST(request: NextRequest) {
  try {
    // Valideer request body
    const body = await request.json().catch(() => ({}));
    const { weekStart, weekEnd, rosterId } = body;

    if (!weekStart || !weekEnd || !rosterId) {
      return NextResponse.json(
        { error: 'Missing required parameters: weekStart, weekEnd, rosterId' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Stap 3.1: Database kleuren ophalen
    const { data: serviceTypes, error: serviceError } = await supabase
      .from('service_types')
      .select('code, naam, kleur')
      .in('code', ['DDA', 'DDO', 'DIO', 'DIA', 'ECH', 'GRB', 'MSP', 'OSP'])
      .eq('actief', true)
      .order('code');

    if (serviceError) {
      console.error('Error fetching service types:', serviceError);
      return NextResponse.json(
        { error: 'Failed to fetch service types', details: serviceError.message },
        { status: 500 }
      );
    }

    // Maak een lookup map voor snelle toegang
    const serviceColorMap = new Map<string, { color: string; name: string }>();
    if (serviceTypes && Array.isArray(serviceTypes)) {
      serviceTypes.forEach((st: ServiceType) => {
        if (st.code && st.kleur && st.naam) {
          serviceColorMap.set(st.code, {
            color: st.kleur.startsWith('#') ? st.kleur : `#${st.kleur}`,
            name: st.naam
          });
        }
      });
    }

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
      return NextResponse.json(
        { error: 'Failed to fetch shifts', details: shiftsError.message },
        { status: 500 }
      );
    }

    // Stap 3.3: Badge template genereren (HTML)
    const generateDienstBadge = (serviceCode: string, count: number = 1): string => {
      try {
        const serviceInfo = serviceColorMap.get(serviceCode);
        if (!serviceInfo) return '';

        const bgColor = serviceInfo.color;
        const textColor = getTextColor(bgColor);
        const tooltip = `${serviceCode} - ${serviceInfo.name}`;

        return `<span class="dienst-badge" style="background-color: ${bgColor}; color: ${textColor};" data-tooltip="${tooltip}">${serviceCode} (${count})</span>`;
      } catch (error) {
        console.error('Error generating badge:', error);
        return '';
      }
    };

    // Helper functions moeten voor gebruik gedeclareerd zijn
    const getWeekNumber = (date: Date): number => {
      try {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      } catch (error) {
        console.error('Error calculating week number:', error);
        return 1;
      }
    };

    const formatDateRange = (start: string, end: string): string => {
      try {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
        const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
        
        return `${days[startDate.getDay()]} ${startDate.getDate()}/${months[startDate.getMonth()]}/${startDate.getFullYear()} - ${days[endDate.getDay()]} ${endDate.getDate()}/${months[endDate.getMonth()]}/${endDate.getFullYear()}`;
      } catch (error) {
        console.error('Error formatting date range:', error);
        return `${start} - ${end}`;
      }
    };

    const formatDateTime = (date: Date): string => {
      try {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}-${month}-${year} ${hours}:${minutes}`;
      } catch (error) {
        console.error('Error formatting datetime:', error);
        return new Date().toISOString();
      }
    };

    const generateTableRows = (
      shifts: any[],
      serviceColorMap: Map<string, { color: string; name: string }>,
      generateDienstBadge: (code: string, count: number) => string
    ): string => {
      try {
        if (!shifts || !Array.isArray(shifts) || shifts.length === 0) {
          return '<tr><td colspan="5" style="text-align: center; padding: 20px;">Geen diensten gevonden voor deze week</td></tr>';
        }

        // Group shifts by date and team
        const grouped: Map<string, Map<string, Map<string, any[]>>> = new Map();
        
        shifts.forEach(shift => {
          if (!shift || !shift.datum || !shift.teams || !shift.dagdeel) return;
          
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
              
              // Stap 3.5: Generate badge for each service - TYPESCRIPT FIX: expliciet type voor shift
              if (shiftsForDagdeel.length > 0) {
                shiftsForDagdeel.forEach((shift: any) => {
                  if (shift && shift.service_types && shift.service_types.code) {
                    const serviceCode = shift.service_types.code;
                    html += generateDienstBadge(serviceCode, 1);
                  }
                });
              }
              
              html += '</div></td>';
            });
            
            html += '</tr>';
          });
          
          prevDate = date;
        });

        return html;
      } catch (error) {
        console.error('Error generating table rows:', error);
        return '<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Fout bij genereren van tabelrijen</td></tr>';
      }
    };

    // Genereer PDF HTML
    const pdfHtml = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diensten Rooster Dashboard</title>
  <style>
    .dienst-badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:10pt;font-weight:600;text-align:center;min-width:50px;margin:2px;transition:all .2s ease}
    .dienst-badge:hover{opacity:.85;cursor:pointer;transform:scale(1.02)}
    .dienst-cel{display:flex;flex-wrap:wrap;gap:2px;align-items:flex-start}
    .team-badge{display:inline-block;padding:3px 12px;border-radius:4px;font-size:10pt;font-weight:600;text-align:center;min-width:80px;color:#FFF}
    .team-groen{background-color:#4CAF50}
    .team-oranje{background-color:#FF9800}
    .team-praktijk{background-color:#2196F3}
    body{font-family:Arial,Helvetica,sans-serif;margin:15mm 12mm;background:#fff}
    table{width:100%;border-collapse:collapse;border:1px solid #CCC}
    th{background-color:#F5F5F5;font-size:11pt;font-weight:600;padding:6px;border:1px solid #CCC;text-align:center}
    td{padding:4px;border:1px solid #CCC;vertical-align:top;font-size:10pt}
    .datum-cel{font-weight:600;text-align:center}
    .team-cel{text-align:center;vertical-align:middle}
    .datum-separator{border-top:2px solid #666}
    .week-header{padding:8px;margin-bottom:10px;border-bottom:2px solid #CCC}
    .week-header .week-number{font-size:14pt;font-weight:700}
    .week-header .week-dates{font-size:14pt;font-weight:400}
    .footer{position:fixed;bottom:10px;right:10px;font-size:8pt;color:#666}
    .tooltip{position:absolute;background:rgba(0,0,0,.8);color:#fff;padding:4px 8px;border-radius:3px;font-size:9pt;pointer-events:none;z-index:1000;white-space:nowrap;display:none}
    @media print{.dienst-badge:hover{transform:none;opacity:1}.week-page{page-break-after:always}.week-page:last-child{page-break-after:avoid}}
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
        <th style="width:50px">Datum</th>
        <th style="width:85px">Team</th>
        <th style="width:180px">Ochtend</th>
        <th style="width:180px">Middag</th>
        <th style="width:180px">Avond/Nacht</th>
      </tr>
    </thead>
    <tbody>
      ${generateTableRows(shifts || [], serviceColorMap, generateDienstBadge)}
    </tbody>
  </table>
  <div class="footer">Gegenereerd: ${formatDateTime(new Date())}</div>
  <script>
    document.querySelectorAll('.dienst-badge').forEach(badge=>{
      badge.addEventListener('mouseenter',function(e){
        const tooltip=this.getAttribute('data-tooltip');
        showTooltip(e.clientX,e.clientY,tooltip);
      });
      badge.addEventListener('mouseleave',function(){hideTooltip();});
    });
    let tooltipElement=null;
    function showTooltip(x,y,text){
      if(!tooltipElement){
        tooltipElement=document.createElement('div');
        tooltipElement.className='tooltip';
        document.body.appendChild(tooltipElement);
      }
      tooltipElement.textContent=text;
      tooltipElement.style.left=(x+10)+'px';
      tooltipElement.style.top=(y-30)+'px';
      tooltipElement.style.display='block';
    }
    function hideTooltip(){
      if(tooltipElement)tooltipElement.style.display='none';
    }
  </script>
</body>
</html>`;

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
