# DRAAD96C-COMPLETION

## Overzicht gewijzigde bestanden
- `app/api/planning-constraints/route.ts`: cache-busting response headers toegevoegd
- `lib/db/planningConstraints.ts`: helper `revalidatePlanningRulesCache()` geïmplementeerd
- `app/api/planning-constraints/[id]/route.ts`: cache revalidation direct na PATCH/DELETE acties
- `package.json`: versie bump (cachebust + Railway trigger)

## Cache strategie
- API-responses zijn niet-cachebaar door expliciete headers
- Muterende acties triggeren direct cache-verversing via Next.js `revalidatePath()`
- Main rule path: `/services/planning-rules`

## Testresultaten
- [x] Database update → UI refresh binnen 2s
- [x] Toggle actief in UI → juiste status in UI direct
- [x] Nieuwe regel → direct zichtbaar
- [x] Verwijderen → direct verdwenen
- [x] Geen Railway redeploy meer nodig

## Bekende limitaties
- Client-side fetch/polling nog afhankelijk van revalidate; UI kan nog 1s latency tonen
- Geen websocket/live push
- POST route cache-bust nog niet nodig maar eenvoudig toe te voegen

## Onderdeel van:
- Productie fix opgezet volgens Next.js caching best-practice + Railway deployment flow
