import type { ParseStrategy, ParsedFields } from '../types';
import { resolveFieldName, setField } from '../field-map';

/**
 * Matches markdown header patterns:
 * ## Scenario
 * some text here
 *
 * ### Personality
 * more text
 */
export const markdownHeadersStrategy: ParseStrategy = {
  name: 'markdown-headers',

  parse(systemContent: string): ParsedFields {
    const fields: ParsedFields = {};

    // Split by markdown headers
    const headerRegex = /^(#{1,4})\s+(.+)$/gm;
    const sections: { label: string; startIndex: number }[] = [];

    let match;
    while ((match = headerRegex.exec(systemContent)) !== null) {
      sections.push({
        label: match[2].trim(),
        startIndex: match.index + match[0].length,
      });
    }

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const endIndex = i + 1 < sections.length
        ? sections[i + 1].startIndex - sections[i + 1].label.length - 5 // approx header start
        : systemContent.length;

      const content = systemContent.slice(section.startIndex, endIndex).trim();
      const fieldKey = resolveFieldName(section.label);

      if (fieldKey && content) {
        setField(fields, fieldKey, content);
      }
    }

    return fields;
  },
};
