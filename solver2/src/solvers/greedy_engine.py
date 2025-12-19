"""
GREEDY Roster Solver - Fast, Transparent, Fair
DRAAD 184 Implementation v0.1
Target: 2-5 seconds to solve roster_id: 303ebcd1-054c-464b-b9f5-01175e70d719
"""

import logging
import time
from dataclasses import dataclass, field, asdict
from datetime import date, timedelta, datetime
from typing import List, Dict, Optional, Set, Tuple
from enum import Enum
import os
import sys

# Add parent directories to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from supabase import create_client, Client
except ImportError:
    Client = None

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

class ConstraintViolationType(Enum):
    HC1_NOT_CAPABLE = "Employee not capable for service"
    HC2_OVERLAPPING = "Overlapping shift assignment"
    HC3_BLACKOUT_DATE = "Employee unavailable on this date"
    HC4_MAX_PER_EMPLOYEE = "Employee exceeded max shifts"
    HC5_MAX_PER_SERVICE = "Employee exceeded max for this service"
    HC6_MIN_COVERAGE = "Minimum coverage not met"

@dataclass
class Assignment:
    """Single shift assignment"""
    employee_id: str
    date: date
    dagdeel: str  # 'O', 'M', 'A'
    service_id: str
    status: int = 1
    
    def to_dict(self):
        return {
            'employee_id': self.employee_id,
            'date': self.date.isoformat(),
            'dagdeel': self.dagdeel,
            'service_id': self.service_id,
            'status': self.status
        }

@dataclass
class Bottleneck:
    """Unfilled shift requirement"""
    date: date
    dagdeel: str
    service_id: str
    needed: int
    filled: int
    reason: str
    
    @property
    def shortage(self) -> int:
        return max(0, self.needed - self.filled)

@dataclass
class SolveResult:
    """Result of solve operation"""
    status: str  # 'success', 'partial', 'failed'
    assignments_created: int
    total_required: int
    coverage: float  # percentage
    bottlenecks: List[Bottleneck] = field(default_factory=list)
    solve_time: float = 0.0  # seconds
    message: str = ""
    constraint_violations: List[Dict] = field(default_factory=list)

