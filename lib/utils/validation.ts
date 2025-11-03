// lib/utils/validation.ts
// Sprint 1.2: Validatie utilities voor rooster ontwerp

/**
 * Valideer max shifts input (0-35 range)
 */
export function validateMaxShifts(value: any): { isValid: boolean; error?: string; normalizedValue?: number } {
  // Convert to number if string
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  
  // Check if it's a valid number
  if (isNaN(numValue) || !Number.isInteger(numValue)) {
    return {
      isValid: false,
      error: 'Voer een geldig getal in'
    };
  }
  
  // Check range
  if (numValue < 0) {
    return {
      isValid: false,
      error: 'Aantal diensten kan niet negatief zijn'
    };
  }
  
  if (numValue > 35) {
    return {
      isValid: false,
      error: 'Maximum 35 diensten per periode'
    };
  }
  
  return {
    isValid: true,
    normalizedValue: numValue
  };
}

/**
 * Valideer datum formaat (YYYY-MM-DD)
 */
export function validateDateFormat(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Valideer of datum een maandag is
 */
export function validateMonday(dateString: string): boolean {
  if (!validateDateFormat(dateString)) return false;
  
  const date = new Date(dateString);
  return date.getDay() === 1; // 1 = Monday
}

/**
 * Sanitize text input (trim, remove special chars for names)
 */
export function sanitizeText(input: string, maxLength: number = 100): string {
  return input.trim().substring(0, maxLength);
}

/**
 * Valideer employee ID format
 */
export function validateEmployeeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length <= 50;
}

/**
 * Valideer roster ID format
 */
export function validateRosterId(id: string): boolean {
  return /^r_[a-z0-9]+$/.test(id);
}

/**
 * Generieke form validatie result type
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Valideer complete roster ontwerp data
 */
export function validateRosterDesign(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic structure checks
  if (!data.rosterId || !validateRosterId(data.rosterId)) {
    errors.push('Ongeldig roster ID');
  }
  
  if (!data.employees || !Array.isArray(data.employees)) {
    errors.push('Geen medewerkers gevonden');
  } else {
    // Validate each employee
    data.employees.forEach((emp: any, index: number) => {
      if (!emp.name || typeof emp.name !== 'string') {
        errors.push(`Medewerker ${index + 1}: naam ontbreekt`);
      }
      
      const shiftsValidation = validateMaxShifts(emp.maxShifts);
      if (!shiftsValidation.isValid) {
        errors.push(`Medewerker ${emp.name || index + 1}: ${shiftsValidation.error}`);
      }
      
      // Warning for zero shifts
      if (emp.maxShifts === 0) {
        warnings.push(`Medewerker ${emp.name}: heeft 0 diensten (controleer of dit correct is)`);
      }
    });
  }
  
  if (!data.status || typeof data.status !== 'object') {
    errors.push('Status informatie ontbreekt');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Format validation errors voor UI weergave
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0];
  
  return `${errors.length} problemen gevonden:\n${errors.map((error, i) => `${i + 1}. ${error}`).join('\n')}`;
}