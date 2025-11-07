# 🚨 URGENT: Rollback Required

## Probleem
De laatste commit `bd443df` heeft het bestand `app/planning/design/page.client.tsx` OVERSCHREVEN met een incomplete versie, waardoor de build faalt.

## Oplossing: GitHub Web UI Rollback (2 minuten)

### Stap 1: Ga naar de commit history
1. Ga naar: https://github.com/gslooters/rooster-app-verloskunde/commits/main
2. Zoek commit `bd443df9d1d1299e78f935d0f52bf7fbb1064730`
3. Klik op de commit titel

### Stap 2: Revert de commit
1. Klik rechtsboven op de **3 dots** (`...`)
2. Selecteer **"Revert"**
3. GitHub maakt automatisch een revert commit
4. Klik **"Create revert commit"**

### Resultaat
- Het bestand `page.client.tsx` is teruggezet naar de werkende versie
- Vercel zal automatisch re-deployen
- De build slaagt weer

---

## Alternatief: Via git command (als je local access hebt)

```bash
git revert bd443df
git push origin main
```

---

## NA DE ROLLBACK

De "Beheer diensten" knop moet opnieuw worden toegevoegd, maar dan CORRECT:
- Via github.dev editor
- Of via een PR met de juiste wijzigingen

Ik (de AI) kan dit helaas niet automatisch voor je fixen vanwege de grootte van het bestand.
