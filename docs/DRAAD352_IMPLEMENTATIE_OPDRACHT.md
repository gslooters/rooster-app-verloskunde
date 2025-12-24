# 🛠️ DRAAD 352 - IMPLEMENTATIE OPDRACHT
## Blokkering-Status Fix: Reset-then-Insert Pattern

**Datum:** 24 december 2025  
**Issue:** Status 2 (blokkering) wordt niet opgeheven bij wijziging dienst  
**Voorbeeld:** Paula 25-11: DIO→OSP, M blijft status 2  
**Oorzaak:** Applicatiecode voert GEEN reset uit, trigger werkt niet correct

---

## 📋 CONTEXT & ANALYSE

### Probleem Beschrijving
Wanneer een dienst wordt gewijzigd (DIO → OSP), gebeurt dit:

```
VOOR:     O = status 1 + DIO    |  M = status 2 (geblokkeerd)
UPDATE:   O service_id wijzigt DIO→OSP
NA:       O = status 1 + OSP    |  M = status 2 ❌ (BLIJFT!)

GEWENST:  O = status 1 + OSP    |  M = status 0 (vrij)
```

### Root Cause
- `updateAssignmentService()` in `roster-assignments-supabase.ts` doet ALLEEN:
  ```typescript
  UPDATE roster_assignments SET service_id = 'osp-uuid' WHERE id = assignment_id
  ```
- Dit raakt **NIET** de blokkeringsrecord (ander `id`, ander `dagdeel`)
- Trigger detecteert update WEL, maar deblokkeerlogica werkt niet (blijft steken)

### Oplossing
**Reset-then-Insert Pattern:**

```sql
STAP 1: UPDATE assignment SET status = 0, service_id = NULL
        → Trigger ziet: status 0→0, deblockeert automatisch
        
STAP 2: UPDATE assignment SET status = 1, service_id = 'osp-uuid'
        → Trigger ziet: status 0→1, herberekent blokkages (OSP heeft geen blokkage)
```

**Resultaat:** M gaat terug naar status 0 (vrij)

---

## 🎯 IMPLEMENTATIE OPDRACHT

### FASE 1: Nieuwe Service-Functie Aanmaken

**Bestand:** `lib/services/roster-assignments-supabase.ts`

**Stap 1a:** Lees het volledige bestand (vanaf GitHub)

**Stap 1b:** Lokaliseer functie `updateAssignmentService()`

**Stap 1c:** Voeg NIEUWE functie toe (VOOR `updateAssignmentService`):

```typescript
/**
 * DRAAD 352: Change assignment service with proper blocking reset
 * 
 * Problem: Direct service_id update doesn't reset blocking on related dayparts
 * Solution: Use reset-then-insert pattern to trigger proper blocking recalculation
 * 
 * Flow:
 * 1. RESET: status 0, service_id NULL → Trigger deblockeert automatisch
 * 2. INSERT NEW: status 1, service_id = newServiceId → Trigger berekent nieuw
 */
export async function changeAssignmentServiceAtomic(
  assignmentId: string,
  newServiceId: string | null
): Promise<void> {
  // Validate input
  if (!assignmentId) {
    throw new Error('assignmentId is required');
  }

  try {
    // STAP 1: Fetch current assignment to preserve metadata
    const { data: currentAssignment, error: fetchError } = await supabase
      .from('roster_assignments')
      .select('roster_id, employee_id, date, dagdeel, service_id')
      .eq('id', assignmentId)
      .single();

    if (fetchError || !currentAssignment) {
      throw new Error(`Assignment not found: ${fetchError?.message}`);
    }

    // STAP 2: RESET - Status 0, service_id NULL
    // This triggers deblokkering of any blocking records
    const { error: resetError } = await supabase
      .from('roster_assignments')
      .update({
        status: 0,           // Available
        service_id: null,    // No service
        updated_at: new Date().toISOString()
      })
      .eq('id', assignmentId);

    if (resetError) {
      throw new Error(`Reset failed: ${resetError.message}`);
    }

    // STAP 3: Deblokkering wait (small delay to ensure trigger completion)
    // In production, consider using Supabase' transaction or proper event handling
    await new Promise(resolve => setTimeout(resolve, 100));

    // STAP 4: INSERT NEW SERVICE (if provided)
    if (newServiceId && newServiceId.trim()) {
      const { error: insertError } = await supabase
        .from('roster_assignments')
        .update({
          status: 1,                     // Assigned
          service_id: newServiceId,      // New service
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (insertError) {
        throw new Error(`Insert new service failed: ${insertError.message}`);
      }

      // Trigger will automatically calculate new blocking for this service
      // (if service has blokkeertvolgdag = true)
    }

    console.log(
      `✅ DRAAD 352: Assignment ${assignmentId} changed from ${currentAssignment.service_id} to ${newServiceId}`,
      `with proper blocking reset`
    );

  } catch (error) {
    console.error('❌ DRAAD 352: changeAssignmentServiceAtomic failed:', error);
    throw error;
  }
}
```

---

### FASE 2: UI-Integration (Where Used)

**Bestand:** Locate where `updateAssignmentService()` is called

Typische locaties:
- `components/RosterCell.jsx` / `.tsx`
- `pages/RosterEditor.jsx` / `.tsx`
- `lib/handlers/rosterHandlers.ts`
- `hooks/useRosterUpdate.ts`

**Stap 2a:** Vind ALLE calls naar `updateAssignmentService(assignmentId, newServiceId)`

