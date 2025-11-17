# OPDRACHT - DRAAD36C

## Urgente Herstelactie: Schermkoppelingen en Proceslogica DienstenPerDag

### Probleem
- De koppeling naar 'Diensten per Dag' stond in het Hoofd Dashboard i.p.v. exclusief in het Dashboard Rooster-Ontwerp.
- Dit is een kritisch procesonderdeel van het rooster-ontwerp en mag **niet** zelfstandig direct vanuit het hoofd-dashboard bereikbaar zijn.

### Doel
Implementeer de volgende herstelacties:

1. **Verwijder 'Diensten per Dag' kaart uit het hoofd-dashboard** (`app/dashboard/page.tsx`).
2. **Pas de ontwerpfase aan in Rooster-Ontwerp Dashboard** (`app/planning/design/dashboard/DashboardClient.tsx`):
   - Vernieuw de knop 'Diensten per dag aanpassen':
     - Verwijs naar `/diensten-per-dag?rosterId=...`
     - Titel = "Diensten per dagdeel aanpassen"
     - Omschrijving = "Beheer bezetting per dienst, dagdeel (Ochtend/Middag/Avond), per team."
     - Icon: 📅
     - Kleur: cyan/teal accent
   - Processeer voortgangsbalk/voltooid-status correct via deze stap.
3. **Controleer en commit wijzigingen**:
   - Volledige syntaxcontrole (geen warnings/errors)
   - Duidelijke commit messages
   - Railway deployment met rebuild trigger indien nodig

### Stappen
- [ ] Verwijder kaart uit dashboard
- [ ] Update DashboardClient.tsx koppelingen en tekst/icoon
- [ ] Test voor correcte integratie en flow
- [ ] Commit naar main met bondige maar volledige beschrijving
- [ ] Railway deployment/force rebuild indien vereist

### Eisen
- Alleen bereikbaar via rooster-ontwerp
- NL-talig, consistente UI/UX
- Documenteer je commits duidelijk

---
Deze opdrachtfile vormt het startpunt voor DRAAD36C en herstel van de correcte roosterflow.