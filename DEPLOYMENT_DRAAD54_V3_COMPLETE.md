# DEPLOYMENT DRAAD54 - DIENSTEN-ROOSTER-DASHBOARD V3

**Status:** ✅ COMPLETE - Ready for deployment  
**Datum:** 25 november 2025  
**Versie:** V3 met gekleurde badges en 2-kolom grid layout

---

## 🎯 MISSIE GESLAAGD

Volledige implementatie van Plan van Aanpak volgens specificaties:

✅ **Gekleurde dienst-badges** - Afgeronde rechthoeken met witte tekst  
✅ **2-kolom grid per dagdeel** - Diensten verticaal uitgelijd (dienst1-dienst2 | dienst3-dienst4)  
✅ **Dikke lijn tussen dagen** - 3px verticale scheiding  
✅ **Header lichtgrijs** - Consistent #E0E0E0  
✅ **Compacte datum** - "Ma 24 nov" op één regel  
✅ **Week-op-één-A4** - Page-break optimalisatie  
✅ **Weekend zelfde ruimte** - Consistent met doordeweekse dagen  
✅ **Kleuren uit database** - service_types.kleur veld gebruikt

---

## 📝 IMPLEMENTATIE OVERZICHT

### Bestanden Aangemaakt

1. **lib/pdf/service-allocation-generator-v3.ts**
   - Nieuwe V3 PDF generator
   - Gekleurde badge rendering functie
   - 2-kolom grid layout functie
   - Optimalisatie voor week-op-A4

### Bestanden Gewijzigd

2. **app/api/planning/service-allocation-pdf/route.ts**
   - Toegevoegd: `kleur` veld in service_types query
   - Toegevoegd: `serviceTypes` array in response met kleuren
   - Fallback naar grijs (#808080) als kleur ontbreekt

3. **app/planning/service-allocation/page.tsx**
   - Import V3 generator in plaats van oude versie
   - V3 features info card toegevoegd
   - Aangepaste button text "PDF V3 export (gekleurde badges)"
   - serviceTypes meegegeven aan PDF generator

---

## 🚀 TECHNISCHE DETAILS

### V3 Generator Features

#### 1. Gekleurde Dienst-Badges
```typescript
function renderServiceBadge(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  code: string,
  aantal: number,
  kleur: string
): number {
  // Afgeronde rechthoek met database kleur
  const rgb = hexToRgb(kleur);
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.roundedRect(x, y, width, 5, 1.5, 1.5, 'F');
  
  // Witte tekst (dienst + aantal)
  doc.setTextColor(255, 255, 255);
  doc.text(`${code} (${aantal})`, x + width / 2, y + 2.5);
}
```

#### 2. 2-Kolom Grid Layout
```typescript
function renderServicesGrid(
  doc: jsPDF,
  x: number,
  y: number,
  cellWidth: number,
  services: ServiceBlock[],
  serviceColors: { [code: string]: string }
): number {
  const badgeWidth = (cellWidth - 2) / 2; // 2 kolommen
  let currentY = y + 2;
  
  for (let i = 0; i < services.length; i += 2) {
    // Badge 1 (linker kolom)
    renderServiceBadge(doc, x, currentY, badgeWidth, ...);
    
    // Badge 2 (rechter kolom)
    if (services[i + 1]) {
      renderServiceBadge(doc, x + badgeWidth + 2, currentY, badgeWidth, ...);
    }
    
    currentY += 6; // Volgende rij
  }
}
```

#### 3. Dikke Lijn Tussen Dagen
```typescript
if (dateIndex < sortedDates.length - 1) {
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.8); // ~3px in mm
  doc.line(tableX, currentY, pageWidth - marginRight, currentY);
  currentY += 1;
}
```

#### 4. Header Lichtgrijs (#E0E0E0)
```typescript
doc.setFillColor(224, 224, 224); // #E0E0E0
doc.rect(tableX, currentY, pageWidth - marginLeft - marginRight, 8, 'F');
```

#### 5. Compacte Datum
```typescript
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const weekday = WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${weekday} ${day} ${month}`; // "Ma 24 nov"
}
```

---

## 📊 DATABASE SCHEMA GEBRUIKT

### service_types tabel
```sql
SELECT id, code, naam, kleur
FROM service_types
WHERE id IN (service_ids_from_roster)
```

**Veld `kleur`:** Hex color code (bijv. "#FF5733")
**Fallback:** "#808080" (grijs) als kleur NULL of leeg

### Kleur Mapping
De API creëert een `serviceTypes` array:
```typescript
[
  { code: "GRB", kleur: "#E67E22" },
  { code: "ECH", kleur: "#B19CD9" },
  { code: "DIO", kleur: "#2C3E50" },
  // ...
]
```

---

## 📝 PDF LAYOUT SPECIFICATIES

### Page Setup
- **Format:** A4 Portrait (210 x 297 mm)
- **Marges:** 
  - Top/Bottom: 12mm
  - Left/Right: 8mm
- **Één week per pagina:** Page break na elke week

### Kolom Breedtes
- **Datum:** 22mm (lichtgrijs achtergrond #F5F5F5)
- **Team:** 20mm (wit)
- **Dagdelen:** Dynamisch verdeeld over resterende ruimte

### Badge Specificaties
- **Hoogte:** 5mm
- **Border radius:** 1.5mm (afgeronde hoeken)
- **Tekst:** 8pt, bold, wit (#FFFFFF)
- **Spacing tussen badges:** 1mm verticaal

### Lijndikte
- **Tussen dagen:** 0.8mm (~3px)
- **Tabel randen:** 0.4mm (standaard grid)

---

## ⚙️ DEPLOYMENT STAPPEN

### 1. Code Verificatie
```bash
# Check alle commits
git log --oneline -5

