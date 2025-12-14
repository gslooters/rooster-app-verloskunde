# 🚫 DRAAD178B - START HERE FOR NEXT THREAD

**Open deze file eerst in de nieuwe draad!**

---

## 🔴 KRITIEKE INFORMATIE

**Status**: 🔴 DASHBOARD IS BROKEN  
**Probleem**: Frontend queries verwijderde tabel → 404 errors  
**Oorzaak**: DRAAD178A fix was ONVOLLEDIG (API OK, Frontend NIET OK)  
**Oplossing**: Frontend queries updaten naar denormaliseerde tabel  

---

## 👡 VOOR JOU - VOORBEREIDING

### 1. Lees dit in VOLGORDE:

```
✅ EERST:  DRAAD178B-SUMMARY.md              (2 min - Oorzaak begrijpen)
✅ DAARNA: DRAAD178B-QUICK-REFERENCE.md    (5 min - Fixes kopie-plakken)
✅ LIEVER:  DRAAD178B-FRONTEND-REPAIR-OPDRACHT.md (10 min - Volledig plan)
✅ DETAILS: DRAAD178B-ROOT-CAUSE-ANALYSIS.md     (10 min - Technische achtergrond)
```

### 2. Zorg dat je hebt:

- [ ] VS Code open
- [ ] Project gecloned lokaal
- [ ] `npm install` gerund
- [ ] Terminal ready

### 3. Workflow in volgende thread:

```
1. Lees DRAAD178B-SUMMARY.md (2 min)
2. Open DRAAD178B-QUICK-REFERENCE.md naast VS Code
3. Run grep command om files te vinden
4. Update 5 files (30 min)
5. Test lokaal: npm run build (5 min)
6. Commit en push (3 min)
7. Wacht op Railway deploy (5 min)
8. Verify in browser (5 min)
```

---

## 🔍 GREP COMMAND (Voer dit uit in volgende thread)

```bash
grep -rn "from('roster_period_staffing')" --include="*.ts" --include="*.tsx" app lib components
```

Dit toont ALLE files die gerepareerd moeten worden.

---

## 🌟 5 FILES TE REPAREREN

### KRITIEK (Dashboard werkt niet zonder deze):
1. `lib/planning/weekDagdelenData.ts`
2. Week display component (waarschijnlijk `app/planning/design/week-dagdelen/page-[weekIndex].tsx`)
3. `app/planning/design/dagdelen-dashboard/DagdelenDashboardClient.tsx`

### SECUNDAIR (Controleren):
4. `app/api/planning/service-allocation-pdf/route.ts`
5. `lib/services/preplanning-storage.ts`

---

## 🚀 COPY-PASTE FIX VOOR FILE 1

**File**: `lib/planning/weekDagdelenData.ts`

### VERVANG DIT:

```typescript
const { data: rpsData, error } = await supabase
  .from('roster_period_staffing')
  .select('id, date, roster_period_staffing_dagdelen(...)')
  .eq('roster_id', rosterId)
  .gte('date', startDate)
  .lte('date', endDate);
```

### DOOR DIT:

```typescript
const { data: dagdelenData, error } = await supabase
  .from('roster_period_staffing_dagdelen')
  .select('id, roster_id, service_id, date, dagdeel, team, status, aantal, invulling, updated_at, created_at')
  .eq('roster_id', rosterId)
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date, service_id, dagdeel, team');

// Group by date + service_id
const weekData = new Map<string, typeof dagdelenData>();
if (dagdelenData?.length) {
  dagdelenData.forEach(record => {
    const key = `${record.date}|${record.service_id}`;
    if (!weekData.has(key)) {
      weekData.set(key, []);
    }
    weekData.get(key)?.push(record);
  });
}
return Object.fromEntries(weekData);
```

Voor de overige files: zie `DRAAD178B-QUICK-REFERENCE.md`

---

## ✅ CHECKLIST

**Voorbereiding**:
- [ ] GitHub files gelezen (SUMMARY + QUICK-REFERENCE)
- [ ] Lokale project setup klaar
- [ ] grep command gerund
- [ ] Alle 5 files geidentificeerd

**Executie**:
- [ ] File 1 gerepareerd + getest
- [ ] File 2 gerepareerd
- [ ] File 3 gerepareerd
- [ ] File 4 gecontroleerd
- [ ] File 5 gecontroleerd
- [ ] `npm run build` succesvol
- [ ] Geen TypeScript errors

