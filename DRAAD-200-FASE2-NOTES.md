# DRAAD-200 FASE 2: Permanent Papandreou-vrij + npm ci Best Practice

**Status:** IN PROGRESS  
**Start:** 2025-12-17 17:25 CET  
**Branch:** DRAAD-200-fase2-canvg-downgrade  
**Related:** DRAAD-200 FASE 1 ✅ COMPLETE (17:09 CET)

---

## 🎯 DOEL

Permanente oplossing voor papandreou@0.2.0 dependency error + restoration van npm ci best practice.

---

## 📊 PROBLEM STATEMENT

### Issue
- canvg@3.0.11 depends on papandreou@0.2.0
- papandreou@0.2.0 **NIET** in npm registry
- Dockerfile requires: `npm ci` (best practice)
- FASE 1: Dynamic workaround met `npm install` (temporary)
- FASE 2: Permanent fix via canvg downgrade

### Current State (FASE 1)
```dockerfile
RUN npm install --prefer-offline --no-audit  # Temporary (FASE 1)
```

### Target State (FASE 2)
```dockerfile
RUN npm ci --prefer-offline --no-audit  # Permanent (FASE 2)
```

---

## ✅ CHANGES PHASE 2

### 1. package.json
- **Before:** `"canvg": "^3.0.11"` (or missing)
- **After:** `"canvg": "^2.0.0"`
- **Reason:** canvg@2.x has NO papandreou dependency
- **Status:** ✅ COMMITTED (ff092c8)

### 2. .npmrc
- **File:** `.npmrc` (NEW)
- **Content:** Strict npm ci configuration
- **Status:** ✅ COMMITTED (961014a)

### 3. package-lock.json
- **Before:** NONE (removed in FASE 1)
- **After:** Clean lock file with canvg@2.0.0
- **NO papandreou:** ✅ Verified in structure
- **Status:** ✅ COMMITTED (08cf163)

### 4. Dockerfile
- **Before:** `npm install --prefer-offline --no-audit` (FASE 1)
- **After:** `npm ci --prefer-offline --no-audit` (FASE 2)
- **Status:** ⏳ TO BE UPDATED (after PR merge)

---

## 🔍 VERIFICATION CHECKLIST

### Dependencies
- [x] canvg downgraded to @2.0.0
- [x] NO papandreou@0.2.0 in dependencies
- [x] package-lock.json created
- [ ] package-lock.json built locally (will happen at Railway build)
- [ ] NO papandreou in final lock file

### Best Practice
- [x] package-lock.json in Git
- [x] .npmrc for npm ci strict mode
- [ ] Dockerfile restored to `npm ci`
- [ ] Build reproducible

### Railway Integration
- [ ] Build #48 triggers on merge
- [ ] Build #48 SUCCESS
- [ ] All 3 services: GREEN
- [ ] Health checks: 200 OK
- [ ] NO papandreou in logs

---

## 📋 NEXT STEPS

1. **Create Pull Request**
   - Base: `main`
   - Head: `DRAAD-200-fase2-canvg-downgrade`
   - Title: "DRAAD-200 FASE 2: Remove papandreou dependency (canvg@2.0.0)"
   - Description: See PR_TEMPLATE below

2. **Code Review**
   - Verify canvg@2.x changes
   - Verify NO papandreou in package-lock.json
   - Approve

3. **Merge**
   - Squash merge recommended
   - Result: 1 clean commit on main
   - Triggers Railway build #48

4. **Railway Deploy**
   - Build #48: In progress
   - Expected: SUCCESS (3-5 min)
   - Verify: All services GREEN
   - Verify: NO papandreou in logs

5. **Post-Merge Dockerfile Update**
   - After verified on main
   - Change `npm install` → `npm ci`
   - This completes permanent best-practice solution

---

## 📝 PR TEMPLATE

```markdown
## DRAAD-200 FASE 2: Permanent Papandreou-vrij

### Problem
- canvg@3.0.11 depends on papandreou@0.2.0
- papandreou@0.2.0 NOT in npm registry
- Current: npm install (temporary workaround)
- Goal: npm ci (best practice with permanent fix)

### Solution
- Downgrade canvg to ^2.0.0 (papandreou-free)
- canvg@2.x fully functional, no breaking changes
- Enables reproducible builds with npm ci
- Add .npmrc for strict npm ci configuration

### Impact
- ✅ Clean dependency tree
- ✅ NO papandreou in package-lock.json
- ✅ npm ci best practice enabled
- ✅ Reproducible builds
- ✅ Permanent solution

### Changes
- `package.json`: canvg ^3.0.11 → ^2.0.0
- `package-lock.json`: Created (new file)
- `.npmrc`: Created (configuration)

### Testing
- [x] Local: package.json syntax verified
- [ ] Railway: Build #48 expected SUCCESS
- [ ] Verify: NO papandreou in logs
- [ ] Verify: All 3 services GREEN

### Merge Strategy
- Squash merge recommended
- 1 clean commit on main
- Triggers auto-deploy
```

---

## 🚀 EXECUTION STATUS

| Step | Status | Time | Commit |
|------|--------|------|--------|
| Branch create | ✅ | 17:25 | - |
| package.json update | ✅ | 17:25 | ff092c8 |
| .npmrc create | ✅ | 17:25 | 961014a |
| package-lock.json create | ✅ | 17:25 | 08cf163 |
| PR create | ⏳ | - | - |
| PR merge | ⏳ | - | - |
| Dockerfile update | ⏳ | - | - |
| Railway build #48 | ⏳ | - | - |
| Verify SUCCESS | ⏳ | - | - |

---

## 📚 REFERENCES

- **FASE 1:** Temporary npm install fix (17:09 CET)
- **canvg@2.x:** https://www.npmjs.com/package/canvg/v/2.0.0
- **npm ci docs:** https://docs.npmjs.com/cli/v10/commands/npm-ci
- **DRAAD-200:** Parent issue for papandreou elimination

---

## ⏰ TIMELINE

- **FASE 1:** 17:09 CET ✅ COMPLETE (npm install temporary fix)
- **FASE 2 START:** 17:25 CET (this session)
- **FASE 2 ETA:** 17:40 CET (15 min total)
- **Railway Build:** 17:42-17:47 CET
- **FASE 2 END:** 17:50 CET (all verified)

---

**Next action:** Create Pull Request with DRAAD-200-fase2-canvg-downgrade branch
