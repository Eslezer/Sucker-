import type { ParseStrategy, ParsedFields } from '../types';
import { resolveFieldName, setField } from '../field-map';

/**
 * Matches patterns like:
 * [Scenario: some text here]
 * [Character's Personality: text]
 * [Name: "Character Name"]
 */
export const bracketedStrategy: ParseStrategy = {
  name: 'bracketed',

  parse(systemContent: string): ParsedFields {
    const fields: ParsedFields = {};

    // Match [Label: Content] - content can span multiple lines
    const regex = /\[([^\[\]]*?):\s*([\s\S]*?)\]/g;
    let match;

    while ((match = regex.exec(systemContent)) !== null) {
      const label = match[1].trim();
      const value = match[2].trim();

      const fieldKey = resolveFieldName(label);
      if (fieldKey) {
        setField(fields, fieldKey, value);
      }
    }

    return fields;
  },
};