**Deployment**:
- [ ] Git commit met juiste message
- [ ] git push naar main
- [ ] Railway deployment waited
- [ ] Dashboard geopend in browser
- [ ] Geen 404 errors in console
- [ ] Week data visible
- [ ] Services visible (niet "0 records")

---

## 📋 IMPORTANT NOTES

1. **DRAAD178A WAS INCOMPLETE**
   - Alleen API endpoint gerepareerd
   - Frontend code NIET gerepareerd
   - Dit is DRAAD178B (frontend fix)

2. **Scope is KLEIN**
   - Alleen query veranderingen
   - Geen database changes
   - Geen API changes
   - Alleen frontend updates

3. **Test ALLES na fix**
   - TypeScript compile check
   - Browser test
   - Console errors check
   - Network tab 200 OK check

4. **Backup**
   - Alle 4 repair instructie files zijn nu in GitHub
   - Je kunt ze anytime raadplegen
   - Gebruik ze als reference

---

## 🚫 KRITIEKE MELDINGEN

### ⚠️ STOP! Lees dit EERST:

```
Gebruik DRAAD178B-QUICK-REFERENCE.md als je in haast bent.
Gebruik DRAAD178B-FRONTEND-REPAIR-OPDRACHT.md voor volledig plan.
Gebruik DRAAD178B-ROOT-CAUSE-ANALYSIS.md voor details.
```

### ✅ BEST PRACTICE:

```
1. Open SUMMARY in browser/iPad
2. Open QUICK-REFERENCE naast VS Code
3. Werk stap voor stap
4. Test na elke file
5. Commit wanneer alles gereed
```

---

## ✨ EXPECTED RESULT

**Na de fix:**

```
✅ Dashboard loads without 404 errors
✅ Week 1-5 all show services
✅ "0 dagdelen records" message gone
✅ Service cells are clickable
✅ Modal opens for service details
✅ Console clean (no errors)
✅ Network tab shows 200 OK
```

---

## 📋 DOCUMENT MANIFEST

Alle benodigde bestanden zijn nu in GitHub:

| File | Purpose | Read Time |
|------|---------|----------|
| `DRAAD178B-SUMMARY.md` | Executive summary van probleem | 2 min |
| `DRAAD178B-QUICK-REFERENCE.md` | Copy/paste fixes per file | 5 min |
| `DRAAD178B-FRONTEND-REPAIR-OPDRACHT.md` | Complete step-by-step plan | 10 min |
| `DRAAD178B-ROOT-CAUSE-ANALYSIS.md` | Technical deep dive | 10 min |
| `DRAAD178B-INSTRUCTIONS-FOR-NEXT-THREAD.md` | Dit file - start hier | 5 min |

---

## 🚀 START PROCEDURE

**In de volgende thread:**

```markdown
# DRAAD178B - EXECUTION

## Setup
1. DONE: Read DRAAD178B-SUMMARY.md
2. DONE: Open DRAAD178B-QUICK-REFERENCE.md
3. Running: grep command to find files
4. Next: Update 5 files

## Files Found
- [ ] lib/planning/weekDagdelenData.ts
- [ ] app/planning/design/week-dagdelen/page-[...].tsx
- [ ] app/planning/design/dagdelen-dashboard/DagdelenDashboardClient.tsx
- [ ] app/api/planning/service-allocation-pdf/route.ts
- [ ] lib/services/preplanning-storage.ts

## Fixes Applied
- [ ] File 1: weekDagdelenData.ts
- [ ] File 2: Week page component
- [ ] File 3: Dashboard client
- [ ] File 4: PDF route (if needed)
- [ ] File 5: Storage utility (if needed)

## Testing
- [ ] npm run build
- [ ] No TypeScript errors
- [ ] Dashboard loads
- [ ] Week data visible

## Deployment
- [ ] Commit & push
- [ ] Railway deployed
- [ ] Production verified
```

---

**TIME ESTIMATE**: 45-60 minutes  
**DIFFICULTY**: Intermediate  
**PRIORITY**: 🔴 CRITICAL  

Good luck! 💪

---

**Last Update**: 2025-12-14 20:09 CET  
**Status**: READY FOR EXECUTION  
**Next Thread**: START HERE
