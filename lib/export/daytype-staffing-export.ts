// lib/export/daytype-staffing-export.ts
import { DayTypeStaffing, DAYS_OF_WEEK } from '@/lib/types/daytype-staffing';
import { Dienst } from '@/lib/types/dienst';

// Export to CSV format for Excel
export function exportToCSV(staffingRules: DayTypeStaffing[], services: Dienst[]): string {
  let csvContent = 'Dienst,Code';
  
  // Add day headers (Min/Max pairs)
  DAYS_OF_WEEK.forEach(day => {
    csvContent += `,${day.name} Min,${day.name} Max`;
  });
  csvContent += '\n';
  
  // Add service rows
  services.forEach(service => {
    let row = `"${service.naam}","${service.code}"`;
    
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

// Export to HTML for PDF printing
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
            margin: 20px; 
            color: #374151;
            line-height: 1.4;
        }
        .header {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
        }
        .header h1 {
            font-size: 28px;
            font-weight: bold;
            color: #1f2937;
            margin: 0 0 10px 0;
        }
        .header .meta {
            color: #6b7280;
            font-size: 14px;
        }
        table { 
            border-collapse: collapse; 
            width: 100%; 
            margin-top: 20px;
            border: 1px solid #d1d5db;
        }
        th { 
            background-color: #f9fafb; 
            font-weight: 600;
            color: #374151;
            padding: 12px 8px;
            border: 1px solid #d1d5db;
            text-align: center;
            font-size: 12px;
        }
        th.service-header {
            text-align: left;
            min-width: 150px;
        }
        td { 
            border: 1px solid #d1d5db; 
            padding: 8px;
            text-align: center;
            font-size: 11px;
        }
        .service-name { 
            text-align: left; 
            font-weight: 600;
            color: #1f2937;
            padding: 12px;
        }
        .service-code {
            font-family: 'Courier New', monospace;
            background-color: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            margin-left: 8px;
        }
        .bezetting-cell {
            padding: 4px;
            min-width: 80px;
        }
        .min-max {
            display: flex;
            justify-content: space-around;
            font-size: 10px;
            margin-bottom: 2px;
        }
        .bezetting-label {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 500;
        }
        .interpretation {
            margin-top: 30px;
            padding: 15px;
            background-color: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
        }
        .interpretation h3 {
            color: #1e40af;
            margin: 0 0 10px 0;
            font-size: 16px;
        }
        .interpretation-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 8px;
            font-size: 12px;
            color: #1e40af;
        }
        .page-break { page-break-before: always; }
        @media print {
            body { margin: 15px; }
            .header h1 { font-size: 24px; }
            th, td { font-size: 10px; }
        }
    </style>
</head>
<body>
    <div class="header">
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
        <thead>
            <tr>
                <th rowspan="2" class="service-header">Dienst</th>
                ${DAYS_OF_WEEK.map(day => `<th colspan="2">${day.name}</th>`).join('')}
            </tr>
            <tr>
                ${DAYS_OF_WEEK.map(() => '<th style="width: 35px;">Min</th><th style="width: 35px;">Max</th>').join('')}
            </tr>
        </thead>
        <tbody>
            ${services.map((service, index) => {
              const bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
              return `
                <tr style="background-color: ${bgColor}">
                    <td class="service-name">
                        <div style="display: flex; align-items: center;">
                            <div style="width: 16px; height: 16px; background-color: ${service.kleur}; border-radius: 3px; margin-right: 10px;"></div>
                            ${service.naam}
                            <span class="service-code">${service.code}</span>
                        </div>
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
    </div>
</body>
</html>
  `;
}

// Print to PDF
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
      }, 250);
    };
  } else {
    alert('Kon print venster niet openen. Controleer of pop-ups zijn toegestaan.');
  }
}
