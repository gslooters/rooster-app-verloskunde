// lib/services/diensten-storage.ts
// ============================================================================
// DRAAD30B - Storage Layer Update: Team Regels en Blokkeert Volgdag
// ============================================================================
import { Dienst, validateDienstwaarde, calculateDuration } from "../types/dienst";
import { teamRegelsFromJSON, teamRegelsToJSON, DEFAULT_TEAM_REGELS } from '../validators/service';
import { supabase } from '../supabase';

// ... overige imports/constanties ongewijzigd ...
const CACHE_KEY = "diensten_cache";
const HEALTH_CHECK_KEY = "supabase_health_diensten";
const HEALTH_CHECK_INTERVAL = 60000; // 1 minuut
const SYSTEM_CODES = ['NB', '==='];
// ... healthcheck functies ongewijzigd ...

function fromDatabase(row: any): Dienst {
  return {
    id: row.id,
    code: row.code,
    naam: row.naam,
    beschrijving: row.beschrijving || '',
    begintijd: row.begintijd || '08:00',
    eindtijd: row.eindtijd || '16:00',
    duur: row.duur ?? calculateDuration(row.begintijd || '08:00', row.eindtijd || '16:00'),
    kleur: row.kleur || '#10B981',
    dienstwaarde: row.dienstwaarde ?? 1,
    system: row.system ?? false, // DEPRECATED
    actief: row.actief ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
    planregels: row.planregels || '',

    // ---- DRAAD30B: Nieuwe velden (graceful fallback op DEFAULTS) ----
    blokkeert_volgdag: typeof row.blokkeert_volgdag === 'boolean' ? row.blokkeert_volgdag : false,
    team_groen_regels: teamRegelsFromJSON(row.team_groen_regels),
    team_oranje_regels: teamRegelsFromJSON(row.team_oranje_regels),
    team_totaal_regels: teamRegelsFromJSON(row.team_totaal_regels)
  };
}

function toDatabase(dienst: Partial<Dienst>) {
  const data: any = {
    code: dienst.code,
    naam: dienst.naam,
    beschrijving: dienst.beschrijving,
    begintijd: dienst.begintijd,
    eindtijd: dienst.eindtijd,
    duur: dienst.duur,
    kleur: dienst.kleur,
    dienstwaarde: dienst.dienstwaarde,
    system: dienst.system, // DEPRECATED
    actief: dienst.actief,
    planregels: dienst.planregels || '',
    // ---- DRAAD30B: Nieuwe velden naar JSONB/boolean ----
    blokkeert_volgdag: typeof dienst.blokkeert_volgdag === 'boolean' ? dienst.blokkeert_volgdag : false,
    team_groen_regels: dienst.team_groen_regels ? teamRegelsToJSON(dienst.team_groen_regels) : teamRegelsToJSON(DEFAULT_TEAM_REGELS),
    team_oranje_regels: dienst.team_oranje_regels ? teamRegelsToJSON(dienst.team_oranje_regels) : teamRegelsToJSON(DEFAULT_TEAM_REGELS),
    team_totaal_regels: dienst.team_totaal_regels ? teamRegelsToJSON(dienst.team_totaal_regels) : teamRegelsToJSON(DEFAULT_TEAM_REGELS)
  };
  if (dienst.id) data.id = dienst.id;
  if (dienst.created_at) data.created_at = dienst.created_at;
  if (dienst.updated_at) data.updated_at = dienst.updated_at;
  return data;
}

// Legacy functies en alles voor day staffing, team scope, etc. ---
// zijn verwijderd/deprecated (DRAAD30B).

// ... overige CRUD, cache, healthcheck, subscriptions, verwijder ongewijzigd ...

// exports etc ongewijzigd
export {
  checkSupabaseHealth,
  getCachedServices,
  SYSTEM_CODES
};
