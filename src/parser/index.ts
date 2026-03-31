import type { OpenAIMessage, ParsedFields } from './types';
import { bracketedStrategy } from './strategies/bracketed';
import { xmlTagsStrategy } from './strategies/xml-tags';
import { colonLabeledStrategy } from './strategies/colon-labeled';
import { markdownHeadersStrategy } from './strategies/markdown-headers';
import { fallbackStrategy } from './strategies/fallback';

const strategies = [
  bracketedStrategy,
  xmlTagsStrategy,
  colonLabeledStrategy,
  markdownHeadersStrategy,
];

/** Count non-empty string fields in a ParsedFields object */
function scoreFields(fields: ParsedFields): number {
  let count = 0;
  for (const [key, value] of Object.entries(fields)) {
    if (key.startsWith('_')) continue;
    if (typeof value === 'string' && value.trim()) count++;
    if (Array.isArray(value) && value.length > 0) count++;
  }
  return count;
}

/** Merge source fields into target, only filling gaps */
function mergeFields(target: ParsedFields, source: ParsedFields): void {
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith('_')) continue;
    const targetVal = (target as Record<string, unknown>)[key];
    if (!targetVal || (typeof targetVal === 'string' && !targetVal.trim())) {
      (target as Record<string, unknown>)[key] = value;
    }
  }
}

/** Try to extract character name from system content using common patterns */
function extractName(systemContent: string): string | undefined {
  // Pattern: "You are <Name>" or "You will be playing as <Name>"
  const youAreMatch = systemContent.match(
    /you (?:are|will be|play(?:ing)? as|act as|roleplay as)\s+["']?([A-Z][a-zA-Z\s]{1,30}?)["']?[.,!\n]/i
  );
  if (youAreMatch) return youAreMatch[1].trim();

  // Pattern: {{char}} = Name or {{char}}'s name is Name
  const charMatch = systemContent.match(
    /\{\{char\}\}\s*(?:=|is|'s name is)\s*["']?([A-Z][a-zA-Z\s]{1,30}?)["']?[.,!\n]/i
  );
  if (charMatch) return charMatch[1].trim();

  // Pattern: "Name:" at the very start of content
  const startMatch = systemContent.match(/^["']?([A-Z][a-zA-Z]{1,20})["']?\s*(?:is|:)/);
  if (startMatch) return startMatch[1].trim();

  return undefined;
}

/**
 * Parse OpenAI messages into character card fields.
 *
 * Strategy:
 * 1. Separate messages by role
 * 2. Concat all system messages for field extraction
 * 3. First assistant message becomes first_mes
 * 4. Run all parse strategies, score by fields extracted
 * 5. Use best result, merge unique fields from others
 * 6. Try to extract character name if not found
 */
export function parseMessages(messages: OpenAIMessage[]): ParsedFields {
  // Separate by role
  const systemMessages = messages.filter(m => m.role === 'system');
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  const systemContent = systemMessages.map(m => m.content).join('\n\n');
  const firstAssistantContent = assistantMessages[0]?.content || '';

  // Run all strategies
  const results = strategies.map(strategy => ({
    name: strategy.name,
    fields: strategy.parse(systemContent),
    score: 0,
  }));

  // Score each
  for (const result of results) {
    result.score = scoreFields(result.fields);
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Use best result, or fallback if none extracted 2+ fields
  let best: ParsedFields;
  if (results[0] && results[0].score >= 2) {
    best = results[0].fields;
    // Merge unique fields from other strategies
    for (let i = 1; i < results.length; i++) {
      if (results[i].score > 0) {
        mergeFields(best, results[i].fields);
      }
    }
  } else {
    // Fallback: dump everything into description
    best = fallbackStrategy.parse(systemContent);
  }

  // Always set first_mes from assistant message
  if (firstAssistantContent) {
    best.first_mes = firstAssistantContent;
  }

  // Extract name if not found
  if (!best.name) {
    best.name = extractName(systemContent);
  }

  // Try to extract name from the first assistant message format
  // Some bots start with "*Name does something*"
  if (!best.name && firstAssistantContent) {
    const actionMatch = firstAssistantContent.match(/^\*([A-Z][a-zA-Z]{1,20})\s/);
    if (actionMatch) {
      best.name = actionMatch[1];
    }
  }

  return best;
}
