# 🚀 DRAAD31C - Fixes Diensten Toewijzing Scherm

**Datum**: 15 november 2025, 17:27 VET  
**Status**: ✅ GEREED VOOR TESTING  
**Prioriteit**: NU

---

## 🔴 Oorspronkelijk Probleem

### Console Error
```
❌ Error 42501: "new row violates row-level security policy for table employee_services"
```

### UI Problemen
1. ❌ Checkboxes werken niet (401 Unauthorized)
2. ❌ Invoervelden niet zichtbaar/werkend
3. ❌ Totaal kolom staat achteraan (moet naast Naam)
4. ❌ Geen dienstwaarde weergave in headers
5. ❌ Teller gebruikt geen weging

---

## ✅ Uitgevoerde Fixes

### Fix 1: Database RLS Policies 🔒
**Bestand**: `supabase/migrations/20251115_fix_employee_services_rls.sql`

**Wijzigingen**:
- ✅ DROP oude restrictieve SELECT-only policy
- ✅ CREATE nieuwe policies voor SELECT, INSERT, UPDATE, DELETE
- ✅ Alle policies staan nu operaties toe: `USING (true)` en `WITH CHECK (true)`

**Instructies**:
- 📋 Zie: `supabase/migrations/README_EXECUTE_NOW.md`
- ⚠️ **ACTIE VEREIST**: SQL handmatig uitvoeren in Supabase Dashboard

---

### Fix 2: Frontend UI Component 🎨
**Bestand**: `app/settings/diensten-toewijzing/page.tsx`

**Wijzigingen**:

#### 1. Kolom Volgorde Aangepast
```
OUD: Team | Naam | DAG | DDA | ... | Totaal
NIEUW: Team | Naam | Totaal | DAG | DDA | ...
```

#### 2. Dienstwaarde in Headers
```tsx
<th>
  <div className="flex flex-col items-center">
    <span>{service.code}</span>
    {service.dienstwaarde !== 1.0 && (
      <span className="text-xs text-gray-500 mt-1">×{service.dienstwaarde}</span>
    )}
  </div>
</th>
```

#### 3. Invoervelden Werken Altijd
```tsx
<Input
  type="number"
  min="0"
  max="35"
  value={enabled ? count : ''}
  disabled={!enabled}
  onChange={(e) => handleCountChange(...)}
  className="w-16 h-8 text-center"
  placeholder="0"
/>
```

#### 4. Input Validatie
```tsx
if (newCount < 0 || newCount > 35) {
  setError('Aantal moet tussen 0 en 35 liggen');
  return;
}
```

#### 5. Totaal Kolom Highlighted
```tsx
<td className="border p-3 text-center font-bold bg-blue-50">
  <span className={employee.isOnTarget ? 'text-green-600' : 'text-gray-900'}>
    {employee.totalDiensten} / {employee.dienstenperiode}
  </span>
</td>
```

#### 6. Gewogen Berekening Behouden
```tsx
// Som van (aantal × dienstwaarde)
let newTotal = 0;
Object.values(newServices).forEach((s: any) => {
  if (s.enabled && s.count > 0) {
    newTotal += s.count * s.dienstwaarde;
  }
});
```

#### 7. UI Verbeteringen
- 🎯 Emoji in header titel
- 📊 Verbeterde footer met tips
- ✅ Success melding na opslaan
- ❌ Error handling bij ongeldige input

---

## 📝 Commits Overzicht

1. **c8b40f1** - Fix: RLS policies voor employee_services - enable INSERT/UPDATE
2. **f2654d5** - Fix: Diensten toewijzing UI - Totaal naar voren, invoervelden werkend
3. **766c84b** - Docs: Instructies voor RLS migration uitvoeren

---

## 🧪 Testing Checklist

### Database
- [ ] SQL migration uitgevoerd in Supabase Dashboard
- [ ] 4 policies zichtbaar in `pg_policies` tabel
- [ ] RLS enabled op `employee_services`

