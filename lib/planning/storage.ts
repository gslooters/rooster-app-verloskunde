export function formatWeekRange(startDate: string, endDate: string): string {
  // Consistente ISO-week berekening voor begin- én einddatum
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(`${endDate}T00:00:00`);
  const sw = getISOWeek(s);
  const ew = getISOWeek(e);
  const year = s.getFullYear();
  return `Week ${sw}-${ew}, ${year}`;
}
