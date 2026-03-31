import type { ParseStrategy, ParsedFields } from '../types';
import { resolveFieldName, setField } from '../field-map';

/**
 * Matches patterns like:
 * Scenario: some text here
 * that continues on the next line
 *
 * Personality: more text
 *
 * Content extends until the next recognized label or end of text.
 */
export const colonLabeledStrategy: ParseStrategy = {
  name: 'colon-labeled',

  parse(systemContent: string): ParsedFields {
    const fields: ParsedFields = {};

    // Split content into lines for processing
    const lines = systemContent.split('\n');
    // Regex for a label line: starts with capitalized word(s) followed by colon
    const labelRegex = /^([A-Z][\w'']*(?:\s+[\w'']+){0,4}):\s*(.*)/;

    let currentField: string | undefined;
    let currentValue: string[] = [];

    const flushCurrent = () => {
      if (currentField && currentValue.length > 0) {
        const fieldKey = resolveFieldName(currentField);
        if (fieldKey) {
          setField(fields, fieldKey, currentValue.join('\n').trim());
        }
      }
      currentField = undefined;
      currentValue = [];
    };

    for (const line of lines) {
      const match = line.match(labelRegex);
      if (match) {
        const potentialField = match[1].trim();
        const resolved = resolveFieldName(potentialField);
        if (resolved) {
          // Flush previous field
          flushCurrent();
          currentField = potentialField;
          if (match[2].trim()) {
            currentValue.push(match[2]);
          }
          continue;
        }
      }

      // Continue accumulating under current field
      if (currentField !== undefined) {
        currentValue.push(line);
      }
    }

    // Flush last field
    flushCurrent();

    return fields;
  },
};