### Frontend - Basic Operations
- [ ] Pagina laadt zonder errors
- [ ] Medewerkers lijst toont correct (12 medewerkers)
- [ ] Dienst kolommen tonen correct (9 diensten)
- [ ] Totaal kolom staat tussen Naam en diensten

### Frontend - Interacties
- [ ] Checkbox aan/uit werkt zonder 401 error
- [ ] Invoerveld verschijnt bij actieve checkbox
- [ ] Invoerveld accepteert getallen 0-35
- [ ] Getallen buiten bereik tonen error
- [ ] Succes melding verschijnt na opslaan

### Frontend - Berekeningen
- [ ] Totaal berekent correct (gewogen: count × dienstwaarde)
- [ ] Groene kleur bij exact match met dienstenperiode
- [ ] Grijze kleur bij mismatch

### Frontend - UI Details
- [ ] Dienstwaarde ×2.0 toont bij DDA/DDO headers
- [ ] Team badges tonen correcte kleuren (Groen/Oranje/Overig)
- [ ] Totaal kolom heeft blauwe achtergrond
- [ ] Footer tips zijn zichtbaar

---

## 🔗 Links

- **GitHub Repository**: [rooster-app-verloskunde](https://github.com/gslooters/rooster-app-verloskunde)
- **Railway Deployment**: [Project Dashboard](https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f)
- **Live URL**: Wordt automatisch geüpdatet na Railway deployment

---

## 👁️ Verwacht Resultaat

### Voor Fix
```
❌ Console: 42501 error bij elke checkbox klik
❌ UI: Invoervelden niet zichtbaar
❌ UI: Totaal kolom achteraan
❌ UI: Geen dienstwaarde in headers
```

### Na Fix
```
✅ Console: Geen 401/42501 errors
✅ UI: Checkboxes werken instant
✅ UI: Invoervelden altijd zichtbaar bij actieve dienst
✅ UI: Totaal kolom naast Naam (3e kolom)
✅ UI: Dienstwaarde ×2.0 zichtbaar bij DDA/DDO
✅ UI: "Opgeslagen!" melding na elke wijziging
```

---

## ⚠️ Belangrijke Notities

1. **Database Migration Vereist**  
   De RLS policy fix moet **handmatig** uitgevoerd worden in Supabase Dashboard.  
   Railway kan dit niet automatisch doen omdat het een database wijziging betreft.

2. **Geen Data Verlies**  
   Alle bestaande data in `employee_services` blijft behouden.

3. **Backwards Compatible**  
   Oude code blijft werken (alleen lezen), nieuwe code kan nu ook schrijven.

4. **Auto-Deploy**  
   Railway detecteert de GitHub commits automatisch en deployt de nieuwe code.

---

## 👨‍💻 Next Steps

### Stap 1: Database Migration (⚠️ PRIORITEIT)
1. Open Supabase Dashboard
2. Ga naar SQL Editor
3. Voer `supabase/migrations/20251115_fix_employee_services_rls.sql` uit
4. Verifieer met `SELECT * FROM pg_policies WHERE tablename = 'employee_services';`

### Stap 2: Railway Deployment Checken
1. Ga naar Railway Dashboard
2. Check of deployment gestart is (trigger: GitHub commit)
3. Wacht op "Deployed" status
4. Noteer de live URL

### Stap 3: Testing
1. Open live URL + `/settings/diensten-toewijzing`
2. Volg testing checklist hierboven
3. Rapporteer eventuele issues

---

**Uitgevoerd door**: AI Assistant  
**Verified by**: Wacht op user verificatie  
**Deploy Status**: 🟡 Pending Railway deployment

---

## 📞 Support

Bij vragen of problemen:
1. Check browser console voor JavaScript errors
2. Check Network tab voor 401/403/500 errors
3. Verifieer database policies in Supabase Dashboard
4. Check Railway logs voor backend errors
