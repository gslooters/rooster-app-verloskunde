# 🚨 PRIORITEIT: Database Migration Uitvoeren

**Datum**: 15 november 2025  
**Status**: GEREED VOOR UITVOERING  
**Bestand**: `20251115_fix_employee_services_rls.sql`

## ❌ Probleem

De `employee_services` tabel heeft **te restrictieve RLS policies**:
- ✅ SELECT werkt
- ❌ INSERT/UPDATE/DELETE geblokkeerd
- Error: `42501 - "new row violates row-level security policy"`

## ✅ Oplossing

Voer het SQL migratiebestand uit in Supabase Dashboard.

## 📋 Stappen

### 1. Open Supabase Dashboard
- Ga naar: https://supabase.com/dashboard
- Selecteer project: **rooster-app-verloskunde**

### 2. Open SQL Editor
- Klik op **SQL Editor** in de linker sidebar
- Klik op **New Query**

### 3. Kopieer de SQL
Kopieer de **volledige inhoud** van dit bestand:
```
supabase/migrations/20251115_fix_employee_services_rls.sql
```

### 4. Plak en Uitvoeren
- Plak de SQL in de query editor
- Klik op **Run** (of druk Cmd+Enter / Ctrl+Enter)

### 5. Verifieer
Controleer dat deze policies nu bestaan:
```sql
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd 
FROM pg_policies 
WHERE tablename = 'employee_services';
```

Verwachte output: 4 policies (SELECT, INSERT, UPDATE, DELETE)

## 🔍 Alternatief: Via Railway Database

Als je Railway gebruikt:
1. Ga naar Railway dashboard
2. Open de Postgres database
3. Klik op **Data** tab
4. Klik op **Query**
5. Voer dezelfde SQL uit

## ✅ Checklist na Uitvoering

- [ ] SQL uitgevoerd zonder errors
- [ ] 4 policies zichtbaar in pg_policies
- [ ] Test: Klik op checkbox in Diensten Toewijzing scherm
- [ ] Geen 401/42501 errors meer in browser console
- [ ] Succes melding "Opgeslagen!" verschijnt

## 📞 Bij Problemen

Als de migration faalt:
1. Check console errors
2. Verifieer dat tabel `employee_services` bestaat
3. Controleer of RLS enabled is: `ALTER TABLE employee_services ENABLE ROW LEVEL SECURITY;`

---

**Na succesvolle uitvoering**: Railway zal automatisch de wijzigingen deployen via GitHub.
