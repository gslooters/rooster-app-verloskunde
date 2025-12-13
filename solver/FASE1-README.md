# 🚀 RosterSolverV2 - FASE 1 Implementation

**Status:** Production-Ready  
**Date:** 2025-12-13  
**Version:** 1.0.0  

## Overview

RosterSolverV2 is a production-ready constraint programming solver for healthcare roster scheduling. This FASE1 implementation includes critical fixes identified in DRAAD169 analysis.

## Key Features

### ✅ Kritieke Fixes Geïmplementeerd

1. **Constraint 7 (Exact Staffing) - Proper Error Handling**
   - Now detects infeasibility instead of silently skipping constraints
   - Clear error messages when no eligible employees available
   - Returns False to signal infeasible problems

2. **DIO+DIA Reification - Correct Bi-directional Logic**
   - Proper variable linking: koppel = (dio AND dia)
   - Both enforcement directions implemented
   - 24-hour bonus now actually works

3. **Solver Status Handling - Comprehensive**
   - OPTIMAL: Full solution found
   - FEASIBLE: Solution found (timeout)
   - INFEASIBLE: Impossible constraints
   - UNKNOWN: Timeout or error (with diagnostics)

4. **Debug Logging - Full Diagnostic Info**
   - Model summary before solving
   - Constraint-by-constraint logging
   - Solver progress tracking
   - Solution validation details

## File Structure

```
solver/
├── RosterSolverV2.py          # Main solver class (21KB)
├── test_RosterSolverV2.py     # Unit tests (14KB)
├── FASE1-README.md            # This file
└── run_tests.sh               # Test runner script
```

## Installation

### Requirements

```bash
pip install ortools>=9.8.0
```

### Basic Setup

```python
from solver.RosterSolverV2 import RosterSolverV2

# Create configuration
config = {
    'employees': load_employees(),
    'required_staffing': load_staffing_requirements(),
    'planning_horizon_days': 35,
    'max_solver_time': 60
}

# Create and configure solver
solver = RosterSolverV2(config)
```

## Usage

### Basic Solve

```python
# Build the constraint model
if not solver.build_model():
    print("Failed to build model - problem may be infeasible")
    exit(1)

# Solve
result = solver.solve()

# Check result
if result['status'] == 'OPTIMAL':
    print(f"Optimal solution found with objective value: {result['objective_value']}")
    assignments = result['assignments']
    bonuses = result['dio_dia_bonuses']
    # Process assignments...

elif result['status'] == 'FEASIBLE':
    print(f"Feasible solution found (timeout): {result['objective_value']}")
    # Use non-optimal solution
    
elif result['status'] == 'INFEASIBLE':
    print(f"Problem is infeasible: {result['error']}")
    # Cannot schedule with these constraints
    
elif result['status'] == 'UNKNOWN':
    print(f"Solver error: {result['error']}")
    print(f"Conflicts: {result['conflicts']}, Branches: {result['branches']}")
    # May need to relax constraints
```

## Configuration

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `employees` | List[Dict] | Employee objects with services, team, constraints |
| `required_staffing` | List[Dict] | Staffing requirements per day/service |
| `planning_horizon_days` | int | Number of days to schedule (default: 35) |
| `max_solver_time` | int | Maximum solver time in seconds (default: 60) |

### Employee Format

```python
{
    'id': 0,
    'name': 'Alice',
    'team_type': 'EBPH',  # Or 'Artsen', etc.
    'services': [0, 1, 2],  # Service IDs employee can work
    'max_hours_per_week': 40,  # Optional: weekly limit
    'min_hours_per_week': 20   # Optional: minimum
}
```

### Staffing Requirement Format

```python
{
    'service_id': 0,      # Required service
    'team_type': 'EBPH',  # Required team
    'aantal': 1,          # Number of positions
    'date': datetime(...) # Date needed
}
```

## Testing

### Run All Tests

```bash
python solver/test_RosterSolverV2.py
```

### Run Specific Test Class

```bash
python -m unittest solver.test_RosterSolverV2.TestConstraint7ErrorHandling -v
```

### Test Coverage

- Initialization (3 tests)
- Constraint 7 error handling (3 tests) ⚠️ CRITICAL
- DIO+DIA reification (2 tests) ⚠️ CRITICAL
- Solver status handling (3 tests) ⚠️ CRITICAL
- Model building (3 tests)
- Solution extraction (2 tests)
- Integration tests (1 test)

**Total: 20 test methods covering all critical fixes**

## Logging

### Log Output Format

```
[2025-12-13 12:33:00] [INFO] [FASE1] RosterSolverV2 initialized
[2025-12-13 12:33:01] [INFO] [FASE1] Building CP model...
[2025-12-13 12:33:02] [DEBUG] [FASE1] Loading employee services...
[2025-12-13 12:33:03] [INFO] [FASE1] Model built successfully
[2025-12-13 12:33:05] [INFO] [FASE1] Solver finished: OPTIMAL (time: 2.14s)
```

### Enable Debug Logging

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Performance

### Expected Solve Times

