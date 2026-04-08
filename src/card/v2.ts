import type { ParsedFields, CharaCardV2 } from '../parser/types';

export function buildV2Card(fields: ParsedFields, includeLorebook: boolean = true): CharaCardV2 {
  const extensions: Record<string, unknown> = {};

  // Embed lorebook in extensions if present (SillyTavern format)
  if (includeLorebook && fields.lorebook && fields.lorebook.entries.length > 0) {
    extensions.world = fields.lorebook.name || 'Imported Lorebook';
    extensions.lorebook = {
      name: fields.lorebook.name || 'Imported Lorebook',
      description: fields.lorebook.description || '',
      scan_depth: 2,
      token_budget: 500,
      recursive_scanning: false,
      entries: Object.fromEntries(
        fields.lorebook.entries.map((entry, i) => [
          String(i),
          {
            uid: i,
            key: entry.keys,
            keysecondary: [],
            comment: entry.keys[0] || `entry_${i}`,
            content: entry.content,
            constant: false,
            selective: false,
            insertion_order: entry.insertion_order,
            enabled: entry.enabled,
            position: 'after_char',
            extensions: { display_index: i },
          },
        ])
      ),
    };
  }

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: fields.name || 'Unknown',
      description: fields.description || '',
      personality: fields.personality || '',
      scenario: fields.scenario || '',
      first_mes: fields.first_mes || '',
      mes_example: fields.mes_example || '',
      creator_notes: fields.creator_notes || '',
      system_prompt: fields.system_prompt || '',
      post_history_instructions: fields.post_history_instructions || '',
      alternate_greetings: fields.alternate_greetings || [],
      tags: fields.tags || [],
      creator: fields.creator || '',
      character_version: fields.character_version || '',
      extensions,
    },
  };
}
