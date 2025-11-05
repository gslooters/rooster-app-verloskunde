// lib/export/daytype-staffing-export.ts
import { DayTypeStaffing, DAYS_OF_WEEK, getTeamScopeDisplayText } from '@/lib/types/daytype-staffing';
import { Dienst } from '@/lib/types/dienst';
import { getServiceTeamScope } from '@/lib/services/daytype-staffing-storage';

// Export to CSV format for Excel with team scope information
export function exportToCSV(staffingRules: DayTypeStaffing[], services: Dienst[]): string {
  let csvContent = 'Dienst,Code,Team Scope';
  
  // Add day headers (Min/Max pairs)
  DAYS_OF_WEEK.forEach(day => {
    csvContent += `,${day.name} Min,${day.name} Max`;
  });
  csvContent += '\n';
  
  // Add service rows
  services.forEach(service => {
    const teamScope = getServiceTeamScope(service.id);
    let row = `"${service.naam}","${service.code}","${getTeamScopeDisplayText(teamScope)}"`;
    
    DAYS_OF_WEEK.forEach(day => {
      const rule = staffingRules.find(r => r.dienstId === service.id && r.dagSoort === day.index);
      row += `,${rule?.minBezetting || 0},${rule?.maxBezetting || 0}`;
    });
    
    csvContent += row + '\n';
  });
  
  return csvContent;
}

