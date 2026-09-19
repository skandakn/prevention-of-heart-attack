import { FieldDefinition, ExtractionSchema, ExtractedFieldState, ExtractedDataState } from '../types/schema';

export class SchemaValidator {
  /**
   * Validates and coerces a raw candidate value according to the field definition.
   */
  public static validateAndCoerce(
    field: FieldDefinition,
    rawValue: any
  ): { valid: boolean; value?: any; error?: string } {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      if (field.required) {
        return { valid: false, error: `Field '${field.name}' is required but was empty.` };
      }
      return { valid: true, value: null };
    }

    switch (field.type) {
      case 'string':
        return { valid: true, value: String(rawValue).trim() };

      case 'number': {
        const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (isNaN(num)) {
          return { valid: false, error: `Value '${rawValue}' cannot be parsed as a number.` };
        }
        return { valid: true, value: num };
      }

      case 'integer': {
        const intVal = typeof rawValue === 'number' ? Math.floor(rawValue) : parseInt(String(rawValue), 10);
        if (isNaN(intVal)) {
          return { valid: false, error: `Value '${rawValue}' cannot be parsed as an integer.` };
        }
        return { valid: true, value: intVal };
      }

      case 'boolean': {
        if (typeof rawValue === 'boolean') {
          return { valid: true, value: rawValue };
        }
        const str = String(rawValue).toLowerCase().trim();
        if (['true', 'yes', 'y', '1', 'correct', 'right'].includes(str)) {
          return { valid: true, value: true };
        }
        if (['false', 'no', 'n', '0', 'incorrect', 'wrong'].includes(str)) {
          return { valid: true, value: false };
        }
        return { valid: false, error: `Value '${rawValue}' cannot be coerced to boolean.` };
      }

      case 'enum': {
        const strVal = String(rawValue).trim();
        const allowed = field.enumValues || [];
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

        // 1. Exact or case-insensitive match
        let match = allowed.find((val) => val.toLowerCase() === strVal.toLowerCase());
        if (!match) {
          // 2. Normalized match (ignoring spaces/underscores)
          match = allowed.find((val) => normalize(val) === normalize(strVal));
        }
        if (!match) {
          // 3. Substring match
          match = allowed.find(
            (val) => normalize(val).includes(normalize(strVal)) || normalize(strVal).includes(normalize(val))
          );
        }

        // 4. If still no direct enum matched, accept the string value rather than dropping it
        return { valid: true, value: match || strVal };
      }

      case 'date':
      case 'datetime': {
        const parsedDate = new Date(rawValue);
        if (isNaN(parsedDate.getTime())) {
          return { valid: false, error: `Value '${rawValue}' is not a valid date string.` };
        }
        return {
          valid: true,
          value: field.type === 'date' ? parsedDate.toISOString().split('T')[0] : parsedDate.toISOString(),
        };
      }

      case 'array': {
        if (!Array.isArray(rawValue)) {
          // If a single item or comma-separated string, try to wrap or split
          if (typeof rawValue === 'string' && rawValue.includes(',')) {
            const items = rawValue.split(',').map((s) => s.trim());
            return { valid: true, value: items };
          }
          return { valid: true, value: [rawValue] };
        }
        return { valid: true, value: rawValue };
      }

      case 'object': {
        if (typeof rawValue !== 'object' || rawValue === null) {
          return { valid: false, error: `Value '${rawValue}' is not a valid object.` };
        }
        return { valid: true, value: rawValue };
      }

      default:
        return { valid: true, value: rawValue };
    }
  }

  /**
   * Initializes empty extraction state for all fields in the schema.
   */
  public static initializeState(schema: ExtractionSchema): ExtractedDataState {
    const state: ExtractedDataState = {};
    for (const field of schema.fields) {
      state[field.name] = {
        value: field.default !== undefined ? field.default : null,
        status: field.default !== undefined ? 'inferred' : 'unknown',
        confidence: field.default !== undefined ? 0.5 : 0.0,
        source: 'system',
        updatedAt: Date.now(),
      };
    }
    return state;
  }

  /**
   * Generates a clean JSON Schema definition for Gemini Structured Output / function calling.
   */
  public static toGeminiJsonSchema(schema: ExtractionSchema): Record<string, any> {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const field of schema.fields) {
      const prop: Record<string, any> = {
        description: field.description,
      };

      switch (field.type) {
        case 'string':
        case 'date':
        case 'datetime':
          prop.type = 'STRING';
          break;
        case 'number':
          prop.type = 'NUMBER';
          break;
        case 'integer':
          prop.type = 'INTEGER';
          break;
        case 'boolean':
          prop.type = 'BOOLEAN';
          break;
        case 'enum':
          prop.type = 'STRING';
          if (field.enumValues && field.enumValues.length > 0) {
            prop.enum = field.enumValues;
          }
          break;
        case 'array':
          prop.type = 'ARRAY';
          prop.items = { type: 'STRING' };
          break;
        case 'object':
          prop.type = 'OBJECT';
          break;
        default:
          prop.type = 'STRING';
      }

      properties[field.name] = prop;
      if (field.required) {
        required.push(field.name);
      }
    }

    return {
      type: 'OBJECT',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
}
