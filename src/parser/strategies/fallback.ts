import type { ParseStrategy, ParsedFields } from '../types';

/**
 * Fallback strategy: dumps the entire system content into description.
 * Used when no other strategy extracts meaningful fields.
 */
export const fallbackStrategy: ParseStrategy = {
  name: 'fallback',

  parse(systemContent: string): ParsedFields {
    return {
      description: systemContent.trim(),
    };
  },
};