// Download CSV file
export function downloadCSV(staffingRules: DayTypeStaffing[], services: Dienst[], filename: string = 'diensten_per_dagsoort.csv'): void {
  const csvContent = exportToCSV(staffingRules, services);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Export to HTML for PDF printing with enhanced team scope support
export function exportToHTML(staffingRules: DayTypeStaffing[], services: Dienst[]): string {
  const getBezettingColor = (min: number, max: number): string => {
    if (min === 0 && max === 0) return '#f9fafb'; // Geen bezetting
    if (min === max && min === 1) return '#dbeafe'; // Exact 1
    if (min >= 1 && max <= 3) return '#d1fae5'; // Normale bezetting
    if (max >= 4) return '#fef3c7'; // Hoge bezetting
    return '#fed7aa'; // Variabele bezetting
  };

  const getBezettingText = (min: number, max: number): string => {
    if (min === 0 && max === 0) return 'Geen';
    if (min === max) return `Exact ${min}`;
    if (max === 9) return `Min ${min}, Onbeperkt`;
    return `${min}-${max}`;
  };
  
  const getTeamScopeColor = (teamScope: string): string => {
    switch (teamScope) {
      case 'total': return '#dbeafe'; // Blue
      case 'groen': return '#d1fae5'; // Green 
      case 'oranje': return '#fed7aa'; // Orange
      case 'both': return '#e0e7ff'; // Purple
      default: return '#f3f4f6'; // Gray
    }
  };
  
  // Create repeating header for PDF pages
  const createTableHeader = () => `
    <thead class="table-header">
        <tr>
            <th rowspan="2" class="service-header">Dienst</th>
            <th rowspan="2" class="team-header">Team</th>
            ${DAYS_OF_WEEK.map(day => `<th colspan="2">${day.name}</th>`).join('')}
        </tr>
        <tr>
            ${DAYS_OF_WEEK.map(() => '<th style="width: 35px;">Min</th><th style="width: 35px;">Max</th>').join('')}
        </tr>
    </thead>
  `;

  return `
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diensten per Dagsoort - Bezettingsregels</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
            margin: 15px; 
            color: #374151;
            line-height: 1.4;
        }
        .page-header {
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
        }
        .page-header h1 {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin: 0 0 8px 0;
        }
        .page-header .meta {
            color: #6b7280;
            font-size: 12px;
        }
        table { 
            border-collapse: collapse; 
            width: 100%; 
            margin-top: 15px;
            border: 1px solid #d1d5db;
        }
        .table-header {
            display: table-header-group;
        }
        th { 
            background-color: #f9fafb; 
            font-weight: 600;
            color: #374151;
            padding: 10px 6px;
            border: 1px solid #d1d5db;
            text-align: center;
            font-size: 11px;
        }
        th.service-header {
            text-align: left;
            min-width: 140px;
        }
        th.team-header {
            text-align: center;
            min-width: 60px;
        }
        td { 
            border: 1px solid #d1d5db; 
            padding: 6px;
            text-align: center;
            font-size: 10px;
        }
        .service-name { 
            text-align: left; 
            font-weight: 600;
            color: #1f2937;
            padding: 10px;
        }
        .service-code {
            font-family: 'Courier New', monospace;
            background-color: #f3f4f6;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 10px;
            margin-left: 6px;
        }
        .team-scope {
            font-size: 9px;
            padding: 2px 4px;
            border-radius: 3px;
            font-weight: 600;
            color: #374151;
        }
        .bezetting-cell {
            padding: 3px;
            min-width: 60px;
        }
        .interpretation {
            margin-top: 25px;
            padding: 12px;
            background-color: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 6px;
            break-inside: avoid;
        }
        .interpretation h3 {
            color: #1e40af;
            margin: 0 0 8px 0;
            font-size: 14px;
        }
        .interpretation-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 6px;
            font-size: 11px;
            color: #1e40af;
        }
        
        /* Print-specific styles */
        @media print {
            body { 
                margin: 10mm; 
                font-size: 9px;
            }
            .page-header {
                margin-bottom: 15px;
                padding-bottom: 10px;
            }
            .page-header h1 { 
                font-size: 18px; 
            }
            .page-header .meta {
                font-size: 10px;
            }
            th, td { 
                font-size: 9px;
                padding: 4px;
            }
            table {
                margin-top: 10px;
            }
            .table-header {
                display: table-header-group !important;
            }
            thead {
                display: table-header-group !important;
            }
            .interpretation {
                margin-top: 15px;
                padding: 8px;
            }
            .interpretation h3 {
                font-size: 12px;
            }
            .interpretation-grid {
                font-size: 9px;
            }
            /* Ensure headers repeat on each page */
            thead { break-inside: avoid; }
            tr { break-inside: avoid; }
        }
        
        @page {
            margin: 15mm;
            size: A4 landscape;
        }
    </style>
</head>
<body>
    <div class="page-header">
        <h1>Diensten per Dagsoort - Bezettingsregels</h1>
        <div class="meta">
            <strong>Gegenereerd:</strong> ${new Date().toLocaleDateString('nl-NL', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}<br>
            <strong>Aantal diensten:</strong> ${services.length} | <strong>Totaal regels:</strong> ${staffingRules.length}
        </div>
    </div>
    
    <table>
        ${createTableHeader()}
        <tbody>
            ${services.map((service, index) => {
              const bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
              const teamScope = getServiceTeamScope(service.id);
              const teamScopeColor = getTeamScopeColor(teamScope);
              
              return `
                <tr style="background-color: ${bgColor}">
                    <td class="service-name">
                        <div style="display: flex; align-items: center;">
                            <div style="width: 14px; height: 14px; background-color: ${service.kleur}; border-radius: 2px; margin-right: 8px;"></div>
                            ${service.naam}
                            <span class="service-code">${service.code}</span>
                        </div>
                    </td>
                    <td style="background-color: ${teamScopeColor};">
                        <span class="team-scope">${getTeamScopeDisplayText(teamScope)}</span>
                    </td>
                    ${DAYS_OF_WEEK.map(day => {
                      const rule = staffingRules.find(r => r.dienstId === service.id && r.dagSoort === day.index);
                      const min = rule?.minBezetting || 0;
                      const max = rule?.maxBezetting || 0;
                      const bgColor = getBezettingColor(min, max);
                      return `
                        <td style="background-color: ${bgColor}; font-weight: 600;">${min}</td>
                        <td style="background-color: ${bgColor}; font-weight: 600;">${max}</td>
                      `;
                    }).join('')}
                </tr>
              `;
            }).join('')}
        </tbody>
    </table>
    
    <div class="interpretation">
        <h3>Interpretatie Bezettingsregels</h3>
        <div class="interpretation-grid">
            <div><strong>Min 0, Max 0:</strong> Geen bezetting vereist</div>
            <div><strong>Min 1, Max 1:</strong> Exact 1 persoon vereist</div>
            <div><strong>Min 1, Max 2:</strong> Minimaal 1, maximaal 2 personen</div>
            <div><strong>Min 2, Max 9:</strong> Minimaal 2, onbeperkt maximum</div>
        </div>
        <div style="margin-top: 10px; font-size: 10px; color: #6b7280;">
            <strong>Team Scope Kleuren:</strong> 
            <span style="background-color: #dbeafe; padding: 1px 4px; border-radius: 2px; margin: 0 4px;">Tot = Totale praktijk</span>
            <span style="background-color: #d1fae5; padding: 1px 4px; border-radius: 2px; margin: 0 4px;">Gro = Team Groen</span>
            <span style="background-color: #fed7aa; padding: 1px 4px; border-radius: 2px; margin: 0 4px;">Org = Team Oranje</span>
            <span style="background-color: #e0e7ff; padding: 1px 4px; border-radius: 2px; margin: 0 4px;">G+O = Beide Teams</span>
        </div>
    </div>
</body>
</html>
  `;
}

// Print to PDF with enhanced header repetition
export function printToPDF(staffingRules: DayTypeStaffing[], services: Dienst[]): void {
  const htmlContent = exportToHTML(staffingRules, services);
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 300);
    };
  } else {
    alert('Kon print venster niet openen. Controleer of pop-ups zijn toegestaan.');
  }
}