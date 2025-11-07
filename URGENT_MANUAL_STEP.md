# 🚨 URGENTE HANDMATIGE STAP - DIENSTEN PER DAG KNOP

## Probleem
De knop "Diensten per dag" ontbreekt in het Rooster Ontwerp scherm.

## Oplossing (1 minuut werk)

### Bestand te wijzigen
`app/planning/design/page.client.tsx`

### Stap 1: Zoek deze sectie (rond regel 250-300)
Zoek naar de code waar de knoppen "Weekend" en "Feestdag" staan. Dit ziet er ongeveer zo uit:

```tsx
{/* Bestaande knoppen sectie */}
<div className="flex items-center gap-3">
  {/* Weekend knop */}
  <button ...>Weekend</button>
  
  {/* Feestdag knop */}
  <button ...>Feestdag</button>
  
  {/* Ontwerpfase label */}
  <span ...>Ontwerpfase</span>
</div>
```

### Stap 2: Voeg BOVENAAN het bestand deze import toe

Zoek naar de imports bovenaan (rond regel 1-20):

```tsx
import { useState, useEffect, ... } from 'react';
// ... andere imports ...
```

**VOEG TOE NA DE ANDERE IMPORTS:**
```tsx
import PeriodStaffingButton from '@/app/_components/PeriodStaffingButton';
```

### Stap 3: Voeg de knop toe in de knoppen-sectie

Zoek naar waar "Ga naar Bewerking" knop staat (dit is vaak rechts in de header).

Dit ziet er ongeveer zo uit:
```tsx
<div className="flex items-center gap-3">
  {/* Weekend, Feestdag knoppen hier */}
  
  {/* Ga naar Bewerking knop */}
  <button onClick={...}>Ga naar Bewerking →</button>
</div>
```

**VOEG DEZE CODE TOE VLAK VOOR "Ga naar Bewerking":**
```tsx
{/* Diensten per dag knop */}
<PeriodStaffingButton rosterId={activeDesign?.id || ''} />
```

### Complete voorbeeld van hoe het eruit moet zien:

```tsx
<div className="flex items-center gap-3">
  {/* Weekend knop */}
  <button ...>Weekend</button>
  
  {/* Feestdag knop */}
  <button ...>Feestdag</button>
  
  {/* NIEUW: Diensten per dag knop */}
  <PeriodStaffingButton rosterId={activeDesign?.id || ''} />
  
  {/* Ga naar Bewerking knop */}
  <button onClick={...}>Ga naar Bewerking →</button>
</div>
```

---

## Alternatieve locatie (als bovenstaande niet werkt)

Als je de knoppen niet kunt vinden, voeg de knop toe in de header van het scherm:

```tsx
{/* Ergens in de header sectie */}
<div className="flex justify-between items-center">
  <div>
    <h1>Rooster Ontwerp : Periode Week ...</h1>
  </div>
  
  <div className="flex items-center gap-3">
    {/* VOEG HIER TOE */}
    <PeriodStaffingButton rosterId={activeDesign?.id || ''} />
    
    {/* Andere knoppen */}
  </div>
</div>
```

---

## Verificatie

1. **Opslaan**: Sla het bestand op
2. **Build lokaal**: `npm run build` (check voor TypeScript errors)
3. **Test**: Open het Rooster Ontwerp scherm
4. **Controleer**: De blauwe knop "📅 Diensten per dag" moet zichtbaar zijn
5. **Klik**: Klik op de knop → moet navigeren naar `/planning/design/period-staffing?id=...`

---

## Als het niet lukt

Stuur me een screenshot van:
1. Het Rooster Ontwerp scherm (huidige staat)
2. De code rond regel 250-350 van `page.client.tsx`

Dan kan ik de exacte locatie pinpointen.

---

## Component details

De `PeriodStaffingButton` component is al aangemaakt in:
`app/_components/PeriodStaffingButton.tsx`

Deze component:
- ✅ Heeft een blauwe styling (consistent met app design)
- ✅ Navigeert naar het juiste scherm
- ✅ Toont een kalender icoon + emoji
- ✅ Heeft hover effects
- ✅ Kan disabled worden (voor toekomstig gebruik)

---

**Na deze wijziging**: Push naar GitHub → Vercel deploy automatisch → Knop zichtbaar! 🎉
