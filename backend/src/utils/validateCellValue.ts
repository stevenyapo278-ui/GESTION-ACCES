import { ColumnType } from '@prisma/client';

interface ValidateOptions {
  value: any;
  type: ColumnType;
  columnName: string;
  options?: string[]; // For DROPDOWN / MULTI_SELECT
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-\+\(\)]{6,20}$/;
const TIME_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

export function validateCellValue({ value, type, columnName, options }: ValidateOptions): ValidationResult {
  // Skip empty/null/undefined
  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  switch (type) {
    case 'NUMBER':
    case 'DECIMAL':
    case 'CURRENCY':
    case 'PERCENTAGE': {
      const num = Number(value);
      if (isNaN(num)) {
        return { valid: false, error: `« ${columnName} » doit être un nombre valide` };
      }
      // Store as number for numeric types
      return { valid: true };
    }

    case 'DATE': {
      if (typeof value === 'string' && value.trim()) {
        const d = new Date(value);
        if (isNaN(d.getTime())) {
          return { valid: false, error: `« ${columnName} » doit être une date valide` };
        }
      }
      return { valid: true };
    }

    case 'DATE_TIME': {
      if (typeof value === 'string' && value.trim()) {
        // Accept ISO format or datetime-local format
        const d = new Date(value);
        if (isNaN(d.getTime())) {
          return { valid: false, error: `« ${columnName} » doit être une date/heure valide` };
        }
      }
      return { valid: true };
    }

    case 'TIME': {
      if (typeof value === 'string' && value.trim()) {
        if (!TIME_REGEX.test(value)) {
          return { valid: false, error: `« ${columnName} » doit être une heure valide (HH:mm)` };
        }
      }
      return { valid: true };
    }

    case 'EMAIL': {
      if (typeof value === 'string' && value.trim()) {
        if (!EMAIL_REGEX.test(value)) {
          return { valid: false, error: `« ${columnName} » doit être un email valide` };
        }
      }
      return { valid: true };
    }

    case 'URL': {
      if (typeof value === 'string' && value.trim()) {
        try {
          new URL(value);
        } catch {
          return { valid: false, error: `« ${columnName} » doit être une URL valide (avec https://)` };
        }
      }
      return { valid: true };
    }

    case 'PHONE': {
      if (typeof value === 'string' && value.trim()) {
        if (!PHONE_REGEX.test(value)) {
          return { valid: false, error: `« ${columnName} » doit être un numéro de téléphone valide` };
        }
      }
      return { valid: true };
    }

    case 'CHECKBOX':
    case 'YES_NO': {
      if (value !== true && value !== false && value !== 'true' && value !== 'false') {
        return { valid: false, error: `« ${columnName} » doit être Oui ou Non` };
      }
      return { valid: true };
    }

    case 'DROPDOWN': {
      if (options && options.length > 0) {
        const val = String(value);
        if (!options.includes(val)) {
          return {
            valid: false,
            error: `« ${columnName} » doit être l'une des valeurs suivantes : ${options.join(', ')}`,
          };
        }
      }
      return { valid: true };
    }

    case 'MULTI_SELECT': {
      if (options && options.length > 0) {
        const vals = Array.isArray(value) ? value.map(String) : [String(value)];
        const invalid = vals.filter((v: string) => !options!.includes(v));
        if (invalid.length > 0) {
          return {
            valid: false,
            error: `« ${columnName} » contient des valeurs non autorisées : ${invalid.join(', ')}`,
          };
        }
      }
      return { valid: true };
    }

    // Types without specific validation
    case 'TEXT':
    case 'LONG_TEXT':
    case 'USER':
    case 'IMAGE':
    case 'FILE':
    case 'SIGNATURE':
    case 'LOCATION':
    case 'FORMULA':
    case 'AUTO_CALC':
    default:
      return { valid: true };
  }
}

/**
 * Validate an entire values object against column definitions.
 * Returns the first error found, or null if all values are valid.
 */
export function validateRowValues(
  values: Record<string, any>,
  columns: Array<{ id: string; name: string; type: ColumnType; options?: any }>,
): string | null {
  const colMap = new Map(columns.map((c) => [c.id, c]));

  for (const [columnId, value] of Object.entries(values)) {
    const col = colMap.get(columnId);
    if (!col) continue;

    let parsedOptions: string[] | undefined;
    if (col.options) {
      if (Array.isArray(col.options)) {
        parsedOptions = col.options as string[];
      } else if (typeof col.options === 'string') {
        try {
          parsedOptions = JSON.parse(col.options);
        } catch {
          parsedOptions = undefined;
        }
      }
    }

    const result = validateCellValue({
      value,
      type: col.type,
      columnName: col.name,
      options: parsedOptions,
    });

    if (!result.valid) {
      return result.error!;
    }
  }

  return null;
}
