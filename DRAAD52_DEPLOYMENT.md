# DRAAD52.1 - PDF Export Fix Deployment

## ✅ Voltooide Acties

### 1. API Route Verplaatst
- **Van**: `src/app/api/planning/service-allocation-pdf/route.ts`
- **Naar**: `app/api/planning/service-allocation-pdf/route.ts`
- **Status**: ✅ Voltooid
- **Commit**: `f1cc35f47e57f923dcbbd64e12fd37c579d8b338`

### 2. 5-Staps Query Approach Geïmplementeerd

#### Stap 1: Roster Info
```typescript
Fetch roosters WHERE id = rosterId
```

#### Stap 2A: Base Staffing Records  
```typescript
Fetch roster_period_staffing WHERE roster_id = rosterId
ORDER BY date ASC
```

#### Stap 2B: Dagdeel Details
```typescript
Fetch roster_period_staffing_dagdelen 
WHERE roster_period_staffing_id IN [staffingIds]
AND aantal > 0
ORDER BY dagdeel ASC
```

#### Stap 2C: Service Types
```typescript
Fetch service_types WHERE id IN [serviceIds]
```

#### Stap 3: Lookup Maps
```typescript
serviceMap: Map<serviceId, {code, naam}>
staffingMap: Map<staffingId, {date, serviceId}>
```

#### Stap 4: Transform & Group
```typescript
grouped[date][team][dagdeel] = [{code, status, aantal}]
```

#### Stap 5: Return Data
```typescript
{ roster, data, isEmpty, stats }
```

### 3. Error Handling Verbeterd
- ✅ Per stap error handling met specifieke error messages
- ✅ Console logging met `[PDF-API]` prefix voor debugging
- ✅ Orphaned record warnings
- ✅ Empty data handling

### 4. Oude Bestanden Verwijderd
- **Verwijderd**: `src/app/api/planning/service-allocation-pdf/`
- **Status**: ✅ Directory automatisch verwijderd
- **Commit**: `19901e9ed3a91c70a3a7e66e8ba65549452e94f5`

### 5. Documentatie Toegevoegd
- **Bestand**: `app/api/planning/service-allocation-pdf/README.md`
- **Bevat**: 
  - API specificatie
  - 5-staps flow
  - Request/Response voorbeelden
  - Database schema
  - Testing instructies
  - Changelog
- **Commit**: `40b492e14f2cc155eb6bdcd4c41eea402909282b`

---

## 🚀 Railway Deployment

### Automatische Deployment
Railway detecteert de GitHub push automatisch en triggert een nieuwe deployment.

**Railway Project**: 
- URL: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
- Service: rooster-app-verloskunde
- Environment: Production

### Deployment Status Checken
1. Open Railway dashboard
2. Ga naar "Deployments" tab
3. Zoek naar laatste deployment (vanaf commit `40b492e1`)
4. Wacht tot status = "Active" ✅

### Verwachte Deployment Tijd
- Build time: ~2-3 minuten
- Total deployment: ~3-5 minuten

---

## 🧪 Verificatie Checklist

### Na Railway Deployment

#### 1. API Route Bereikbaar?
```bash
GET https://[jouw-railway-url]/api/planning/service-allocation-pdf?rosterId=[test-roster-id]
```

**Verwacht**: 
- Status: 200 of 400 (niet 404!)
- 404 = verkeerde route locatie
- 400 = route werkt, maar invalid rosterId

#### 2. Test Met Echte Roster ID
```bash
GET https://[jouw-railway-url]/api/planning/service-allocation-pdf?rosterId=[bestaande-roster-id]
```

**Verwacht Response**:
```json
{
  "roster": { ... },
  "data": { ... },
  "isEmpty": false,
  "stats": {
    "totalDates": ...,
    "totalRecords": ...,
    "serviceTypes": ...
  }
}
```

#### 3. Railway Logs Checken
1. Open Railway dashboard > Logs tab
2. Filter op "PDF-API"
3. Zoek naar:
   - `[PDF-API] Roster fetch error:` (none expected)
   - `[PDF-API] Staffing fetch error:` (none expected)
   - `[PDF-API] Dagdelen fetch error:` (none expected)

**Geen errors = succes! ✅**

