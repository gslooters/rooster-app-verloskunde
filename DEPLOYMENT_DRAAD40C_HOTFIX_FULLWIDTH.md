# DRAAD40C HOTFIX: Sticky Table Header - Fullwidth Fix

**Datum**: 21 november 2025, 18:22 CET  
**Prioriteit**: CRITICAL  
**Status**: ✅ DEPLOYED

---

## Probleem Beschrijving

Na eerste implementatie van DRAAD40C:
- ❌ Tabel te smal door `container mx-auto` wrapper
- ❌ Slechts 1 dienst zichtbaar
- ❌ Geen horizontale scroll mogelijk
- ❌ Gebruiker gefrustreerd - niets werkte

## Root Cause

**FOUT**: Container wrapper `<div className="container mx-auto px-6 py-0">` **beperkte** de table breedte tot maximale container width (~1280px).

Dit blokkeerde:
- Volledige tabel weergave
- Horizontale scroll functionaliteit  
- Zichtbaarheid van alle diensten

## HOTFIX Oplossing

### Wijziging: WeekDagdelenTable.tsx

**VERWIJDERD** (blokkeerde breedte):
```tsx
<div className="container mx-auto px-6 py-0">
  <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
    <div className="relative">
      <div className="overflow-x-auto overflow-y-auto">...</div>
    </div>
  </div>
</div>
```

**NIEUWE STRUCTUUR** (fullwidth):
```tsx
<div className="relative">
  <div 
    className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto"
    style={{ isolation: 'isolate' }}
  >
    <table className="w-full border-collapse">...</table>
  </div>
</div>
```

### Behouden Features

✅ **Sticky header** (`position: sticky, top: 64px, z-index: 40`)  
✅ **Frozen columns** (Dienst + Team: `position: sticky, left: 0/140px, z-index: 45`)  
✅ **BoxShadow** op frozen columns voor visuele scheiding  
✅ **Z-index hierarchy** correct (45 > 40 > 10 > 0)  
✅ **Overflow scrolling** (horizontaal + verticaal)  
✅ **Isolation stacking context** voor z-index

## Commits

1. `4d094be` - Initial container structure (FOUT)
2. `caa3662` - Sticky header z-index fix
3. `ae883a3` - BoxShadow frozen columns tbody
4. `ca90b5f` - Railway trigger
5. `cf0cdc1` - Cache-bust update
6. **`9fd9e04`** - 🔥 **HOTFIX: Remove container wrapper**
7. **`efaf02c`** - 🔥 **HOTFIX: Railway trigger update**
8. **`053d7aa`** - 🔥 **HOTFIX: Final cache-bust**

## Deployment

**Methode**: Railway auto-deploy via GitHub webhook  
**Branch**: main  
**Cache-bust**: ✅ Ja (timestamp: 1732211000000)  
**Railway trigger**: ✅ Ja (.railway-trigger updated)

## Verificatie Checklist

- [ ] Hard refresh in browser (Cmd/Ctrl + Shift + R)
- [ ] Tabel toont volledige breedte (>1280px mogelijk)
- [ ] Alle diensten zichtbaar
- [ ] Horizontale scroll werkt
- [ ] Header blijft sticky bij verticaal scrollen
- [ ] Dienst + Team kolommen blijven frozen bij horizontaal scrollen
- [ ] Geen visuele overlap (z-index correct)
- [ ] BoxShadow zichtbaar op frozen columns

## Lessons Learned

🚨 **NOOIT `container mx-auto` gebruiken voor fullwidth tables!**

De parent component (page.tsx) bepaalt de breedte context.
Table component moet **altijd** fullwidth zijn (`w-full`) zonder container wrapper.

## Technische Details

**Minimale wrapper structuur**:
```tsx
<div className="relative">              {/* Z-index context */}
  <div 
    className="overflow-x-auto"         {/* Horizontal scroll */}
    style={{ isolation: 'isolate' }}    {/* Stacking context */}
  >
    <table className="w-full">...</table>
  </div>
</div>
```

**Sticky positioning stack**:
- Thead: `sticky top-[64px] z-40`
- Frozen th: `sticky left-0 z-45` (hoogste)
- Frozen td: `sticky left-0 z-10`

---

**Deploy tijd**: ~2-3 minuten  
**Impact**: HIGH (blocks primary functionality)  
**Rollback**: Niet nodig - hotfix corrigeert eerdere fout
