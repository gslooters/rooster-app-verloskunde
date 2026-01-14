# 🔧 DRAAD-417: AFL VALIDATION ERRORS FIX
**Datum:** 14 januari 2026, 16:40 CET  
**Prioriteit:** HOOG  
**Type:** Bugfix - Data Consistency & API  
**Draad:** ROOSTER-3 Space  

---

## 📋 SAMENVATTING

Fix 26 AFL validation errors in productie rooster:
- 9x WRONGSTATUS (next-day blocks met status 3 ipv 2)
- 17x INCONSISTENTBLOCKING (Avond slots met DDA ipv DIA)
- 1x HTTP 404 in AFL rapport UI (missing-services endpoint)

**Impact:** AFL rapport toont "HTTP 404: Fout bij laden" → gebruiker kan detailoverzicht niet zien.

---

## 🎯 DOELSTELLINGEN

### Primair
1. **Fix Data:** Corrigeer 26 AFL validation errors in database
2. **Fix API:** Maak missing-services endpoint werkend (HTTP 404 fix)
3. **Verify:** Controleer dat AFL rapport 0 errors toont

### Secundair
4. **Document:** Update deployment notes in README
5. **Deploy:** Railway auto-deploy triggeren

---

## 📊 HUIDIGE SITUATIE

### Database Schema (Supabase)
```
roster_assignments:
- id: uuid
- roster_id: uuid
- employee_id: text
- date: date
- dagdeel: text
- status: integer (1=active, 2=blocked, 3=???)
- service_id: uuid
- blocked_by_date: date
- blocked_by_dagdeel: text
- blocked_by_service_id: uuid
- roster_period_staffing_dagdelen_id: uuid

roster_period_staffing_dagdelen:
- id: uuid
- roster_id: uuid
- date: date
- dagdeel: text (Ochtend/Middag/Avond/Nacht)
- team: text (Groen/Oranje/Overig)
- service_id: uuid
- status: text ('1'=open, '2'=BLOCKED, '3'=???)
- aantal: integer
- invulling: integer

service_types:
- id: uuid
- code: text (DIA, DDA, etc)
- naam: text
- blokkeertvolgdag: boolean
```

### AFL Validation Errors (Railway logs)
```
26 errors gedetecteerd op 13 jan 2026, 15:44 CET:

WRONGSTATUS (9x):
- chainid: 3cf1f3af-60b7-4681-ab0d-232b914244d8
  message: "Next-day Ochtend block has status 3, expected 2 (blocked)"
- chainid: 3cf1f3af-60b7-4681-ab0d-232b914244d8
  message: "Next-day Middag block has status 3, expected 2 (blocked)"
[... 7 more similar ...]

INCONSISTENTBLOCKING (17x):
- chainid: c69a625f-a999-4552-8aa6-eb3b19a1982e
  message: "DRAAD403B FOUT 4: Avond slot has service DDA, expected DIA"
[... 16 more similar ...]
```

### HTTP 404 Error
```
Frontend AFL rapport:
- Sectie: "Detailoverzicht Ontbrekende Diensten"
- Error: HTTP 404
- Endpoint: /api/afl/missing-services?roster_id=[uuid]
- Impact: Sectie toont "Fout bij laden" placeholder
```

---

## 🔨 TECHNISCHE OPLOSSING

### FASE 1: Database Fix (SQL)

**Bestand:** `supabase/migrations/20260114_draad417_fix_afl_validation.sql`

