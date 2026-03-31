import type { ParsedFields, CharaCardV2 } from '../parser/types';

export function buildV2Card(fields: ParsedFields): CharaCardV2 {
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
      extensions: {},
    },
  };
}
