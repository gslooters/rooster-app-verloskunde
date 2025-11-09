// lib/export/pdf-export-classic.ts
import { Dienst } from '@/lib/types/dienst';
import { ServiceDayStaffing } from '@/lib/services/diensten-storage';
import { DAY_NAMES } from '@/lib/utils/bezetting-tags';

function getTeamLabel(row: ServiceDayStaffing): string {
  if (row.tot_enabled) return 'Totale praktijk';
  if (row.gro_enabled && row.ora_enabled) return 'Beide Teams';
  if (row.gro_enabled) return 'Groen';
  if (row.ora_enabled) return 'Oranje';
  return '';
}

export function printToPDFClassic(allStaffing: ServiceDayStaffing[], services: Dienst[]) {
  const now = new Date();
  const dateStr = now.toLocaleString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  let html = `<!DOCTYPE html><html lang='nl'><head><meta charset='utf-8'><title>Diensten per Dagsoort - Bezettingsregels</title><style>
    @page { size: A4 landscape; margin: 10mm; }
    body{font-family:Arial,sans-serif;font-size:9pt;margin:0;}
    .main-table{border-collapse:collapse;width:100%;table-layout:fixed;}
    .main-table th,.main-table td{border:1px solid #999;padding:3px 5px;font-size:9pt;line-height:1.3;word-break:break-word;}
    .main-table th{background:#f3f4f6;color:#222;text-align:center;font-weight:bold;}
    .header-1{font-size:16px;font-weight:bold;padding-bottom:3px;}
    .header-2{font-size:10pt;color:#666;padding-bottom:14px;}
    .dienst-left{font-weight:600;text-align:left;white-space:nowrap;}
    .team-left{font-weight:400;color:#444;text-align:left;min-width:62px;}
    .meta,.meta td{font-size:10pt;border:none;padding:1px;}
    .interpretatie{margin-top:12px;font-size:9pt;}
    </style></head><body>`;
  html += `<div class='header-1'>Diensten per Dagsoort - Bezettingsregels</div>`;
  html += `<div class='header-2'>Gegenereerd: ${dateStr} &nbsp;|&nbsp; Aantal diensten: ${services.length} &nbsp;|&nbsp; Totaal regels: ${allStaffing.length}</div>`;
  html += `<table class='main-table'><thead><tr><th rowspan='2'>Dienst</th><th rowspan='2'>Team</th>`;
  DAY_NAMES.forEach(day => html += `<th colspan='2'>${day.long}</th>`);
  html += `</tr><tr>`;
  DAY_NAMES.forEach(() => html += `<th>Min</th><th>Max</th>`);
  html += `</tr></thead><tbody>`;

  services.forEach(s => {
    const row = allStaffing.find(r => r.service_id === s.id);
    if (!row) return;
    html += `<tr>`;
    html += `<td class='dienst-left'>${s.naam} <span style='color:#aaa;font-size:8pt;'>(${s.code})</span></td>`;
    html += `<td class='team-left'>${getTeamLabel(row)}</td>`;
    DAY_NAMES.forEach(day => {
      const min = (row as any)[`${day.short}_min`]||0;
      const max = (row as any)[`${day.short}_max`]||0;
      html += `<td>${min}</td><td>${max}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  html += `<div class='interpretatie'><b>Interpretatie Bezettingsregels:</b> Min 0, Max 0 = Geen bezetting. Min 1, Max 1 = Exact 1. Min 1, Max 2 = 1 tot 2 personen. Min 2, Max 9 = Min 2, onbeperkt max.</div>`;
  html += `</body></html>`;

  const win = window.open('about:blank', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(),200);
}