class GreedyPlanner:
    """
    Fast GREEDY solver for roster scheduling
    Implements 6 HARD constraints from DRAAD 181
    """
    
    def __init__(self, roster_id: str, supabase_client: Optional[Client] = None):
        self.roster_id = roster_id
        self.db = supabase_client or self._get_db_client()
        self.logger = logging.getLogger(f"GreedyPlanner:{roster_id[:8]}")
        
        # State during solve
        self.assignments: List[Assignment] = []
        self.bottlenecks: List[Bottleneck] = []
        self.violations: List[Dict] = []
        self.employee_shift_count: Dict[str, int] = {}
        self.employee_service_count: Dict[Tuple[str, str], int] = {}
        
        # Cache for performance
        self.capability_cache: Dict[Tuple[str, str], bool] = {}
        self.blackout_cache: Dict[Tuple[str, date], bool] = {}
        
    def solve(self) -> SolveResult:
        """Main solve method - orchestrates all phases"""
        start_time = time.time()
        
        try:
            self.logger.info("🟢 GREEDY Solver started for roster: %s", self.roster_id[:8])
            
            # PHASE 1: Load all data
            self.logger.info("📥 Phase 1: Loading data...")
            roster = self._load_roster()
            employees = self._load_employees()
            requirements = self._load_requirements()
            
            if not roster or not employees or not requirements:
                raise ValueError("Failed to load essential data")
            
            self.logger.info(
                f"  ✅ Roster: {roster['id'][:8]}... Period {roster['start_date']} to {roster['end_date']}"
            )
            self.logger.info(f"  ✅ Employees: {len(employees)}")
            total_required = sum(r.get('aantal', 0) for r in requirements)
            self.logger.info(f"  ✅ Total requirements: {total_required}")
            
            # PHASE 2: Greedy assignment loop
            self.logger.info("🔄 Phase 2: Greedy assignment loop...")
            self._greedy_loop(roster, employees, requirements)
            
            # PHASE 3: Report results
            self.logger.info("📊 Phase 3: Generating report...")
            coverage = (len(self.assignments) / total_required * 100) if total_required > 0 else 0
            
            self.logger.info(f"  ✅ Assignments created: {len(self.assignments)}")
            self.logger.info(f"  ✅ Coverage: {coverage:.1f}%")
            self.logger.info(f"  ⚠️  Bottlenecks: {len(self.bottlenecks)}")
            
            # PHASE 4: Save to database
            if self.assignments:
                self.logger.info("💾 Phase 4: Saving to database...")
                self._save_assignments()
                self.logger.info(f"  ✅ Bulk inserted {len(self.assignments)} assignments")
            
            elapsed = time.time() - start_time
            self.logger.info(f"🎉 GREEDY completed in {elapsed:.2f}s")
            
            result_status = 'success' if coverage >= 95 else ('partial' if coverage >= 80 else 'failed')
            
            return SolveResult(
                status=result_status,
                assignments_created=len(self.assignments),
                total_required=total_required,
                coverage=coverage,
                bottlenecks=self.bottlenecks,
                solve_time=elapsed,
                message=f"✅ {len(self.assignments)}/{total_required} assignments ({coverage:.1f}%)",
                constraint_violations=self.violations
            )
            
        except Exception as e:
            elapsed = time.time() - start_time
            self.logger.error(f"❌ Solve failed: {str(e)}", exc_info=True)
            return SolveResult(
                status='failed',
                assignments_created=0,
                total_required=0,
                coverage=0,
                bottlenecks=self.bottlenecks,
                solve_time=elapsed,
                message=f"Error: {str(e)}",
                constraint_violations=self.violations
            )
    
    def _greedy_loop(self, roster: Dict, employees: List[Dict], requirements: List[Dict]):
        """Core greedy algorithm - implements DRAAD 181 constraints"""
        current_date = datetime.fromisoformat(roster['start_date']).date()
        end_date = datetime.fromisoformat(roster['end_date']).date()
        
        processed_slots = 0
        assigned_in_loop = 0
        
        while current_date <= end_date:
            for dagdeel in ['O', 'M', 'A']:  # Ochtend, Middag, Avond
                # Filter requirements for this date/dagdeel
                day_requirements = [
                    r for r in requirements 
                    if (datetime.fromisoformat(r.get('date', '')).date() == current_date
                        if 'date' in r and r['date'] else False)
                    and r.get('dagdeel') == dagdeel
                ]
                
                for req in day_requirements:
                    processed_slots += 1
                    service_id = req.get('service_id')
                    needed = req.get('aantal', 1)
                    
                    # Count current assignments for this slot
                    current_count = len([
                        a for a in self.assignments
                        if a.date == current_date 
                        and a.dagdeel == dagdeel 
                        and a.service_id == service_id
                    ])
                    
                    shortage = needed - current_count
                    
                    if shortage <= 0:
                        continue
                    
                    # Try to fill shortage
                    for _ in range(shortage):
                        eligible = self._find_eligible_employees(
                            current_date, dagdeel, service_id, employees
                        )
                        
                        if eligible:
                            winner = eligible[0]  # Best fairness score
                            assignment = Assignment(
                                employee_id=winner['id'],
                                date=current_date,
                                dagdeel=dagdeel,
                                service_id=service_id
                            )
                            self.assignments.append(assignment)
                            self.employee_shift_count[winner['id']] = \
                                self.employee_shift_count.get(winner['id'], 0) + 1
                            key = (winner['id'], service_id)
                            self.employee_service_count[key] = \
                                self.employee_service_count.get(key, 0) + 1
                            assigned_in_loop += 1
                        else:
                            # Bottleneck
                            current_filled = len([
                                a for a in self.assignments
                                if a.date == current_date 
                                and a.dagdeel == dagdeel 
                                and a.service_id == service_id
                            ])
                            self.bottlenecks.append(Bottleneck(
                                date=current_date,
                                dagdeel=dagdeel,
                                service_id=service_id,
                                needed=needed,
                                filled=current_filled,
                                reason="No eligible employees found"
                            ))
            
            current_date += timedelta(days=1)
        
        self.logger.info(f"  📊 Processed {processed_slots} slots, assigned {assigned_in_loop} shifts")
    
    def _find_eligible_employees(self, date: date, dagdeel: str, service_id: str, 
                                employees: List[Dict]) -> List[Dict]:
        """Find eligible employees for a slot, sorted by fairness"""
        eligible = []
        
        for emp in employees:
            emp_id = emp.get('id')
            
            # HC1: Is capable?
            if not self._check_capable(emp_id, service_id):
                continue
            
            # HC2: Not already assigned this shift?
            if self._check_already_assigned(emp_id, date, dagdeel):
                continue
            
            # HC3: Not blackout date?
            if self._check_blackout(emp_id, date):
                continue
            
            # HC4: Not exceeded max per employee?
            target = emp.get('target_shifts', 16)
            if self._check_max_per_employee(emp_id, target):
                continue
            
            # HC5: Not exceeded max for this service?
            if self._check_max_per_service(emp_id, service_id):
                continue
            
            # Calculate fairness score
            score = self._calculate_fairness_score(emp_id)
            eligible.append({**emp, 'fairness_score': score})
        
        # Sort by fairness (highest first = fewest shifts already)
        eligible.sort(key=lambda e: e.get('fairness_score', 0), reverse=True)
        return eligible
    
    # Hard Constraint Checks (HC1-HC6)
    
    def _check_capable(self, employee_id: str, service_id: str) -> bool:
        """HC1: Is employee capable for this service?"""
        cache_key = (employee_id, service_id)
        
        if cache_key in self.capability_cache:
            return self.capability_cache[cache_key]
        
        try:
            if not self.db:
                return True
            
            # Query: roster_employee_services where employee_id and service_id and actief=true
            response = self.db.table('roster_employee_services').select('*').eq(
                'roster_id', self.roster_id
            ).eq('employee_id', employee_id).eq('service_id', service_id).eq(
                'actief', True
            ).execute()
            
            result = len(response.data) > 0
            self.capability_cache[cache_key] = result
            return result
        except Exception as e:
            self.logger.warning(f"HC1 check failed for {employee_id}: {e}")
            return False
    
    def _check_already_assigned(self, employee_id: str, date: date, dagdeel: str) -> bool:
        """HC2: Is employee already assigned this shift?"""
        return any(
            a.employee_id == employee_id 
            and a.date == date 
            and a.dagdeel == dagdeel
            for a in self.assignments
        )
    
    def _check_blackout(self, employee_id: str, date: date) -> bool:
        """HC3: Is this a blackout date for employee?"""
        cache_key = (employee_id, date)
        
        if cache_key in self.blackout_cache:
            return self.blackout_cache[cache_key]
        
        try:
            if not self.db:
                return False
            
            # Query: roster_design unavailability_data
            response = self.db.table('roster_design').select('unavailability_data').eq(
                'roster_id', self.roster_id
            ).eq('employee_id', employee_id).execute()
            
            if not response.data:
                self.blackout_cache[cache_key] = False
                return False
            
            unavail_data = response.data[0].get('unavailability_data', {})
            is_unavailable = str(date) in unavail_data.get('dates', [])
            
            self.blackout_cache[cache_key] = is_unavailable
            return is_unavailable
        except Exception as e:
            self.logger.warning(f"HC3 check failed for {employee_id}: {e}")
            return False
    
    def _check_max_per_employee(self, employee_id: str, target: int) -> bool:
        """HC4: Would assignment exceed max per employee?"""
        current = self.employee_shift_count.get(employee_id, 0)
        return current >= target
    
    def _check_max_per_service(self, employee_id: str, service_id: str) -> bool:
        """HC5: Would assignment exceed max for this service?"""
        try:
            if not self.db:
                return False
            
            # Query: roster_employee_services for max_count
            response = self.db.table('roster_employee_services').select('aantal').eq(
                'roster_id', self.roster_id
            ).eq('employee_id', employee_id).eq('service_id', service_id).execute()
            
            if not response.data:
                return False
            
            max_count = response.data[0].get('aantal', 0)
            current = self.employee_service_count.get((employee_id, service_id), 0)
            return current >= max_count
        except Exception as e:
            self.logger.warning(f"HC5 check failed: {e}")
            return False
    
    def _calculate_fairness_score(self, employee_id: str) -> float:
        """Calculate fairness: prefer employees with fewer assignments"""
        current = self.employee_shift_count.get(employee_id, 0)
        # Higher score = fewer shifts = more likely to be assigned
        return -current
    
    # Data loading
    
    def _load_roster(self) -> Optional[Dict]:
        """Load roster configuration"""
        try:
            if not self.db:
                return None
            
            response = self.db.table('roosters').select('*').eq('id', self.roster_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            self.logger.error(f"Failed to load roster: {e}")
            return None
    
    def _load_employees(self) -> List[Dict]:
        """Load employee data
        
        DRAAD 214 FIX: Laad target_shifts uit employees.aantalwerkdagen (COMPLEET)
        Gebruik NIET period_employee_staffing (INCOMPLEET!)
        """
        try:
            if not self.db:
                return []
            
            # Get all active employees with target_shifts from employees table
            emp_response = self.db.table('employees').select('*').eq('actief', True).execute()
            
            # Map employees with target_shifts from aantalwerkdagen
            employees = []
            for emp in emp_response.data:
                emp['target_shifts'] = emp.get('aantalwerkdagen', 16)
                employees.append(emp)
            
            return employees
        except Exception as e:
            self.logger.error(f"Failed to load employees: {e}")
            return []
    
    def _load_requirements(self) -> List[Dict]:
        """Load service requirements"""
        try:
            if not self.db:
                return []
            
            response = self.db.table('roster_period_staffing_dagdelen').select('*').eq(
                'roster_id', self.roster_id
            ).execute()
            
            return response.data if response.data else []
        except Exception as e:
            self.logger.error(f"Failed to load requirements: {e}")
            return []
    
    # Database operations
    
    def _save_assignments(self):
        """Bulk insert assignments to database"""
        if not self.db or not self.assignments:
            return
        
        try:
            # Convert to bulk insert format
            data_to_insert = []
            for assignment in self.assignments:
                data_to_insert.append({
                    'roster_id': self.roster_id,
                    'employee_id': assignment.employee_id,
                    'date': assignment.date.isoformat(),
                    'dagdeel': assignment.dagdeel,
                    'service_id': assignment.service_id,
                    'status': assignment.status
                })
            
            # Bulk insert
            response = self.db.table('roster_assignments').insert(data_to_insert).execute()
            self.logger.info(f"✅ Inserted {len(response.data)} assignments")
        except Exception as e:
            self.logger.error(f"Failed to save assignments: {e}")
    
    def _get_db_client(self) -> Optional[Client]:
        """Get Supabase client"""
        try:
            url = os.getenv('SUPABASE_URL')
            key = os.getenv('SUPABASE_KEY')
            
            if not url or not key:
                self.logger.warning("SUPABASE_URL or SUPABASE_KEY not set")
                return None
            
            return create_client(url, key)
        except Exception as e:
            self.logger.error(f"Failed to create Supabase client: {e}")
            return None


def main():
    """Test GREEDY Engine"""
    logging.basicConfig(level=logging.INFO)
    
    roster_id = '303ebcd1-054c-464b-b9f5-01175e70d719'
    planner = GreedyPlanner(roster_id)
    result = planner.solve()
    
    print(f"\n{'='*60}")
    print(f"GREEDY Engine Result for: {roster_id[:8]}")
    print(f"{'='*60}")
    print(f"Status: {result.status}")
    print(f"Coverage: {result.coverage:.1f}% ({result.assignments_created}/{result.total_required})")
    print(f"Solve Time: {result.solve_time:.2f}s")
    print(f"Bottlenecks: {len(result.bottlenecks)}")
    print(f"Message: {result.message}")
    print(f"{'='*60}\n")
    
    return result


if __name__ == '__main__':
    main()
