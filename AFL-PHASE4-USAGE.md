# AFL Phase 4: Database Writer - Gebruikersgids

**Status:** ✅ Operationeel  
**Versie:** 1.0  
**Datum:** 21 december 2025

---

## 📋 Samenvatting

Phase 4 (Database Writer) voegt de persistency layer toe aan de AFL pipeline. Na Phase 3 (DIO/DDO validatie) schrijft Phase 4 alle wijzigingen terug naar PostgreSQL.

**Wat doet Phase 4:**

- ✅ Leest alle gewijzigde assignments (is_modified=true)
- ✅ Schrijft status, service_id, en blokkade-informatie terug naar `roster_assignments`
- ✅ Updatet rooster status naar 'in_progress'
- ✅ Tracked AFL runs via ort_run_id (UUID)
- ✅ Atomaire error handling (geen partial writes ondetected)

---

## 🚀 Hoe te gebruiken

### Stap 1: Import de orchestrator

```typescript
import { runAflPipeline } from '@/lib/afl';
```

### Stap 2: Roep aan met rooster ID

```typescript
const result = await runAflPipeline('rooster-uuid-here');
```

### Stap 3: Handvat het resultaat

```typescript
if (result.success) {
  console.log(`✅ AFL compleet!`);
  console.log(`Run ID: ${result.afl_run_id}`);
  console.log(`Totale tijd: ${result.execution_time_ms}ms`);
  
  // Phase breakdown
  if (result.phase_timings) {
    console.log('Phase timings:');
    console.log(`  Load: ${result.phase_timings.load_ms}ms`);
    console.log(`  Solve: ${result.phase_timings.solve_ms}ms`);
    console.log(`  Chain: ${result.phase_timings.dio_chains_ms}ms`);
    console.log(`  Database: ${result.phase_timings.database_write_ms}ms`);
  }
} else {
  console.error(`❌ AFL failed: ${result.error}`);
}
```

---

## 📊 Return Value: AflExecutionResult

```typescript
interface AflExecutionResult {
  success: boolean;                    // Entire pipeline succeeded?
  afl_run_id: string;                 // UUID for run tracking
  rosterId: string;                   // Which rooster
  execution_time_ms: number;          // Total time
  error?: string | null;              // Error message (if failed)
  
  phase_timings?: {
    load_ms: number;                  // Phase 1 time
    solve_ms: number;                 // Phase 2 time
    dio_chains_ms: number;            // Phase 3 time
    database_write_ms: number;        // Phase 4 time
    report_generation_ms: number;     // Phase 5 time
  };
}
```

---

## 📚 Complete Example