**Stap 2b:** Vervang door `changeAssignmentServiceAtomic(assignmentId, newServiceId)`

**Voorbeeld:**
```typescript
// OUD:
await updateAssignmentService(assignmentId, newServiceId);

// NIEUW:
await changeAssignmentServiceAtomic(assignmentId, newServiceId);
```

**Stap 2c:** Behoud error handling (deze blijft hetzelfde)

---

### FASE 3: Testing & Verification

**Test Scenario 1: DIO → OSP (Paula 25-11)**

Precondition:
- Paula: Roster week 48, 25-11 (Dinsdag)
- O-dagdeel: DIO ingepland
- M-dagdeel: status 2 (geblokkeerd door DIO)

Test Steps:
1. Open roster UI, selecteer Paula 25-11
2. Wijzig O-dagdeel van DIO → OSP
3. Klik Save/Update

Expected Result:
```
✓ O-dagdeel: status 1 + OSP
✓ M-dagdeel: status 0 (VRIJ)
```

Query om te controleren:
```sql
SELECT 
  date, dagdeel, status, service_id, blocked_by_service_id
FROM roster_assignments
WHERE roster_id = '...' 
  AND employee_id = 'Paula'
  AND date = '2025-11-25'
ORDER BY dagdeel;
```

**Test Scenario 2: DIA → OSP (Blokkering van volgende dag)**

Precondition:
- DIA ingepland op datum X (nacht)
- O+M van datum X+1 zijn geblokkeerd (status 2)

Test Steps:
1. Wijzig DIA → OSP
2. Controleer volgende dag

Expected Result:
```
✓ Datum X: O = status 1 + OSP
✓ Datum X+1: O,M = status 0 (VRIJ)
```

**Test Scenario 3: Teruggaan naar beschikbaar (Delete)**

Test Steps:
1. Wijzig servicetype naar NULL/beschikbaar
2. Controleer

Expected Result:
```
✓ Dagdeel = status 0
✓ Alle blokkades opgeruimd
```

---

### FASE 4: Database Logging (Optional)

Als je audit trail wilt, voeg toe aan `changeAssignmentServiceAtomic()`:

```typescript
// After successful update, log the change
const { error: logError } = await supabase
  .from('roster_assignment_changes')  // New table for audit
  .insert({
    assignment_id: assignmentId,
    old_service_id: currentAssignment.service_id,
    new_service_id: newServiceId,
    changed_at: new Date().toISOString(),
    changed_by: currentUser.id  // If available
  });

if (logError) {
  console.warn('DRAAD 352: Could not log change:', logError);
  // Don't throw - logging failure shouldn't break the operation
}
```

---

## 📁 FILES IMPACTED

| File | Action | Impact |
|------|--------|--------|
| `lib/services/roster-assignments-supabase.ts` | ADD new function | `changeAssignmentServiceAtomic()` |
| RosterCell/Editor components | MODIFY calls | Use new function instead of old |
| `hooks/useRosterUpdate.ts` (if exists) | MODIFY calls | Use new function instead of old |
| Tests (if exist) | UPDATE | Add test for DRAAD 352 scenario |

---

## ✅ VALIDATION CHECKLIST

Before considering this DONE:

- [ ] New function `changeAssignmentServiceAtomic()` added to `roster-assignments-supabase.ts`
- [ ] Function properly handles NULL service_id (delete case)
- [ ] Function includes try-catch error handling
- [ ] All calls to `updateAssignmentService()` replaced with new function
- [ ] Test Scenario 1 (DIO→OSP) passes: M goes from status 2 → 0
- [ ] Test Scenario 2 (DIA→OSP) passes: Next-day blocking removed
- [ ] Test Scenario 3 (Delete) passes: Clears all blocking
- [ ] Database query confirms correct status values
- [ ] No console errors in browser
- [ ] Code follows TypeScript conventions
- [ ] PR description references DRAAD 352
- [ ] Documentation updated if needed

---

## 🔍 DEBUGGING TIPS

If blocking still doesn't reset:

1. **Check Trigger Execution:**
   ```sql
   -- Enable trigger verbose logging (if available)
   -- Check if trigger actually fires
   SELECT count(*) FROM pg_stat_user_functions 
   WHERE funcname = 'trg_roster_assignment_status_management';
   ```

2. **Verify Assignment Record:**
   ```sql
   SELECT * FROM roster_assignments WHERE id = 'assignment-id';
   ```

3. **Check Blocking Records:**
   ```sql
   SELECT * FROM roster_assignments 
   WHERE blocked_by_service_id = 'old-service-id';
   ```

4. **Browser Console:**
   - Check for JavaScript errors
   - Verify API response status (should be 200)
   - Check request/response payload

5. **Supabase Logs:**
   - Go to Railway → Supabase dashboard
   - Check query logs for any errors

---

## 📝 NOTES

- This is a **critical business logic fix** - double-check test scenarios
- The reset-then-insert pattern **is atomic from application perspective**, but uses two DB calls
- For true ACID compliance, consider moving to a Stored Procedure (future improvement)
- The 100ms delay after reset is a **temporary workaround** - better to use proper Supabase transactions in future

---

## 🚀 AFTER IMPLEMENTATION

1. Deploy to Railway
2. Test in production with Paula 25-11 DIO→OSP scenario
3. Document the fix in release notes
4. Close DRAAD 352 issue

---

**Created:** 24 december 2025  
**Status:** READY FOR IMPLEMENTATION  
**Assigned to:** You (via MCP tools)  
**Difficulty:** Medium (4-6 hours including testing)
