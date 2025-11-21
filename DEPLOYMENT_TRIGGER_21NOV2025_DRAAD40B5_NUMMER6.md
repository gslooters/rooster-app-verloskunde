# Deployment Trigger - DRAAD40B5 Nummer 6

**Datum:** 21 november 2025
**Tijd:** 14:40 CET
**Draad:** DRAAD40B5 nummer 6

## Wijziging

### PROBLEEM
- Header layout FOUT: emoji's stonden BOVEN de dagnamen
- Gebruiker ziet op scherm: emoji boven tekst (ochtend/middag/avond)
- Deploy lukte wel, maar wijziging werd NIET doorgevoerd

### OPLOSSING
**File:** `components/diensten/DagblokMatrix.tsx`

**Wijziging in `<thead>` sectie:**

VAN:
```tsx
<div className="flex flex-col items-center">
  <span className="text-lg mb-1">
    {dagblok === 'O' ? '🌅' : dagblok === 'M' ? '☀️' : '🌙'}
  </span>
  <span>{DAGBLOK_NAMEN[dagblok]}</span>
</div>
```

NAAR:
```tsx
<div className="flex flex-col items-center">
  <span className="mb-1">{DAGBLOK_NAMEN[dagblok]}</span>
  <span className="text-lg">
    {dagblok === 'O' ? '🌅' : dagblok === 'M' ? '☀️' : '🌙'}
  </span>
</div>
```

**Resultaat:**
- Dagnaam (Ochtend/Middag/Avond) staat nu BOVEN de emoji
- Emoji staat nu ONDER de dagnaam

## Deploy Status

- ✅ Commit succesvol: `5b5f265a310c713d84ee68410943be72bf0e1694`
- 🚀 Railway deploy getriggerd via deze file
- 🔄 Wacht op Railway build...

## Validatie

Na deploy controleren:
1. Open: https://rooster-app-verloskunde-production.up.railway.app/diensten/regels
2. Check header layout: Dagnaam BOVEN emoji
3. Check volgorde: "Ochtend" / 🌅 / "Middag" / ☀️ / "Avond" / 🌙

## Commit Details

- SHA: `5b5f265a310c713d84ee68410943be72bf0e1694`
- Message: "fix: DRAAD40B5 nummer 6 - Dagnaam BOVEN emoji in header"
- Author: Govard Slooters
- Timestamp: 2025-11-21T13:40:28Z
