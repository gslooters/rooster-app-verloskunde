# DEPLOYMENT TRIGGER - DRAAD59.1

## Timestamp
2025-11-26 17:20:00 CET

## Wijzigingen
DAGDEEL MAPPING FIX: '0' (cijfer) → 'O' (hoofdletter O)

### Gewijzigde bestanden
1. `lib/types/roster-period-staffing-dagdeel.ts`
   - Type Dagdeel: '0' → 'O'
   - DAGBLOK_NAAR_DAGDEEL mapping: O: '0' → O: 'O'
   - DAGDEEL_NAAR_DAGBLOK mapping: '0': 'O' → 'O': 'O'
   - DAGDEEL_LABELS: '0': 'Ochtend' → 'O': 'Ochtend'
   - isValidDagdeel: value === '0' → value === 'O'

2. `supabase/migrations/20251117_create_roster_period_staffing_dagdelen.sql`
   - CHECK constraint: ('0', 'M', 'A') → ('O', 'M', 'A')
   - Comment: "0=Ochtend" → "O=Ochtend"

3. `components/planning/week-dagdelen/VaststellingDataTable.tsx`
   - findDagdeelData: Verwijderd mapping 'O' → '0'
   - Gebruikt nu dagdeel direct zonder conversie

## Verwacht resultaat
- service_types levert: {"O": "MOET", "M": "MAG", "A": "MAG_NIET"}
- Code gebruikt: dagblok = 'O'
- Mapping geeft: DAGBLOK_NAAR_DAGDEEL['O'] = 'O'
- Database krijgt: dagdeel = 'O' (hoofdletter O)

## Database status
- Database wordt door gebruiker leeg gemaakt
- Geen data migratie nodig
- Schone start met nieuwe roosters

## Cache Busting
Random trigger: ${Date.now()}
