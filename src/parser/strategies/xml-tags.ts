import type { ParseStrategy, ParsedFields } from '../types';
import { resolveFieldName, setField } from '../field-map';

/**
 * Matches XML-like tag patterns:
 * <scenario>some text</scenario>
 * <personality>text here</personality>
 * <char_description>text</char_description>
 */
export const xmlTagsStrategy: ParseStrategy = {
  name: 'xml-tags',

  parse(systemContent: string): ParsedFields {
    const fields: ParsedFields = {};

    // Match <tag>content</tag> - tag names can have underscores/hyphens
    const regex = /<([\w-]+)>([\s\S]*?)<\/\1>/g;
    let match;

    while ((match = regex.exec(systemContent)) !== null) {
      const tagName = match[1].replace(/[_-]/g, ' ').trim();
      const value = match[2].trim();

      const fieldKey = resolveFieldName(tagName);
      if (fieldKey) {
        setField(fields, fieldKey, value);
      }
    }

    return fields;
  },
};
