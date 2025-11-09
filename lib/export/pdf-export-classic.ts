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

function pad(str: string, len: number): string {
  if (str.length >= len) return str;
  return str + ' '.repeat(len - str.length);
}

export function printToPDFClassic(allStaffing: ServiceDayStaffing[], services: Dienst[]) {
  const now = new Date();
  const dateStr = now.toLocaleString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const rules = services.flatMap(s => allStaffing.filter(r => r.service_id === s.id).map(r => ({...r, code: s.code, naam: s.naam})));
  let html = `<!DOCTYPE html><html lang='nl'><head><meta charset='utf-8'><title>Diensten per Dagsoort - Bezettingsregels</title><style>
    body{font-family:Arial,sans-serif;font-size:10px;margin:18px;}
    .main-table{border-collapse:collapse;width:100%;margin-top:10px;}
    .main-table th,.main-table td{border:1px solid #888; padding:2px 4px;font-size:10px;}
    .main-table th{background:#f3f4f6;text-align:center;}
    .main-table td{background:#fff;text-align:center;}
    .main-table .dienst-left{font-weight:600;text-align:left;white-space:nowrap;}
    .main-table .team-left{font-weight:400;color:#555;text-align:left;}
    .meta,.meta td{font-size:11px;border:none;padding:1px;}
    </style></head><body>`;
  html += `<table class='meta'><tr><td style='font-size:16px;font-weight:bold;'>Diensten per Dagsoort - Bezettingsregels</td></tr>`;
  html += `<tr><td>Gegenereerd: ${dateStr} | Aantal diensten: ${services.length} | Totaal regels: ${rules.length}</td></tr></table>`;

  // Header 1
  html += `<table class='main-table'><thead><tr><th rowspan='2'>Dienst</th><th rowspan='2'>Team</th>`;
  DAY_NAMES.forEach(day => html += `<th colspan='2'>${day.long}</th>`);
  html += `</tr><tr>`;
  DAY_NAMES.forEach(() => html += `<th>Min</th><th>Max</th>`);
  html += `</tr></thead><tbody>`;

  // Main data rows
  services.forEach(s => {
    const row = allStaffing.find(r => r.service_id === s.id);
    if (!row) return;
    html += `<tr>`;
    html += `<td class='dienst-left'>${s.naam} <span style='color:#aaa;font-size:9px;'>(${s.code})</span></td>`;
    html += `<td class='team-left'>${getTeamLabel(row)}</td>`;
    DAY_NAMES.forEach(day => {
      const min = (row as any)[`${day.short}_min`]||0;
      const max = (row as any)[`${day.short}_max`]||0;
      html += `<td>${min}</td><td>${max}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table><br>`;
  html += `<div style='margin-top:10px;font-size:11px;'><b>Interpretatie Bezettingsregels:</b> Min 0, Max 0 = Geen bezetting. Min 1, Max 1 = Exact 1. Min 1, Max 2 = 1 tot 2 personen. Min 2, Max 9 = Min 2, onbeperkt max.</div>`;
  html += `</body></html>`;

  const win = window.open('about:blank', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(),200);
}
