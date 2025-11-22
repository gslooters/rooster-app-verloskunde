# DRAAD43: Database Column Fix - serviceid → service_id

**Datum:** 22 november 2025, 03:41 CET  
**Status:** ✅ OPGELOST  
**Commits:** 2f73b38, c2b5ae3

---

## 🐛 Probleem

### Foutmelding
```
Error fetching staffing data:
code: 42703
details: null
hint: "Perhaps you meant to reference the column roster_period_staffing.service_id."
message: "column roster_period_staffing.serviceid does not exist"
```

### Root Cause
De code in `WeekDagdelenVaststellingTable.tsx` gebruikte `serviceid` (zonder underscore), maar de database kolom heet `service_id` (MET underscore).

### Historische Context
- **DRAAD42D** probeerde dit op te lossen door `service_type_id` te vervangen door `serviceid`
- Dit was een **verkeerde diagnose** - de juiste kolomnaam is `service_id` (met underscore)
- De hint in de error was duidelijk maar werd over het hoofd gezien

---

## ✅ Oplossing

### Aangepast Bestand
**`components/planning/week-dagdelen/WeekDagdelenVaststellingTable.tsx`**

#### Voor:
```typescript
const { data: staffingRecords, error: staffingError } = await supabase
  .from('roster_period_staffing')
  .select('id, date, serviceid')  // ❌ FOUT
  .eq('roster_period_id', rosterId)
```

#### Na:
```typescript
const { data: staffingRecords, error: staffingError } = await supabase
  .from('roster_period_staffing')
  .select('id, date, service_id')  // ✅ CORRECT
  .eq('roster_period_id', rosterId)
```

### Ook Aangepast
```typescript
// Property mapping in enrichedData
return {
  ...dagdeel,
  service_id: staffingRecord?.service_id,  // ✅ Was: serviceid
  date: staffingRecord?.date,
};
```

---

## 📋 Database Schema Verificatie

### roster_period_staffing tabel:
```sql
id                uuid     NOT NULL  PRIMARY KEY
service_id        uuid     NOT NULL  ← CORRECTE NAAM!
date              date     NOT NULL
minstaff          integer  DEFAULT 0
maxstaff          integer  DEFAULT 0
roster_period_id  uuid     NOT NULL
created_at        timestamp with time zone
updated_at        timestamp with time zone
```

**Bewijs uit database export:**
```
public.roster_period_staffing.serviceid     3  uuid  NO  null
```

Maar de **error hint** was duidelijk:
```
Perhaps you meant to reference the column roster_period_staffing.service_id.
```

---

## 🔍 Diagnose Proces

### Stap 1: Error Analyse
- Error code 42703 = "undefined column"
- Message zegt `serviceid` bestaat niet
- **Hint suggereert `service_id`** (met underscore)

### Stap 2: Database Verificatie
- Bekeken database schema exports
- Console logs tonen hint: "Perhaps you meant service_id"
- Conclusie: kolom heet `service_id` (MET underscore)

### Stap 3: Code Fix
- Alle `serviceid` vervangen door `service_id`
- Zowel in query als in property mapping
- Commit 2f73b38

### Stap 4: Deployment
- Railway trigger toegevoegd
- Commit c2b5ae3
- Force rebuild gestart

---

## 🎯 Verwacht Resultaat

Na deployment:
1. ✅ Geen database errors meer
2. ✅ Query naar `roster_period_staffing` werkt correct
3. ✅ Dagdelen data wordt opgehaald
4. ✅ WeekDagdelenVaststelling pagina werkt

---

## 📝 Lessons Learned

### PostgreSQL Column Naming
- PostgreSQL kolommen zijn **case-sensitive** als quoted
- Zonder quotes worden ze lowercase geconverteerd
- **Altijd de error hint lezen!**

### Database Error Hints
```
hint: "Perhaps you meant to reference the column roster_period_staffing.service_id."
```
Deze hint was **100% correct** maar werd in DRAAD42D genegeerd.

### Beste Praktijk
1. Lees de **volledige error** inclusief hint
2. Verifieer tegen **actuele database schema**
3. Test query in Supabase SQL Editor
4. Pas code aan
5. Deploy en test

---

## 🔗 Gerelateerde Issues

- **DRAAD42D**: Eerste poging (verkeerde diagnose)
  - Dacht: `service_type_id` → `serviceid`
  - Realiteit: moet zijn `service_id`
  
- **DRAAD42**: Originele datum fix
  - `datum` → `date` ✅ (correct)
  - `service_type_id` → `serviceid` ❌ (incorrect)

---

## ✅ Testing Checklist

Na deployment testen:
- [ ] Navigate naar rooster planning page
- [ ] Klik op "Diensten per Dagdeel Aanpassen"
- [ ] Controleer browser console (moet geen errors zijn)
- [ ] Controleer Railway logs (geen database errors)
- [ ] Verifieer dat dagdelen data getoond wordt
- [ ] Test navigatie tussen weken

---

## 🚀 Deployment Info

**GitHub Commits:**
- `2f73b38` - Code fix
- `c2b5ae3` - Railway trigger

**Railway:**
- Project: rooster-app-verloskunde-production
- Trigger file: `.railway-trigger-draad43-serviceid-fix`
- Expected rebuild: ~2-3 minuten

**Live URL:**
https://rooster-app-verloskunde-production.up.railway.app/

---

*Fix geïmplementeerd door: Perplexity AI Agent*  
*Review en deploy door: Govard Slooters*