#### 4. UI Test - PDF Knop
1. Log in op applicatie
2. Ga naar scherm "Diensten per Dagdeel Aanpassen"
3. Selecteer een roosterperiode met data
4. Klik op "PDF export gehele rooster (5 weken)" knop
5. Controleer:
   - Geen errors in browser console
   - PDF data wordt opgehaald
   - (PDF generatie is volgende stap - DRAAD53)

---

## 🐛 Troubleshooting

### Probleem: 404 Not Found
**Oorzaak**: API route niet correct geplaatst
**Oplossing**: Verifieer dat `app/api/planning/service-allocation-pdf/route.ts` bestaat

### Probleem: 500 Server Error
**Oorzaak**: Database query faalt
**Oplossing**: 
1. Check Railway logs voor specifieke error
2. Zoek naar `[PDF-API]` tags
3. Identificeer welke stap faalt (1, 2A, 2B, 2C)

### Probleem: Lege Data Response
**Verwacht Gedrag**: Geen diensten in periode
**Check**: 
```sql
SELECT COUNT(*) 
FROM roster_period_staffing_dagdelen rpsd
JOIN roster_period_staffing rps ON rpsd.roster_period_staffing_id = rps.id
WHERE rps.roster_id = '[roster-id]'
AND rpsd.aantal > 0;
```

### Probleem: Orphaned Records Warning
**Log**: `[PDF-API] Orphaned dagdeel record: [id]`
**Oorzaak**: Data integriteit issue
**Impact**: Minimaal - record wordt overgeslagen
**Actie**: Noteer ID voor latere cleanup

---

## 📈 Performance Verwachtingen

### Query Performance
| Stap | Expected Time | Records |
|------|--------------|----------|
| Roster info | <50ms | 1 |
| Staffing records | <200ms | ~500-1000 |
| Dagdelen details | <300ms | ~2000-4000 |
| Service types | <100ms | ~10-20 |
| Transform | <50ms | In-memory |
| **Total** | **<700ms** | |

### Geheugen Gebruik
- Lookup Maps: ~2-5 KB per roster
- Grouped data: ~10-20 KB per roster
- **Total**: <50 KB per request

---

## 📝 Commits Overzicht

### Commit 1: API Route Aanmaken
```
SHA: f1cc35f47e57f923dcbbd64e12fd37c579d8b338
Message: DRAAD52.1: Verplaats en herwerk service-allocation-pdf API route - 5-staps approach
Datum: 2025-11-24 21:31:48 UTC
```

### Commit 2: Oude Route Verwijderen
```
SHA: 19901e9ed3a91c70a3a7e66e8ba65549452e94f5
Message: DRAAD52.1: Verwijder oude service-allocation-pdf route uit src directory
Datum: 2025-11-24 21:31:58 UTC
```

### Commit 3: Documentatie
```
SHA: 40b492e14f2cc155eb6bdcd4c41eea402909282b
Message: DRAAD52.1: Voeg documentatie toe voor service-allocation-pdf API
Datum: 2025-11-24 21:32:55 UTC
```

---

## ➡️ Volgende Stappen (DRAAD53)

1. ⏳ **WACHT**: Railway deployment voltooid
2. ✅ **VERIFY**: API route bereikbaar en werkend
3. 🔧 **BUILD**: PDF generator component met jsPDF
4. 🔗 **INTEGRATE**: Koppel PDF generator aan API data
5. 🐛 **TEST**: Volledige PDF export flow

### API Ready Criteria
- [x] Route verplaatst naar juiste locatie
- [x] 5-staps query geïmplementeerd
- [x] Error handling per stap
- [x] Documentatie compleet
- [x] Code gepushed naar GitHub
- [ ] Railway deployment actief (volgt automatisch)
- [ ] API test succesvol (na deployment)
- [ ] UI test succesvol (na deployment)

---

## 💬 Contact & Support

**GitHub Repository**: https://github.com/gslooters/rooster-app-verloskunde

**Railway Project**: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f

**Deployment Branch**: `main`

---

**Status DRAAD52.1**: ✅ VOLTOOID

**Klaar voor**: DRAAD52.2 (Testing) of DRAAD53 (PDF Generator)
