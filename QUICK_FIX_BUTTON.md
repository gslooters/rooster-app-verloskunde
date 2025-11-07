# ⚡ SNELLE FIX - 2 REGELS CODE TOEVOEGEN

## Wat te doen
Voeg de "Diensten per dag" knop toe aan het Rooster Ontwerp scherm.

## Waar
Bestand: `app/planning/design/page.client.tsx`

---

## STAP 1: Zoek regel ~10-30 (imports sectie)

Zoek naar de imports bovenaan het bestand. Dit ziet er ongeveer zo uit:

```tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, ... } from 'lucide-react';
// ... meer imports ...
```

### VOEG TOE (1 regel):

```tsx
import PeriodStaffingButton from '@/app/_components/PeriodStaffingButton';
```

**Positie**: Voeg deze regel toe NA de andere import statements, maar VOOR de component definitie.

---

## STAP 2: Zoek regel ~400-600 (knoppen sectie)

Zoek naar de code waar "Ga naar Bewerking" knop staat. Dit ziet er ongeveer zo uit:

```tsx
<div className="flex gap-3 items-center">
  {/* Mogelijk: Weekend, Feestdag knoppen hier */}
  
  <button
    onClick={() => setShowBewerking(true)}
    className="... bg-green-600 ..."
  >
    Ga naar Bewerking →
  </button>
</div>
```

### VOEG TOE (1 regel) VOOR de "Ga naar Bewerking" knop:

```tsx
<PeriodStaffingButton rosterId={activeDesign?.id || ''} />
```

### Resultaat moet zijn:

```tsx
<div className="flex gap-3 items-center">
  {/* Weekend, Feestdag knoppen */}
  
  {/* NIEUWE REGEL HIERONDER */}
  <PeriodStaffingButton rosterId={activeDesign?.id || ''} />
  
  <button
    onClick={() => setShowBewerking(true)}
    className="... bg-green-600 ..."
  >
    Ga naar Bewerking →
  </button>
</div>
```

---

## KLAAR!

1. **Opslaan**: Sla het bestand op
2. **Commit**: `git add .` en `git commit -m "feat: add period staffing button"`
3. **Push**: `git push origin main`
4. **Vercel**: Deploy gebeurt automatisch (2-3 minuten)
5. **Test**: Refresh de app, klik op de blauwe "📅 Diensten per dag" knop

---

## Als je de locatie niet kunt vinden

### Gebruik de zoekfunctie in je editor:

**Zoek naar**: `"Ga naar Bewerking"`

Dit brengt je direct naar de juiste locatie. Voeg de `<PeriodStaffingButton />` regel toe BOVEN deze knop.

---

## Component is al klaar

De `PeriodStaffingButton` component bestaat al in:
`app/_components/PeriodStaffingButton.tsx`

Deze component:
- ✅ Heeft blauwe styling
- ✅ Toont een kalender icoon + "📅 Diensten per dag" tekst
- ✅ Navigeert automatisch naar het juiste scherm
- ✅ Werkt met de juiste rooster ID

---

## Visueel Resultaat

Na de fix zie je in het Rooster Ontwerp scherm:

```
[Weekend] [Feestdag] [📅 Diensten per dag] [Ontwerpfase] [Ga naar Bewerking →]
```

De nieuwe knop heeft:
- Blauwe achtergrond
- Witte tekst
- Kalender icoon
- Hover effect

---

## Hulp nodig?

Stuur screenshot van:
1. De regel waar "Ga naar Bewerking" staat (+ 10 regels ervoor en erna)
2. De imports sectie bovenaan het bestand

Dan kan ik de exacte positie pinpointen.
