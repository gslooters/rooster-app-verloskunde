// lib/export/daytype-staffing-export.ts
import { DayTypeStaffing, DAYS_OF_WEEK, getTeamScopeDisplayText } from '@/lib/types/daytype-staffing';
import { Dienst } from '@/lib/types/dienst';
import { getServiceTeamScope } from '@/lib/services/daytype-staffing-storage';

// Export to CSV format for Excel with team scope information
export function exportToCSV(staffingRules: DayTypeStaffing[], services: Dienst[]): string {
  let csvContent = 'Dienst,Code,Team Scope';
  DAYS_OF_WEEK.forEach(day => {
    csvContent += `,${day.name} Min,${day.name} Max`;
  });
  csvContent += '\n';
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
    if (min === 0 && max === 0) return '#f9fafb';
    if (min === max && min === 1) return '#dbeafe';
    if (min >= 1 && max <= 3) return '#d1fae5';
    if (max >= 4) return '#fef3c7';
    return '#fed7aa';
  };
  const getBezettingText = (min: number, max: number): string => {
    if (min === 0 && max === 0) return 'Geen';
    if (min === max) return `Exact ${min}`;
    if (max === 9) return `Min ${min}, Onbeperkt`;
    return `${min}-${max}`;
  };

  // Dual-color swatch for BOTH (Groen+Oranje)
  const getTeamScopeSwatchHTML = (teamScope: string) => {
    if (teamScope === 'both') {
      return `<div style="display:flex;align-items:center;justify-content:center;gap:4px;">
        <div style="width:10px;height:10px;background:#d1fae5;border:1px solid #a7f3d0;border-radius:2px"></div>
        <div style="width:10px;height:10px;background:#fed7aa;border:1px solid #fdba74;border-radius:2px"></div>
      </div>`;
    }
    const color = teamScope === 'total' ? '#dbeafe' : teamScope === 'groen' ? '#d1fae5' : '#fed7aa';
    const border = teamScope === 'total' ? '#bfdbfe' : teamScope === 'groen' ? '#a7f3d0' : '#fdba74';
    return `<div style="width:18px;height:10px;background:${color};border:1px solid ${border};border-radius:2px;margin:0 auto"></div>`;
  };

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
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 15px; color: #374151; line-height: 1.4; }
  .page-header { margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb; }
  .page-header h1 { font-size: 24px; font-weight: bold; color: #1f2937; margin: 0 0 8px 0; }
  .page-header .meta { color: #6b7280; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; margin-top: 15px; border: 1px solid #d1d5db; }
  .table-header { display: table-header-group; }
  th { background-color: #f9fafb; font-weight: 600; color: #374151; padding: 10px 6px; border: 1px solid #d1d5db; text-align: center; font-size: 11px; }
  th.service-header { text-align: left; min-width: 140px; }
  th.team-header { text-align: center; min-width: 46px; } /* smaller team column */
  td { border: 1px solid #d1d5db; padding: 6px; text-align: center; font-size: 10px; }
  .service-name { text-align: left; font-weight: 600; color: #1f2937; padding: 10px; }
  .service-code { font-family: 'Courier New', monospace; background-color: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 10px; margin-left: 6px; }
  .team-scope { font-size: 9px; padding: 0; font-weight: 600; color: #374151; }
  .team-cell { display:flex; flex-direction:column; align-items:center; gap:2px; padding:4px 2px; }
  .interpretation { margin-top: 25px; padding: 12px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; break-inside: avoid; }
  .interpretation h3 { color: #1e40af; margin: 0 0 8px 0; font-size: 14px; }
  .interpretation-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 6px; font-size: 11px; color: #1e40af; }
  @media print { body { margin: 10mm; font-size: 9px; } th, td { font-size: 9px; padding: 4px; } table { margin-top: 10px; } .table-header, thead { display: table-header-group !important; } thead { break-inside: avoid; } tr { break-inside: avoid; } }
  @page { margin: 15mm; size: A4 landscape; }
</style>
</head>
<body>
  <div class="page-header">
    <h1>Diensten per Dagsoort - Bezettingsregels</h1>
    <div class="meta">
      <strong>Gegenereerd:</strong> ${new Date().toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}<br>
      <strong>Aantal diensten:</strong> ${services.length} | <strong>Totaal regels:</strong> ${staffingRules.length}
    </div>
  </div>
  <table>
    ${createTableHeader()}
    <tbody>
      ${services.map((service, index) => {
        const rowBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
        const teamScope = getServiceTeamScope(service.id);
        return `
        <tr style="background-color:${rowBg}">
          <td class="service-name">
            <div style="display:flex;align-items:center;">
              <div style="width:14px;height:14px;background:${service.kleur};border-radius:2px;margin-right:8px;"></div>
              ${service.naam}
              <span class="service-code">${service.code}</span>
            </div>
          </td>
          <td class="team-cell">
            ${getTeamScopeSwatchHTML(teamScope)}
            <span class="team-scope">${getTeamScopeDisplayText(teamScope)}</span>
          </td>
          ${DAYS_OF_WEEK.map(day => {
            const rule = staffingRules.find(r => r.dienstId === service.id && r.dagSoort === day.index);
            const min = rule?.minBezetting || 0;
            const max = rule?.maxBezetting || 0;
            const bg = getBezettingColor(min, max);
            return `<td style="background:${bg};font-weight:600;">${min}</td><td style="background:${bg};font-weight:600;">${max}</td>`;
          }).join('')}
        </tr>`;
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
    <div style="margin-top:8px;font-size:10px;color:#6b7280;display:flex;gap:8px;align-items:center;">
      <span><strong>Kleurcode:</strong></span>
      <span style="display:flex;align-items:center;gap:4px;">
        <span style="width:10px;height:10px;background:#dbeafe;border:1px solid #bfdbfe;border-radius:2px;"></span> Tot
      </span>
      <span style="display:flex;align-items:center;gap:4px;">
        <span style="width:10px;height:10px;background:#d1fae5;border:1px solid #a7f3d0;border-radius:2px;"></span> Gro
      </span>
      <span style="display:flex;align-items:center;gap:4px;">
        <span style="width:10px;height:10px;background:#fed7aa;border:1px solid #fdba74;border-radius:2px;"></span> Org
      </span>
      <span style="display:flex;align-items:center;gap:4px;">
        <span style="width:10px;height:10px;background:#d1fae5;border:1px solid #a7f3d0;border-radius:2px;"></span>
        <span style="width:10px;height:10px;background:#fed7aa;border:1px solid #fdba74;border-radius:2px;"></span> G+O
      </span>
    </div>
  </div>
</body>
</html>`;
}

// Print to PDF with no about:blank artifacts
export function printToPDF(staffingRules: DayTypeStaffing[], services: Dienst[]): void {
  const htmlContent = exportToHTML(staffingRules, services);
  const printWindow = window.open('about:blank');
  if (!printWindow) {
    alert('Kon print venster niet openen. Controleer of pop-ups zijn toegestaan.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}
