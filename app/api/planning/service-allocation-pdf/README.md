# Service Allocation PDF API Endpoint

## DRAAD52 - Fixed Implementation

### URL
```
GET /api/planning/service-allocation-pdf?rosterId={uuid}
```

### Purpose
Haalt alle dienst-allocatie data op voor PDF generatie van het scherm "Diensten per Dagdeel Aanpassen".

---

## 🔧 Probleem Opgelost

### Originele Issue (DRAAD48)
- **Locatie**: API route stond in `src/app/api/planning/` (verkeerde locatie)
- **Query**: Complexe nested Supabase query die faalde bij JOINs
- **Resultaat**: 500 errors, data niet opgehaald

### Nieuwe Oplossing (DRAAD52)
- **Locatie**: Verplaatst naar `app/api/planning/service-allocation-pdf/route.ts` ✅
- **Query**: 5-staps approach zonder complexe JOINs ✅
- **Resultaat**: Robuuste data fetching met error handling ✅

---

## 📊 5-Staps Data Fetching

### Step 1: Roster Info
```typescript
Fetch from: roosters
Filter: id = rosterId
Fields: id, start_date, end_date, naam
```

### Step 2A: Base Staffing Records
```typescript
Fetch from: roster_period_staffing
Filter: roster_id = rosterId
Fields: id, roster_id, service_id, date
Order by: date ASC
```

### Step 2B: Dagdeel Details
```typescript
Fetch from: roster_period_staffing_dagdelen
Filter: roster_period_staffing_id IN [staffingIds]
        AND aantal > 0
Fields: id, roster_period_staffing_id, dagdeel, team, status, aantal
Order by: dagdeel ASC
```

### Step 2C: Service Types
```typescript
Fetch from: service_types
Filter: id IN [serviceIds]
Fields: id, code, naam
```

### Step 3: Create Lookup Maps
```typescript
serviceMap: Map<serviceId, {code, naam}>
staffingMap: Map<staffingId, {date, serviceId}>
```

### Step 4: Transform & Group
```typescript
grouped: {
  [date]: {
    [team]: {
      [dagdeel]: Array<{code, status, aantal}>
    }
  }
}
```

### Step 5: Return Structured Data
```typescript
{
  roster: { id, start_date, end_date, naam },
  data: grouped,
  isEmpty: boolean,
  stats: { totalDates, totalRecords, serviceTypes }
}
```

---

## 📥 Request

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `rosterId` | UUID | ✅ Yes | ID van de roosterperiode |

### Example Request
```bash
GET /api/planning/service-allocation-pdf?rosterId=abc123-def456-ghi789
```

---

## 📤 Response

### Success Response (200)
```json
{
  "roster": {
    "id": "abc123-def456-ghi789",
    "start_date": "2025-11-24",
    "end_date": "2025-12-28",
    "naam": "Week 48 - Week 52"
  },
  "data": {
    "2025-11-24": {
      "totaal": {
        "ochtend": [
          { "code": "WDW", "status": "definitief", "aantal": 3 },
          { "code": "SPK", "status": "definitief", "aantal": 2 }
        ],
        "middag": [
          { "code": "WDW", "status": "definitief", "aantal": 2 }
        ]
      },
      "groen": {
        "ochtend": [
          { "code": "WDW", "status": "definitief", "aantal": 2 }
        ]
      }
    },
    "2025-11-25": {
      // ... more dates
    }
  },
  "isEmpty": false,
  "stats": {
    "totalDates": 35,
    "totalRecords": 147,
    "serviceTypes": 8
  }
}
```

### Empty Data Response (200)
```json
{
  "roster": {
    "id": "abc123-def456-ghi789",
    "start_date": "2025-11-24",
    "end_date": "2025-12-28",
    "naam": "Week 48 - Week 52"
  },
  "data": {},
  "isEmpty": true,
  "message": "Geen diensten gevonden voor deze roosterperiode"
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "error": "Roster ID is verplicht"
}
```

#### 404 - Not Found
```json
{
  "error": "Rooster niet gevonden: <details>"
}
```

#### 500 - Server Error
```json
{
  "error": "Fout bij ophalen staffing data: <details>"
}
```

---

## 🗄️ Database Schema

### Tables Used

#### roosters
```sql
id          UUID PRIMARY KEY
start_date  DATE
end_date    DATE
naam        TEXT
```

#### roster_period_staffing
```sql
id          UUID PRIMARY KEY
roster_id   UUID FOREIGN KEY → roosters(id)
service_id  UUID FOREIGN KEY → service_types(id)
date        DATE
```

#### roster_period_staffing_dagdelen
```sql
id                        UUID PRIMARY KEY
roster_period_staffing_id UUID FOREIGN KEY → roster_period_staffing(id)
dagdeel                   TEXT (ochtend, middag, avond, nacht, wdw)
team                      TEXT (totaal, groen, oranje)
status                    TEXT (definitief, aangepast)
aantal                    INTEGER
```

#### service_types
```sql
id     UUID PRIMARY KEY
code   TEXT (WDW, SPK, KP, etc.)
naam   TEXT
```

---

## 🚀 Testing

### Via Railway Logs
1. Open Railway dashboard: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
2. Ga naar service logs
3. Zoek naar `[PDF-API]` tags

### Error Types te Monitoren
```typescript
[PDF-API] Roster fetch error:      // Step 1 fail
[PDF-API] Staffing fetch error:    // Step 2A fail
[PDF-API] Dagdelen fetch error:    // Step 2B fail
[PDF-API] Service types fetch error: // Step 2C fail
[PDF-API] Orphaned dagdeel record: // Data integrity warning
[PDF-API] Unexpected error:        // Catch-all
```

---

## ✅ Voordelen 5-Staps Approach

| Aspect | Oude Approach | Nieuwe Approach |
|--------|---------------|------------------|
| **Query Complexiteit** | Nested JOIN in Supabase client | 3 simpele queries |
| **Error Handling** | 1 catch-all | Per stap error handling |
| **Debugging** | Moeilijk te traceren | Duidelijke stap logging |
| **Performance** | N+1 query risico | Optimale batch queries |
| **Maintenance** | Fragiel bij schema changes | Robuust en flexibel |

---

## 🔄 Volgende Stappen (DRAAD53)

1. Test API route via Railway deployment
2. Verificeer response data structure
3. Integreer met PDF generator component
4. Test volledige PDF export flow

---

## 📝 Change Log

### DRAAD52.1 (2025-11-24)
- ✅ Verplaatst van `src/app/api/` naar `app/api/`
- ✅ Herschreven naar 5-staps approach
- ✅ Verbeterde error handling per query stap
- ✅ Toegevoegd stats in response
- ✅ Map-based lookups voor efficiency
- ✅ Documentatie toegevoegd

### DRAAD48 (Origineel)
- ❌ Complexe nested query faalde
- ❌ Verkeerde directory locatie
- ❌ Beperkte error handling