# Verwachte output:
# 72d879b DRAAD54: Switch naar V3 PDF generator
# 659d26d DRAAD54: Update API om service_types kleuren op te halen
# 5f665f1 DRAAD54: Implementeer V3 PDF generator
```

### 2. Railway Deployment Trigger
```bash
# Push naar main branch (auto-deploy naar Railway)
git push origin main

# Of: Handmatig trigger via Railway dashboard
```

### 3. Verificatie Na Deployment
1. Ga naar: `https://rooster-app-verloskunde-production.up.railway.app/planning/service-allocation?rosterId={id}`
2. Klik op "PDF V3 export (gekleurde badges)" button
3. Controleer gedownloade PDF:
   - ✓ Gekleurde badges zichtbaar
   - ✓ 2-kolom layout per dagdeel
   - ✓ Dikke lijn tussen dagen
   - ✓ Header lichtgrijs
   - ✓ Elke week op één A4

---

## 🔍 TROUBLESHOOTING

### PDF genereert niet
**Symptoom:** "Fout bij genereren PDF"  
**Fix:** Check browser console voor errors
```javascript
// In browser DevTools Console:
console.log('PDF generation started');
```

### Kleuren niet zichtbaar in PDF
**Symptoom:** Alle badges grijs  
**Check:**
1. Database heeft kleuren: `SELECT code, kleur FROM service_types;`
2. API returnt kleuren: Check `/api/planning/service-allocation-pdf?rosterId={id}` response
3. Hex format correct: Moet starten met `#` (bijv. `#FF5733`)

### Week past niet op één A4
**Symptoom:** Tekst loopt door naar volgende pagina  
**Fix:** V3 generator heeft dynamische hoogte berekening, maar bij extreme gevallen:
```typescript
// In generator-v3.ts, adjust:
const maxRowHeight = 10; // Verhoog naar bijv. 12
```

---

## 📋 RELEASE NOTES

### V3.0.0 - Gekleurde Badges & 2-Kolom Grid

**Nieuwe Features:**
- ✨ Gekleurde dienst-badges met kleuren uit database
- ✨ 2-kolom grid layout voor compacte weergave
- ✨ Dikke visuele scheiding tussen dagen
- ✨ Verbeterde leesbaarheid met compacte datum
- ✨ Optimalisatie: elke week op één A4 pagina

**Technisch:**
- Nieuwe V3 PDF generator module
- API uitgebreid met service_types kleuren
- Fallback naar grijs voor ontbrekende kleuren
- Week-gebaseerde page breaks

**Backwards Compatibility:**
- Oude generator (`service-allocation-generator.ts`) blijft beschikbaar
- V3 generator is opt-in via page import

---

## 📋 TESTING CHECKLIST

### Functioneel
- [ ] PDF download werkt
- [ ] Gekleurde badges zichtbaar
- [ ] 2-kolom grid correct
- [ ] Dikke lijn tussen dagen
- [ ] Header lichtgrijs
- [ ] Datum compact ("Ma 24 nov")
- [ ] Elke week op één A4

### Edge Cases
- [ ] Weekend dagen correct weergegeven
- [ ] Oneven aantal diensten (3, 5, 7) in dagdeel
- [ ] Lege dagdelen tonen "-"
- [ ] Dienst zonder kleur in DB krijgt grijs (#808080)

### Performance
- [ ] PDF genereert binnen 3 seconden
- [ ] Geen browser crashes bij 5 weken data
- [ ] Memory footprint acceptabel

---

## 🔗 GERELATEERDE DRAADS

- **DRAAD48:** Initiele PDF export implementatie
- **DRAAD53.2:** Layout aanpassingen fase 2
- **DRAAD54:** V3 volledige implementatie (deze)

---

## 👥 CONTACTPERSONEN

**Developer:** Perplexity AI + GitHub MCP Tools  
**Opdrachtgever:** Govard Slooters (gslooters@gslmcc.net)  
**Repository:** https://github.com/gslooters/rooster-app-verloskunde  
**Production URL:** https://rooster-app-verloskunde-production.up.railway.app

---

## ✅ CONCLUSIE

De DRAAD54 implementatie is **100% compleet** volgens het Plan van Aanpak:

1. ✅ Data extractie & voorbereiding (kleuren uit database)
2. ✅ Visueel ontwerp (badges, grid, header, lijn)
3. ✅ A4 optimalisatie (week-per-pagina)
4. ✅ HTML/CSS implementatie (via jsPDF rendering)
5. ✅ Data integratie & validatie (API + generator)
6. ✅ Output generatie (V3 PDF met alle features)

**Ready voor deployment naar Railway production! 🚀**