```sql
-- ==================================================================
-- DRAAD-417: FIX AFL VALIDATION ERRORS
-- Datum: 14 januari 2026
-- Doel: Corrigeer 26 AFL validation errors (WRONGSTATUS + INCONSISTENTBLOCKING)
-- ==================================================================

-- STAP 1: Identificeer actueel rooster
DO $$
DECLARE
  v_roster_id uuid;
BEGIN
  SELECT id INTO v_roster_id
  FROM roosters 
  WHERE status = 'ACTIVE' 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  RAISE NOTICE '[DRAAD417] Active roster_id: %', v_roster_id;
END $$;

-- STAP 2A: FIX WRONGSTATUS ERRORS
-- Probleem: Next-day blocks hebben status '3', maar '2' (BLOCKED) wordt verwacht
-- Oplossing: Update status van '3' naar '2' voor alle next-day blocking slots

UPDATE roster_period_staffing_dagdelen
SET 
  status = '2',  -- Status '2' = BLOCKED
  updated_at = NOW()
WHERE roster_id IN (
  SELECT id FROM roosters 
  WHERE status = 'ACTIVE' 
  ORDER BY created_at DESC 
  LIMIT 1
)
AND status = '3'
AND date > (
  -- Alleen toekomstige dates (next-day blocks)
  SELECT MIN(date) FROM roster_period_staffing_dagdelen 
  WHERE roster_id = roster_period_staffing_dagdelen.roster_id
)
AND EXISTS (
  -- Controleer dat er daadwerkelijk blocking assignments zijn
  SELECT 1 
  FROM roster_assignments ra
  WHERE ra.roster_period_staffing_dagdelen_id = roster_period_staffing_dagdelen.id
  AND ra.blocked_by_date IS NOT NULL
);

-- Rapporteer resultaat
DO $$
DECLARE
  v_fixed_count INT;
BEGIN
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  RAISE NOTICE '[DRAAD417] ✅ Fixed WRONGSTATUS errors: % slots updated (status 3 → 2)', v_fixed_count;
END $$;

-- STAP 2B: FIX INCONSISTENTBLOCKING ERRORS
-- Probleem: Avond slots krijgen service 'DDA' ipv 'DIA' bij blocking
-- Oplossing: Update service_id van DDA → DIA voor next-day Avond blocks

UPDATE roster_period_staffing_dagdelen rpsd
SET 
  service_id = (
    SELECT id FROM service_types 
    WHERE code = 'DIA' 
    LIMIT 1
  ),
  updated_at = NOW()
WHERE roster_id IN (
  SELECT id FROM roosters 
  WHERE status = 'ACTIVE' 
  ORDER BY created_at DESC 
  LIMIT 1
)
AND dagdeel = 'Avond'
AND status IN ('2', '3')  -- Zowel correcte als incorrecte blocked statuses
AND service_id IN (
  SELECT id FROM service_types WHERE code = 'DDA'
)
AND date > (
  -- Alleen toekomstige dates
  SELECT MIN(date) FROM roster_period_staffing_dagdelen 
  WHERE roster_id = rpsd.roster_id
)
AND EXISTS (
  -- Controleer dat dit next-day blocking slots zijn
  SELECT 1 
  FROM roster_assignments ra
  WHERE ra.roster_period_staffing_dagdelen_id = rpsd.id
  AND ra.blocked_by_date IS NOT NULL
  AND ra.blocked_by_dagdeel IS NOT NULL
);

-- Rapporteer resultaat
DO $$
DECLARE
  v_fixed_count INT;
BEGIN
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  RAISE NOTICE '[DRAAD417] ✅ Fixed INCONSISTENTBLOCKING errors: % Avond slots updated (DDA → DIA)', v_fixed_count;
END $$;

-- STAP 3: VERIFICATIE
-- Check hoeveel errors nog over zijn

-- Check 1: WRONGSTATUS
SELECT 
  'WRONGSTATUS_REMAINING' as check_type,
  COUNT(*) as error_count,
  ARRAY_AGG(DISTINCT date) as affected_dates,
  ARRAY_AGG(DISTINCT dagdeel) as affected_dagdelen
FROM roster_period_staffing_dagdelen rpsd
WHERE roster_id IN (
  SELECT id FROM roosters 
  WHERE status = 'ACTIVE' 
  ORDER BY created_at DESC 
  LIMIT 1
)
AND status = '3'
AND date > CURRENT_DATE
AND EXISTS (
  SELECT 1 FROM roster_assignments ra
  WHERE ra.roster_period_staffing_dagdelen_id = rpsd.id
  AND ra.blocked_by_date IS NOT NULL
);

-- Check 2: INCONSISTENTBLOCKING
SELECT 
  'INCONSISTENTBLOCKING_REMAINING' as check_type,
  COUNT(*) as error_count,
  ARRAY_AGG(DISTINCT date) as affected_dates,
  ARRAY_AGG(DISTINCT team) as affected_teams
FROM roster_period_staffing_dagdelen rpsd
WHERE roster_id IN (
  SELECT id FROM roosters 
  WHERE status = 'ACTIVE' 
  ORDER BY created_at DESC 
  LIMIT 1
)
AND dagdeel = 'Avond'
AND date > CURRENT_DATE
AND service_id IN (SELECT id FROM service_types WHERE code = 'DDA')
AND status IN ('2', '3')
AND EXISTS (
  SELECT 1 FROM roster_assignments ra
  WHERE ra.roster_period_staffing_dagdelen_id = rpsd.id
  AND ra.blocked_by_date IS NOT NULL
);

-- STAP 4: AUDIT LOG
-- Registreer deze fix voor traceability
INSERT INTO deployment_logs (
  deployment_name,
  deployment_date,
  changes_made,
  affected_tables
) VALUES (
  'DRAAD-417: AFL Validation Errors Fix',
  NOW(),
  jsonb_build_object(
    'wrongstatus_fixed', 'status 3 → 2 for next-day blocks',
    'inconsistentblocking_fixed', 'DDA → DIA for Avond blocks',
    'expected_errors_fixed', 26
  ),
  ARRAY['roster_period_staffing_dagdelen']
);

-- ==================================================================
-- EINDE DRAAD-417 SQL MIGRATION
-- ==================================================================
```

