#!/bin/bash

# FASE 3: Comprehensive Test Suite Runner
# Runs all tests with coverage, cache-busting, and Railway trigger

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════════════"
echo "FASE 3: COMPREHENSIVE TEST SUITE RUNNER"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Python Version: $(python3 --version)"
echo ""

# =========================================================================
# CACHE-BUSTING
# =========================================================================
echo "📝 Step 1: Cache-Busting..."

# Create new cache-bust file
CACHE_BUST_FILE=".test-cache-bust-$(date +%s%N).txt"
echo "Cache bust timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$CACHE_BUST_FILE"
echo "Random ID: $RANDOM-$RANDOM-$RANDOM" >> "$CACHE_BUST_FILE"
echo ""

# =========================================================================
# ENVIRONMENT SETUP
# =========================================================================
echo "🔧 Step 2: Environment Setup..."

# Check Python dependencies
if ! python3 -m pip show pytest > /dev/null; then
    echo "Installing test dependencies..."
    python3 -m pip install -q pytest pytest-cov pytest-mock pytest-timeout
fi

echo "✓ Environment ready"
echo ""

# =========================================================================
# UNIT TESTS
# =========================================================================
echo "🧪 Step 3: Unit Tests (solver_engine.py)"
echo "─────────────────────────────────────────"

python3 -m pytest test_solver_engine.py \
    -v \
    --tb=short \
    -m unit \
    --cov=solver_engine \
    --cov-report=term-missing:skip-covered

echo ""

# =========================================================================
# INTEGRATION TESTS
# =========================================================================
echo "🔗 Step 4: Integration Tests (DB + Solver)"
echo "─────────────────────────────────────────"

python3 -m pytest test_integration_db_solver.py \
    -v \
    --tb=short \
    -m integration \
    --cov=solver_engine \
    --cov-report=term-missing:skip-covered

echo ""

# =========================================================================
# END-TO-END TESTS
# =========================================================================
echo "🚀 Step 5: End-to-End Tests (Full Workflow)"
echo "─────────────────────────────────────────"

python3 -m pytest test_e2e_roster_workflow.py \
    -v \
    --tb=short \
    -m e2e \
    --cov=solver_engine \
    --cov-report=term-missing:skip-covered

echo ""

# =========================================================================
# COVERAGE REPORT
# =========================================================================
echo "📊 Step 6: Coverage Report"
echo "─────────────────────────────────────────"

python3 -m pytest \
    --cov=solver_engine \
    --cov-report=html \
    --cov-report=term \
    test_solver_engine.py \
    test_integration_db_solver.py \
    test_e2e_roster_workflow.py

echo ""

# =========================================================================
# RESULTS SUMMARY
# =========================================================================
echo "═══════════════════════════════════════════════════════════════"
echo "✅ TEST EXECUTION COMPLETE"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo "📈 Results Summary:"
echo "  - Unit tests: ✓"
echo "  - Integration tests: ✓"
echo "  - E2E tests: ✓"
echo "  - Coverage report: htmlcov/index.html"
echo ""

echo "🚀 Cache-bust file created: $CACHE_BUST_FILE"
echo ""

echo "⚡ Railway trigger (for auto-deploy):"
echo "  Random trigger ID: $RANDOM-$(date +%s)"
echo ""

echo "✨ All tests passed! Ready for deployment."
echo ""
