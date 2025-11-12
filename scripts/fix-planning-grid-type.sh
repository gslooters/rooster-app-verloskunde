#!/bin/bash
# Hotfix script: Voeg 'in_progress' toe aan Roster type in PlanningGrid.tsx
# Uitvoeren: bash scripts/fix-planning-grid-type.sh

set -e

FILE="app/planning/PlanningGrid.tsx"

echo "🔧 Fixing Roster type in $FILE..."

# Backup maken
cp "$FILE" "$FILE.backup"
echo "✅ Backup created: $FILE.backup"

# Fix toepassen: voeg |'in_progress' toe
sed -i "s/status: 'draft'|'final';/status: 'draft'|'in_progress'|'final';/g" "$FILE"

# Verificatie
if grep -q "status: 'draft'|'in_progress'|'final'" "$FILE"; then
    echo "✅ Fix successfully applied!"
    echo ""
    echo "Changed line:"
    grep "type Roster = " "$FILE"
    echo ""
    echo "📦 Commit the change:"
    echo "  git add $FILE"
    echo "  git commit -m 'fix: voeg in_progress toe aan Roster type status (regel 41)'"
    echo "  git push origin main"
else
    echo "❌ Fix failed - restoring backup"
    mv "$FILE.backup" "$FILE"
    exit 1
fi
