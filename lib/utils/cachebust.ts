// Cachebusting utility - Date.now() + random
// Fase 2 UI cachebust rooster-app-verloskunde
// Verplicht per instructie DRAAD95A
export function getCacheBustString(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
