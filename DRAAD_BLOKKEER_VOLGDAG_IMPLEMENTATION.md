# Implementatieoverzicht: DRAAD89 - blokkeer_volgdag

## Hoofdfuncties
- Regel 1: Nachtdienst (eindtijd 09:00) blokkeert O+M van volgende dag
- Regel 2: Dagdienst (begintijd 09:00) blokkeert M van zelfde dag
- Regel 3: Clean Slate strategie bij wijzigen/verwijderen (reverse blocking)
- Warnings bij blokkering buiten roosterperiode
- Generiek voor alle diensten (niet alleen DDA)

## Gebruikte Database Queries
- SELECT id, blokkeert_volgdag, begintijd, eindtijd FROM services WHERE id = $1
- UPDATE roster_assignments SET status = 2, service_id = NULL WHERE ... (block)
- UPDATE roster_assignments SET status = 0 WHERE ... AND status = 2 AND service_id IS NULL (unblock)

## Geteste scenario's
- [x] Test 1: Nachtdienst blokkeert O+M volgende dag
- [x] Test 2: Dagdienst blokkeert M zelfde dag
- [x] Test 3: Warning buiten roosterperiode
- [x] Test 4: Verwijderen dienst deblokkeerd
- [x] Test 5: Wijzigen naar niet-blokkerende dienst
- [x] Test 6: Wijzigen naar andere blokkerende dienst (Clean Slate)
- [x] Test 7: Dienst zonder blokkeer_volgdag geen effect
- [x] Test 8: Reeds geblokkeerde cel niet overschrijven

## Deployment
- Railway trigger: .railway-trigger-blokkeer-volgdag-v1
- Cachebust: public/cachebust.json

## Known limitations
- Geen breaking changes; backwards compatible met bestaande roosters
- Styling status 2 (grijs ruitje) niet aangepast

## Tijdstip deployment
- 2025-12-01T00:39 (CET)

## Console Logging Format
Zie code: 🔒 🔓 ✅ ⚠️ ❌

---
DRAAD: blokkeer_volgdag implementation
