# 🚨 URGENT HOTFIX INSTRUCTIES

## Probleem
Build faalt met type error in `app/planning/PlanningGrid.tsx` regel 82:
```
Type 'Roster' from storage.ts has status: 'draft' | 'in_progress' | 'final'
But local type in PlanningGrid.tsx has: 'draft' | 'final' (missing 'in_progress')
```

## ✅ Oplossing 1: Snelle Fix (Minimal Change)

Wijzig **ALLEEN regel 41** in `app/planning/PlanningGrid.tsx`:

**VOOR:**
```typescript
type Roster = { id: string; start_date: string; end_date: string; status: 'draft'|'final'; created_at: string; };
```

**NA:**
```typescript
type Roster = { id: string; start_date: string; end_date: string; status: 'draft'|'in_progress'|'final'; created_at: string; };
```

### Stappen:
1. Open `app/planning/PlanningGrid.tsx`
2. Ga naar regel 41  
3. Voeg `|'in_progress'` toe aan de status union type
4. Save & commit
5. Push naar main

##  ✅ Oplossing 2: Betere Fix (Prevents Future Mismatches)

Import het Roster type van `storage.ts` in plaats van duplicate definition:

**Wijzig regels 1-5:**
```typescript
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getRosters, isDutchHoliday, isAvailable } from './libAliases';
import type { Roster } from '@/lib/planning/storage';  // ✅ NIEUWE IMPORT
```

**Verwijder regel 41:**
```typescript
// ❌ DELETE deze regel:
// type Roster = { id: string; start_date: string; end_date: string; status: 'draft'|'final'; created_at: string; };
```

### Stappen:
1. Open `app/planning/PlanningGrid.tsx`
2. Voeg import toe op regel 5: `import type { Roster } from '@/lib/planning/storage';`
3. Verwijder de lokale `type Roster = {...}` definitie op regel 41
4. Save & commit  
5. Push naar main

## ⚡ Snelste Oplossing via GitHub Web UI

1. Ga naar: https://github.com/gslooters/rooster-app-verloskunde/edit/main/app/planning/PlanningGrid.tsx
2. Zoek regel 41 (Ctrl+G in editor)
3. Verander `status: 'draft'|'final';` naar `status: 'draft'|'in_progress'|'final';`
4. Commit direct naar main
5. Railway bouwt automatisch opnieuw

## 📋 Verificatie

Na de fix zou de build moeten slagen. Check Railway logs voor:
```
✓ Compiled successfully
```

## 🔍 Root Cause

De `Roster` type in `lib/planning/storage.ts` heeft `'in_progress'` als mogelijke status, maar de duplicate definitie in `PlanningGrid.tsx` had dit niet. Na de Supabase migratie (Fase 1 & 2) werden deze types out-of-sync.

## 🛠️ Voor de Toekomst

Gebruik altijd shared type definitions via imports in plaats van duplicates om type mismatches te voorkomen.
