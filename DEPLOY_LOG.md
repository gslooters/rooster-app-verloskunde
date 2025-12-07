# Deploy Log

## DRAAD123FIX - 2025-12-07 15:40

**Status**: ✅ Deployed

**Wijziging**: 
- CORRECTIE: Bekijk Rooster link naar `/planning/design/preplanning?id=${rosterId}`
- Vorige versie had FOUT link naar `/planning/design?rosterId=${rosterId}`

**Commits**:
1. `7946c1f2` - DRAAD123FIX: Correctie link - Bekijk Rooster naar /planning/design/preplanning?id=
2. `d508afb5` - Cache bust: DRAAD123FIX - Link correctie

**Deploy trigger**: 1733594396000

**Tested**: ✅ Ready

---

## DRAAD123 - 2025-12-07 15:32

**Status**: 📄 Superseded by DRAAD123FIX

**Wijziging**: 
- Sluiten knop verwijderd uit ORT resultaatscherm
- Alleen "Bekijk Rooster" knop blijft zichtbaar
- ~~Link naar `/planning/design?rosterId=${rosterId}`~~ (FOUT)

**Commits**:
1. `048d2399` - DRAAD123: Sluiten knop verwijderd uit ORT resultaatscherm
2. `fb9ac44d` - Cache bust: DRAAD123 update
3. `d43522c2` - DRAAD123: Deploy log update

**Superseded by**: DRAAD123FIX (Link correctie)