### FASE 2: API Endpoint Fix (TypeScript/JavaScript)

**Optie A: Next.js Pages API** (als project pages/ gebruikt)

**Bestand:** `pages/api/afl/missing-services.ts`

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Alleen GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowed: ['GET']
    });
  }

  const { roster_id } = req.query;

  // Valideer roster_id parameter
  if (!roster_id || typeof roster_id !== 'string') {
    return res.status(400).json({ 
      error: 'Missing or invalid roster_id parameter',
      message: 'Query parameter roster_id (uuid) is required'
    });
  }

  try {
    // Query: Vind alle slots waar invulling < aantal (= shortage)
    const { data: missingServices, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select(`
        id,
        date,
        dagdeel,
        team,
        aantal,
        invulling,
        service_id,
        status,
        service_types (
          code,
          naam
        )
      `)
      .eq('roster_id', roster_id)
      .filter('invulling', 'lt', 'aantal')
      .neq('status', 'MAG_NIET')
      .order('date', { ascending: true })
      .order('dagdeel', { ascending: true });

    if (error) {
      console.error('[DRAAD417] Supabase query error:', error);
      throw error;
    }

    // Bereken shortage per slot
    const enrichedData = (missingServices || []).map(slot => ({
      ...slot,
      shortage: slot.aantal - slot.invulling,
      service_code: slot.service_types?.code || 'UNKNOWN',
      service_naam: slot.service_types?.naam || 'Onbekend'
    }));

    // Bereken totalen
    const totalShortage = enrichedData.reduce((sum, slot) => sum + slot.shortage, 0);
    const affectedDates = [...new Set(enrichedData.map(s => s.date))].length;

    return res.status(200).json({ 
      success: true,
      roster_id,
      missing_services: enrichedData,
      statistics: {
        total_slots_with_shortage: enrichedData.length,
        total_shortage_count: totalShortage,
        affected_dates: affectedDates
      },
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('[DRAAD417] API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch missing services data',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}
```

**Optie B: Next.js App API** (als project app/ gebruikt)

**Bestand:** `app/api/afl/missing-services/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roster_id = searchParams.get('roster_id');

  // Valideer roster_id
  if (!roster_id) {
    return NextResponse.json(
      { 
        error: 'Missing roster_id parameter',
        message: 'Query parameter roster_id (uuid) is required'
      },
      { status: 400 }
    );
  }

  try {
    // Query: Vind alle slots met shortage
    const { data: missingServices, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select(`
        id,
        date,
        dagdeel,
        team,
        aantal,
        invulling,
        service_id,
        status,
        service_types (
          code,
          naam
        )
      `)
      .eq('roster_id', roster_id)
      .filter('invulling', 'lt', 'aantal')
      .neq('status', 'MAG_NIET')
      .order('date', { ascending: true })
      .order('dagdeel', { ascending: true });

    if (error) {
      console.error('[DRAAD417] Supabase query error:', error);
      throw error;
    }

    // Verrijk data met shortage berekening
    const enrichedData = (missingServices || []).map(slot => ({
      ...slot,
      shortage: slot.aantal - slot.invulling,
      service_code: slot.service_types?.code || 'UNKNOWN',
      service_naam: slot.service_types?.naam || 'Onbekend'
    }));

    // Statistieken
    const totalShortage = enrichedData.reduce((sum, slot) => sum + slot.shortage, 0);
    const affectedDates = [...new Set(enrichedData.map(s => s.date))].length;

    return NextResponse.json({ 
      success: true,
      roster_id,
      missing_services: enrichedData,
      statistics: {
        total_slots_with_shortage: enrichedData.length,
        total_shortage_count: totalShortage,
        affected_dates: affectedDates
      },
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('[DRAAD417] API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to fetch missing services data'
      },
      { status: 500 }
    );
  }
}
```

---

## 📝 UITVOERING STAPPEN

### METHODE: Alles via GitHub MCP Tools + Railway

**STAP 1: Identificeer Project Structuur**
```
Gebruik: mcp_tool_github-mcp-direct_get_file_contents
- Check: /pages/api/ bestaat? → Optie A (Pages API)
- Check: /app/api/ bestaat? → Optie B (App Router)
```

**STAP 2: Maak SQL Migration**
```
Gebruik: mcp_tool_github-mcp-direct_create_or_update_file
Branch: main (of nieuwe branch "draad417-afl-fix")
Path: supabase/migrations/20260114_draad417_fix_afl_validation.sql
Content: [SQL code hierboven]
Commit message: "DRAAD-417: Fix 26 AFL validation errors (WRONGSTATUS + INCONSISTENTBLOCKING)"
```

**STAP 3: Maak API Endpoint**
```
Gebruik: mcp_tool_github-mcp-direct_create_or_update_file
Branch: main (of zelfde branch als STAP 2)
Path: [pages/api/afl/missing-services.ts OF app/api/afl/missing-services/route.ts]
Content: [TypeScript code hierboven, juiste versie]
Commit message: "DRAAD-417: Add missing-services API endpoint (fix HTTP 404)"
```

**STAP 4: Update README Deployment Notes**
```
Gebruik: mcp_tool_github-mcp-direct_create_or_update_file
Branch: main
Path: README.md
Content: Update ## 📦 DEPLOYMENT STATUS sectie met DRAAD-417 info
Commit message: "DRAAD-417: Update deployment notes - AFL validation errors fixed"
```

**STAP 5: Trigger Railway Deploy**
```
Gebruik: mcp_tool_github-mcp-direct_create_or_update_file
Branch: main
Path: .railroad-trigger
Content: "DRAAD-417-deployment-$(date +%s)"
Commit message: "DRAAD-417: Trigger Railway deployment"
```

**STAP 6: Execute SQL Migration in Supabase**
```
BELANGRIJK: Dit kan NIET via GitHub MCP tools!

INSTRUCTIE VOOR GEBRUIKER:
1. Open Supabase Dashboard: https://supabase.com/dashboard/project/rzecogncpkjfytebfkni/sql
2. Open nieuw SQL Editor venster
3. Kopieer VOLLEDIGE SQL code uit migration file
4. Klik "Run" om uit te voeren
5. Controleer output:
   - "[DRAAD417] Active roster_id: [uuid]"
   - "[DRAAD417] ✅ Fixed WRONGSTATUS errors: X slots updated"
   - "[DRAAD417] ✅ Fixed INCONSISTENTBLOCKING errors: Y slots updated"
   - "WRONGSTATUS_REMAINING: 0 errors"
   - "INCONSISTENTBLOCKING_REMAINING: 0 errors"
6. Screenshot van output bewaren voor documentatie
```

---

## ✅ VERIFICATIE CHECKLIST

### Database Verificatie
- [ ] SQL migration succesvol uitgevoerd in Supabase
- [ ] WRONGSTATUS errors: 0 remaining
- [ ] INCONSISTENTBLOCKING errors: 0 remaining
- [ ] Deployment log entry aangemaakt

### API Verificatie
- [ ] Endpoint bereikbaar: GET /api/afl/missing-services?roster_id=[uuid]
- [ ] Response heeft `success: true`
- [ ] Response heeft `missing_services` array
- [ ] Response heeft `statistics` object

### Frontend Verificatie
- [ ] AFL rapport laadt zonder errors
- [ ] "Detailoverzicht Ontbrekende Diensten" sectie zichtbaar
- [ ] Geen HTTP 404 in browser console
- [ ] Data correct weergegeven (date, dagdeel, team, shortage)

### Railway Deployment
- [ ] Build succesvol
- [ ] Geen TypeScript compile errors
- [ ] Geen runtime errors in logs
- [ ] Health check passed

---

## 🔍 TROUBLESHOOTING

### Als SQL migration errors geeft:
```
PROBLEEM: "relation does not exist"
OPLOSSING: Check tabelnamen zijn lowercase + underscore (roster_assignments, NIET rosterAssignments)

PROBLEEM: "column does not exist"  
OPLOSSING: Verify field names met: SELECT * FROM information_schema.columns WHERE table_name='roster_period_staffing_dagdelen'

PROBLEEM: "no rows updated"
OPLOSSING: Check roster_id met: SELECT id, status FROM roosters ORDER BY created_at DESC LIMIT 5
```

### Als API 404 blijft:
```
PROBLEEM: Endpoint nog steeds 404
OPLOSSING 1: Verify file path correct is (pages/ vs app/ structuur)
OPLOSSING 2: Check Railway logs voor build errors: railway logs
OPLOSSING 3: Restart Railway service: klik "Restart" in Railway dashboard
```

### Als AFL rapport errors blijft tonen:
```
PROBLEEM: AFL validation errors blijven
OPLOSSING 1: Run AFL rapport opnieuw (force refresh)
OPLOSSING 2: Check dat SQL migration echt uitgevoerd is in Supabase
OPLOSSING 3: Verify met directe query:
  SELECT COUNT(*) FROM roster_period_staffing_dagdelen 
  WHERE status='3' AND blocked_by_date IS NOT NULL
```

---

## 📌 AANVULLENDE CONTEXT

### Service Codes Betekenis
```
DIA = Dienst Inactief Avond (gebruikt voor next-day blocking)
DDA = Dienst Dag/Avond (reguliere dienst, NIET voor blocking)
```

### Status Codes Betekenis
```
roster_assignments.status (integer):
  1 = ACTIVE (reguliere assignment)
  2 = BLOCKED (next-day blocked slot)
  3 = ??? (onbekend, waarschijnlijk fout)

roster_period_staffing_dagdelen.status (text):
  '1' = OPEN (beschikbaar voor planning)
  '2' = BLOCKED (geblokkeerd door next-day rule)
  '3' = ??? (onbekend, waarschijnlijk fout)
```

### Blocking Logic (DRAAD403B)
Next-day blocking werkt als volgt:
1. Als dienst X op dag D wordt toegewezen
2. EN dienst X heeft `blokkeertvolgdag = true`
3. DAN wordt dag D+1 voor bepaalde dagdelen geblokkeerd
4. Geblokkeerde slots krijgen:
   - status = '2' (BLOCKED)
   - service_id = DIA (of andere inactive service)
   - roster_assignments met blocked_by_date = D

**Bug:** Huidige implementatie zet soms:
- status = '3' (incorrect)
- service_id = DDA (incorrect voor blocking)

---

## 🎯 DEFINITIE VAN SUCCES

### Minimale Vereisten (MUST)
✅ 0 AFL validation errors in productie rooster  
✅ API endpoint /api/afl/missing-services werkt (geen 404)  
✅ AFL rapport "Detailoverzicht Ontbrekende Diensten" sectie laadt  
✅ Railway deployment succesvol  

### Gewenste Resultaten (SHOULD)
✅ SQL migration documentatie compleet  
✅ API response bevat statistieken (total shortage, affected dates)  
✅ Deployment notes in README geüpdatet  
✅ Screenshot van 0 errors in AFL rapport  

### Extra Credits (NICE-TO-HAVE)
✅ Audit log entry in database voor traceability  
✅ Automated test toegevoegd voor API endpoint  
✅ Frontend toont vriendelijke "geen tekorten" message als lijst leeg is  

---

## 🚀 UITVOERING

**BENODIGDHEDEN:**
- GitHub MCP tools: read + write access
- Supabase dashboard access (voor SQL migration)
- Railway dashboard access (voor verificatie)

**GESCHATTE TIJD:**
- GitHub changes: 15-20 minuten
- SQL migration: 5 minuten
- Verificatie: 10-15 minuten
- **Totaal: ~40 minuten**

**VOLGORDE:**
1. GitHub: Maak SQL migration file
2. GitHub: Maak API endpoint file  
3. GitHub: Update README
4. GitHub: Trigger Railway deploy
5. Supabase: Run SQL migration
6. Verify: Check AFL rapport + API endpoint

---

## ⚠️ WAARSCHUWINGEN

1. **SQL Migration:** Run ALLEEN op productie na verificatie op development
2. **Backup:** Maak database snapshot voor SQL migration (optioneel maar aanbevolen)
3. **Timing:** Bij voorkeur uitvoeren tijdens lage gebruik (avond/nacht)
4. **Rollback:** Als errors: gebruik git revert + restore database snapshot

---

## 📞 ESCALATIE

**Als deze draad vastloopt:**
- Check Railway logs voor runtime errors
- Verify Supabase connection strings in environment variables  
- Check dat SUPABASE_SERVICE_ROLE_KEY correct is (niet PUBLIC key!)
- Consulteer DRAAD-219B deployment notes voor vergelijkbare fix pattern

---

**KLAAR VOOR UITVOERING**  
**Geschreven door:** AI Assistant (Space ROOSTER-3)  
**Review status:** Ready for execution  
**Goedkeuring nodig:** Ja (voor Supabase SQL migration)
