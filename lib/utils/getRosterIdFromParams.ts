/**
 * Centrale helper functie voor het ophalen van roster ID uit URL parameters
 * 
 * Deze functie ondersteunt zowel camelCase (rosterId) als snake_case (roster_id)
 * URL parameters voor maximale compatibiliteit en robuustheid.
 * 
 * @param searchParams - URLSearchParams object uit Next.js useSearchParams
 * @returns Het roster ID als string, of null indien niet gevonden
 * 
 * @example
 * // Gebruik in een client component:
 * const searchParams = useSearchParams();
 * const rosterId = getRosterIdFromParams(searchParams);
 * 
 * // Gebruik in een server component:
 * const rosterId = getRosterIdFromParams(new URLSearchParams(searchParams));
 */
export function getRosterIdFromParams(searchParams: URLSearchParams): string | null {
  // Probeer eerst camelCase variant (voorkeur)
  const camelCaseId = searchParams.get('rosterId');
  if (camelCaseId) {
    return camelCaseId;
  }
  
  // Fallback naar snake_case variant voor backwards compatibility
  const snakeCaseId = searchParams.get('roster_id');
  if (snakeCaseId) {
    return snakeCaseId;
  }
  
  // Geen roster ID gevonden
  return null;
}
