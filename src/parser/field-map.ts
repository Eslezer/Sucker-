import type { ParsedFields } from './types';

type FieldKey = keyof Omit<ParsedFields, '_unmatched' | 'alternate_greetings' | 'tags'>;

const FIELD_ALIASES: Record<string, FieldKey> = {
  // Scenario
  'scenario': 'scenario',
  'context': 'scenario',
  'setting': 'scenario',
  'world': 'scenario',
  'world info': 'scenario',
  'lore': 'scenario',

  // Personality
  'personality': 'personality',
  'character personality': 'personality',
  "character's personality": 'personality',
  'chars personality': 'personality',
  'traits': 'personality',
  'personality traits': 'personality',

  // Description
  'description': 'description',
  'character description': 'description',
  'char description': 'description',
  'about': 'description',
  'character info': 'description',
  'char info': 'description',
  'bio': 'description',
  'biography': 'description',
  'profile': 'description',
  'appearance': 'description',

  // Example messages
  'example messages': 'mes_example',
  'example dialogue': 'mes_example',
  'example conversations': 'mes_example',
  'sample messages': 'mes_example',
  'example dialog': 'mes_example',
  'example chats': 'mes_example',
  'dialogue examples': 'mes_example',
  'message examples': 'mes_example',
  'examples': 'mes_example',
  'example': 'mes_example',

  // First message
  'first message': 'first_mes',
  'greeting': 'first_mes',
  'initial message': 'first_mes',
  'opening': 'first_mes',
  'opener': 'first_mes',
  'intro': 'first_mes',

  // Creator notes
  'creator notes': 'creator_notes',
  "creator's notes": 'creator_notes',
  'notes': 'creator_notes',
  'author notes': 'creator_notes',

  // System prompt
  'system prompt': 'system_prompt',
  'system note': 'system_prompt',
  'system notes': 'system_prompt',
  'system instructions': 'system_prompt',
  'instructions': 'system_prompt',
  'guidelines': 'system_prompt',
  'rules': 'system_prompt',

  // Post history instructions
  'jailbreak': 'post_history_instructions',
  'ujb': 'post_history_instructions',
  'post history instructions': 'post_history_instructions',

  // Name
  'name': 'name',
  'character name': 'name',
  'char name': 'name',
  'character': 'name',

  // Creator
  'creator': 'creator',
  'author': 'creator',
  'made by': 'creator',
  'created by': 'creator',

  // Version
  'version': 'character_version',
  'character version': 'character_version',
};

/**
 * Normalize a label string and resolve it to a canonical field key.
 * Returns undefined if not recognized.
 */
export function resolveFieldName(label: string): FieldKey | undefined {
  const normalized = label
    .toLowerCase()
    .trim()
    .replace(/[''\u2019]/g, "'")       // normalize quotes
    .replace(/^(character'?s?|char'?s?)\s+/i, '')  // strip char prefix
    .replace(/\s+/g, ' ')              // collapse whitespace
    .trim();

  // Direct lookup
  if (FIELD_ALIASES[normalized]) {
    return FIELD_ALIASES[normalized];
  }

  // Try with "character " prefix re-added for some aliases
  const withPrefix = `character ${normalized}`;
  if (FIELD_ALIASES[withPrefix]) {
    return FIELD_ALIASES[withPrefix];
  }

  return undefined;
}

/**
 * Set a field on ParsedFields, appending if already set for certain fields.
 */
export function setField(fields: ParsedFields, key: FieldKey, value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;

  const existing = fields[key];
  if (existing && typeof existing === 'string') {
    // Append with newline for description-like fields
    (fields as Record<string, unknown>)[key] = existing + '\n\n' + trimmed;
  } else {
    (fields as Record<string, unknown>)[key] = trimmed;
  }
}