```typescript
// Components/RosterScheduler.tsx
import { runAflPipeline } from '@/lib/afl';
import { useState } from 'react';

export function RosterScheduler({ rosterId }: { rosterId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleRunAFL() {
    setLoading(true);
    try {
      const result = await runAflPipeline(rosterId);
      setResult(result);

      if (result.success) {
        toast.success('AFL planning completed!');
      } else {
        toast.error(`AFL failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('AFL error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleRunAFL}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        {loading ? 'Running AFL...' : 'Run AutoFill'}
      </button>

      {result && (
        <div className="p-4 bg-gray-100 rounded">
          {result.success ? (
            <div>
              <h3 className="text-green-600 font-bold">✅ AFL Success</h3>
              <p>Run ID: {result.afl_run_id}</p>
              <p>Total time: {result.execution_time_ms}ms</p>
              {result.phase_timings && (
                <details>
                  <summary>Phase timings</summary>
                  <ul className="text-sm mt-2">
                    <li>Load: {result.phase_timings.load_ms}ms</li>
                    <li>Solve: {result.phase_timings.solve_ms}ms</li>
                    <li>Chain: {result.phase_timings.dio_chains_ms}ms</li>
                    <li>Database: {result.phase_timings.database_write_ms}ms</li>
                  </ul>
                </details>
              )}
            </div>
          ) : (
            <div>
              <h3 className="text-red-600 font-bold">❌ AFL Failed</h3>
              <p>{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## ⚠️ Belangrijke Details

### Run Tracking (afl_run_id)

Elke AFL run krijgt een unieke UUID:

```sql
-- Opzoeken van alle assignments uit een specifieke AFL run:
SELECT * FROM roster_assignments 
WHERE ort_run_id = 'run-uuid-here';
```

Dit stelt je in staat om:
- 🔍 Specifieke runs te auditen
- 🗑️ Rollback mechanisme te bouwen (alle assignments met die run_id verwijderen)
- 📊 Statistieken per run te volgen

### Rooster Status Lifecycle

```
draft           (initial state)
↓
 in_progress    (after AFL Phase 4 completes)
↓
manual_review   (planner makes adjustments)
↓
published      (final, locked)
```

Phase 4 updatet status van `draft` naar `in_progress`.

### Database Fields Updated (per assignment)

| Veld | Type | Bijgewerkt door Phase 4 | Doel |
| ---- | ---- | ----------------------- | ---- |
| `status` | int | ✅ | 1=assigned, 2=blocked, 3=unavailable |
| `service_id` | uuid | ✅ | Welke dienst toegewezen |
| `source` | text | ✅ | Always set to 'autofill' |
| `blocked_by_date` | date | ✅ | Welke datum veroorzaakte block |
| `blocked_by_dagdeel` | text | ✅ | Welk dagdeel veroorzaakte block |
| `blocked_by_service_id` | uuid | ✅ | Welke dienst veroorzaakte block |
| `constraint_reason` | jsonb | ✅ | Waarom geblokkeerd (JSON) |
| `previous_service_id` | uuid | ✅ | Vorige dienst (keten tracking) |
| `ort_run_id` | uuid | ✅ | **AFL run tracking** |
| `updated_at` | timestamp | ✅ | NOW() |

---

## 🛑 Troubleshooting

### Error: "Database write failed"

**Oorzaken:**
- Supabase credentials niet ingesteld
- Netwerk connectie verbroken
- Rooster ID niet geldig
- Database schema mismatch

**Oplossing:**
1. Verifieer `NEXT_PUBLIC_SUPABASE_URL` env var
2. Verifieer `SUPABASE_SERVICE_ROLE_KEY` env var
3. Check rooster exists: `SELECT * FROM roosters WHERE id = '...'`

### Error: "No tasks found"

**Oorzaak:** `roster_period_staffing_dagdelen` is leeg (aantal=0)

**Oplossing:**
1. Controleer rooster configuratie
2. Verifieer taken zijn aangemaakt voordat AFL runt

### Error: "No planning slots found"

**Oorzaak:** `roster_assignments` niet geïnitialiseerd

**Oplossing:**
1. Zorg dat rooster aanmaak fase volledig is
2. Check: `SELECT COUNT(*) FROM roster_assignments WHERE roster_id = '...'` moet ~1155 zijn

### Slow Execution (>10 seconds)

**Oorzaken:**
- Database latency
- Large rooster (15+ employees)
- Network issues

**Tip:** Controleer `phase_timings` om te zien welke fase traag is

---

## 🎯 Next Steps

### Voor Frontend Integratieert
1. Voeg "Run AFL" knop toe in UI
2. Show loading state
3. Display results/errors
4. Refresh rooster data

### Voor Monitoring
1. Log `afl_run_id` naar analytics
2. Track execution times
3. Alert op failures
4. Monitor database load

### Voor Deployment
1. Set env vars op Railway
2. Test op staging rooster
3. Monitor in production
4. Build rollback procedure

---

## 📋 API Reference

### `runAflPipeline(rosterId: string): Promise<AflExecutionResult>`

Hoofdingangspunt voor complete AFL execution (Fase 1→4).

**Параметры:**
- `rosterId` (required): UUID van rooster

**Returns:**
- `AflExecutionResult` met success status, run ID, en timings

**Throws:**
- Error if any phase fails (caught internally, returned in result.error)

**Performance:**
- Typical: 6-7 seconds
- Min: 4-5 seconds
- Max: 10-12 seconds (large rooster)

---

## 🛧 Maintenance

### Monitoring Phase 4 Execution

```sql
-- Zie alle AFL runs
SELECT DISTINCT ort_run_id, COUNT(*) as affected_assignments
FROM roster_assignments
WHERE source = 'autofill'
GROUP BY ort_run_id
ORDER BY updated_at DESC;

-- Zie gedetails van speciale run
SELECT * FROM roster_assignments
WHERE ort_run_id = 'run-uuid-here'
ORDER BY employee_id, date, dagdeel;
```

### Cleanup (if needed)

```sql
-- Revert specific run (if rollback needed)
UPDATE roster_assignments
SET status = 0, service_id = NULL, source = NULL
WHERE ort_run_id = 'run-uuid-to-revert';
```

---

**Vragen?** Check [DRAAD-228-Phase4-IMPLEMENTATIE.md](./DRAAD-228-Phase4-IMPLEMENTATIE.md) for technical details.