| Problem Size | Employees | Days | Constraints | Time |
|--------------|-----------|------|-------------|------|
| Small | 20 | 7 | 100 | <0.5s |
| Medium | 50 | 35 | 500 | 1-5s |
| Large | 100 | 35 | 1000 | 10-60s |
| XLarge | 200 | 35 | 2000 | 30-120s |

*Times are estimates; actual times depend on constraint complexity*

## Error Handling

### Common Issues and Solutions

#### 1. INFEASIBLE Status

**Cause:** Constraints are contradictory  
**Solution:** Check staffing requirements vs. available employees

```python
if result['status'] == 'INFEASIBLE':
    # Review:
    # - Required services vs. employee skills
    # - Team requirements vs. team size
    # - Staffing requirements vs. available capacity
```

#### 2. UNKNOWN Status

**Cause:** Timeout or memory issue  
**Solution:** Increase max_solver_time or simplify problem

```python
config['max_solver_time'] = 120  # Increase timeout
# Or relax constraints:
config['required_staffing'] = simplified_requirements
```

#### 3. Low Objective Value

**Cause:** Few DIO+DIA bonuses found  
**Solution:** Check if enough sequential DIO+DIA services in requirements

```python
if result['dio_dia_bonuses'] < expected:
    # Verify service scheduling includes DIO+DIA pairs
    # Check service definitions (service 0=DIO, service 1=DIA)
```

## Advanced Usage

### Custom Constraints

```python
class MyRosterSolver(RosterSolverV2):
    def _add_custom_constraint(self):
        """Add custom constraint after standard ones."""
        # Example: No more than 3 consecutive days
        for emp_id in range(len(self.employees)):
            for day in range(self.planning_horizon_days - 2):
                consecutive = sum([
                    self.assignment_vars.get((emp_id, day+d, s), 0)
                    for d in range(3)
                    for s in range(10)
                ])
                self.model.Add(consecutive <= 2)
```

### Warm Starting

```python
# Use previous solution as hint
previous_solution = load_previous_rooster()

for (emp_id, day, service), var in solver.assignment_vars.items():
    if should_assign(emp_id, day, service, previous_solution):
        solver.model.AddHint(var, 1)
```

## Deployment

### Railway Configuration

The solver is deployed as part of the `Solver2` service on Railway.

**Build configuration:**
```dockerfile
FROM python:3.12-slim
RUN pip install ortools>=9.8.0
COPY solver/ /app/solver/
WORKDIR /app
CMD ["python", "-m", "solver.solver_api"]
```

**Environment variables:**
```
SOLVER_MAX_TIME=60
SOLVER_LOG_LEVEL=INFO
```

### Cache Busting

To trigger Railway rebuild after updates:

```bash
# Create cache bust file with timestamp
echo "2025-12-13T$(date +%H:%M:%S)Z" > .cache-bust-fase1-$(date +%s)
git add .cache-bust-fase1-*
git commit -m "FASE1: Cache bust - force Railway rebuild"
git push
```

## Monitoring

### Key Metrics to Watch

- **Solve Time:** Should be <60s for typical problems
- **Objective Value:** Indicate solution quality
- **DIO+DIA Bonuses:** Number of 24-hour pairings found
- **INFEASIBLE Errors:** May indicate scheduling conflicts
- **UNKNOWN Errors:** May indicate timeout or memory issues

### Production Checks

```python
def validate_deployment():
    # Quick test
    config = get_test_config()
    solver = RosterSolverV2(config)
    
    if not solver.build_model():
        raise Exception("Model building failed")
    
    result = solver.solve()
    
    if result['status'] not in ['OPTIMAL', 'FEASIBLE']:
        raise Exception(f"Solver failed: {result['status']}")
    
    if len(result['assignments']) == 0:
        raise Exception("No assignments generated")
    
    print("✅ Deployment validation passed")
```

## Troubleshooting

### Enable Full Diagnostics

```python
import logging

# Full debug logging
logging.basicConfig(
    level=logging.DEBUG,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('solver_debug.log')
    ]
)

# Verbose solver output
solver = RosterSolverV2(config)
result = solver.solve()

if result['status'] == 'UNKNOWN':
    print(f"Debug info:")
    print(f"  Conflicts: {result['conflicts']}")
    print(f"  Branches: {result['branches']}")
    print(f"  Time: {result['solve_time']}s")
```

## References

- [OR-Tools Documentation](https://developers.google.com/optimization/cp)
- [CP-SAT Primer](https://github.com/d-krupke/cpsat-primer)
- [DRAAD169 Analysis](../.DRAAD169-CRITICAL-ANALYSIS.md)
- [DRAAD170 Deployment](./DRAAD170-FASE123-DEPLOYMENT-SUMMARY.md)

## Support

For issues or questions:

1. Check logs for [FASE1] messages
2. Review this README
3. Run diagnostic tests
4. Check GitHub issues
5. Contact: gslooters@gslmcc.net

## Version History

### v1.0.0 (2025-12-13) - FASE1
- Initial production release
- Critical fixes from DRAAD169
- Comprehensive unit tests
- Full documentation

---

**Status:** ✅ PRODUCTION READY  
**Last Updated:** 2025-12-13  
**Maintainer:** Govard Slooters
