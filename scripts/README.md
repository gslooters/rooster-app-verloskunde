# Scripts

## fix-planning-grid-type.sh

**Doel**: Lost type mismatch op in `app/planning/PlanningGrid.tsx`

**Probleem**: Roster type mist `'in_progress'` status waardoor build faalt

**Oplossing**: Voegt `|'in_progress'` toe aan regel 41

**Gebruik**:
```bash
chmod +x scripts/fix-planning-grid-type.sh
bash scripts/fix-planning-grid-type.sh
```

**Of direct uitvoeren met één commando**:
```bash
sed -i "s/status: 'draft'|'final';/status: 'draft'|'in_progress'|'final';/g" app/planning/PlanningGrid.tsx
git add app/planning/PlanningGrid.tsx
git commit -m "fix: voeg 'in_progress' toe aan Roster type status"
git push origin main
```
