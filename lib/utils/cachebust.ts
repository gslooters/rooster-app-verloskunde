// Cachebusting utility - Date.now() + random
// DRAAD105: roster_employee_services implementatie
// Verplicht per instructie DRAAD95A
export function getCacheBustString(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
