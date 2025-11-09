// lib/utils/bezetting-tags.ts
// ============================================================================
// BEZETTING TAG UTILITIES
// ============================================================================
// Utility functies voor het weergeven van bezettingsregels
// ============================================================================

/**
 * Genereer een leesbare tag voor de bezetting op basis van min/max waarden
 * Voorbeelden:
 * - 0, 0 => "Geen"
 * - 1, 1 => "Exact 1"
 * - 2, 2 => "Exact 2" 
 * - 0, 9 => "Min 0, onbep max"
 * - 2, 9 => "Min 2, onbep max"
 * - 1, 3 => "1-3"
 */
export function getBezettingTag(min: number, max: number): string {
  // Geen bezetting
  if (min === 0 && max === 0) return 'Geen';
  
  // Exacte waarde (voor alle getallen, niet alleen 1 en 2)
  if (min === max) return `Exact ${min}`;
  
  // Onbeperkt max (9 betekent onbeperkt)
  if (max === 9) {
    if (min === 0) return 'Min 0, onbep max';
    return `Min ${min}, onbep max`;
  }
  
  // Standaard range
  return `${min}-${max}`;
}

/**
 * Bepaal de CSS klasse voor de bezetting tag
 * Gebaseerd op het type bezetting
 */
export function getBezettingTagClass(min: number, max: number): string {
  // Geen bezetting - grijs
  if (min === 0 && max === 0) return 'tag-geen';
  
  // Exact 1 - blauw
  if (min === 1 && max === 1) return 'tag-exact-1';
  
  // Exact 2 - groen
  if (min === 2 && max === 2) return 'tag-exact-2';
  
  // Onbeperkt - beige
  if (max === 9) return 'tag-onbeperkt';
  
  // Standaard range - oranje
  return 'tag-range';
}

/**
 * Valideer of min/max waarden geldig zijn
 * Returns error message of null als geldig
 */
export function validateBezetting(min: number, max: number): string | null {
  if (min < 0 || min > 8) {
    return 'Minimum moet tussen 0 en 8 liggen';
  }
  
  if (max < 0 || max > 9) {
    return 'Maximum moet tussen 0 en 9 liggen';
  }
  
  if (min > max) {
    return 'Minimum kan niet hoger zijn dan maximum';
  }
  
  return null;
}

/**
 * Team scope display tekst
 */
export function getTeamScopeDisplay(tot: boolean, gro: boolean, ora: boolean): string {
  if (tot) return 'Totaal';
  
  const teams: string[] = [];
  if (gro) teams.push('Groen');
  if (ora) teams.push('Oranje');
  
  if (teams.length === 0) return 'Geen teams';
  if (teams.length === 2) return 'Groen + Oranje';
  
  return teams[0];
}

/**
 * Valideer team scope regels
 * Returns error message of null als geldig
 */
export function validateTeamScope(tot: boolean, gro: boolean, ora: boolean): string | null {
  // Als Tot aan is, moeten Gro en Ora uit zijn
  if (tot && (gro || ora)) {
    return 'Als Totaal aan is, moeten Groen en Oranje uit zijn';
  }
  
  // Als niets aan is, is dat ook niet geldig
  if (!tot && !gro && !ora) {
    return 'Minstens één team moet actief zijn';
  }
  
  return null;
}

/**
 * Helper om team toggle te berekenen met correcte exclusieve logica
 */
export function toggleTeam(
  currentTeam: 'tot' | 'gro' | 'ora',
  currentState: { tot: boolean; gro: boolean; ora: boolean }
): { tot: boolean; gro: boolean; ora: boolean } {
  const newState = { ...currentState };
  
  switch (currentTeam) {
    case 'tot':
      newState.tot = !newState.tot;
      if (newState.tot) {
        // Als Tot aan gaat, zet Gro en Ora uit
        newState.gro = false;
        newState.ora = false;
      }
      break;
      
    case 'gro':
      newState.gro = !newState.gro;
      if (newState.gro) {
        // Als Gro aan gaat, zet Tot uit
        newState.tot = false;
      }
      break;
      
    case 'ora':
      newState.ora = !newState.ora;
      if (newState.ora) {
        // Als Ora aan gaat, zet Tot uit
        newState.tot = false;
      }
      break;
  }
  
  // Als alles uit is, zet Tot weer aan (default)
  if (!newState.tot && !newState.gro && !newState.ora) {
    newState.tot = true;
  }
  
  return newState;
}

/**
 * Dag namen (kort)
 */
export const DAY_NAMES = [
  { short: 'ma', long: 'Maandag', index: 0 },
  { short: 'di', long: 'Dinsdag', index: 1 },
  { short: 'wo', long: 'Woensdag', index: 2 },
  { short: 'do', long: 'Donderdag', index: 3 },
  { short: 'vr', long: 'Vrijdag', index: 4 },
  { short: 'za', long: 'Zaterdag', index: 5 },
  { short: 'zo', long: 'Zondag', index: 6 }
];