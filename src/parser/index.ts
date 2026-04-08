import type { OpenAIMessage, ParsedFields } from './types';

/**
 * Pre-process content: fix unicode escapes and normalize whitespace
 */
function preprocess(content: string): string {
  return content
    // Fix unicode-escaped angle brackets
    .replace(/\\u003C/gi, '<')
    .replace(/\\u003E/gi, '>')
    .replace(/\\u0026/gi, '&')
    // Also handle HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

interface ExtractedTag {
  tagName: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Extract all XML-like tags and their content from text.
 * Returns both the extracted tags and the leftover text (content outside tags).
 */
function extractTags(text: string): { tags: ExtractedTag[]; leftover: string } {
  const tags: ExtractedTag[] = [];
  // Match <TagName>content</TagName> — tag names can contain apostrophes, spaces, underscores
  const regex = /<([^>\/]+?)>([\s\S]*?)<\/\1>/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    tags.push({
      tagName: match[1].trim(),
      content: match[2].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  // Build leftover: text that's NOT inside any matched tag
  let leftover = text;
  // Remove tags in reverse order to preserve indices
  const sorted = [...tags].sort((a, b) => b.startIndex - a.startIndex);
  for (const tag of sorted) {
    leftover = leftover.slice(0, tag.startIndex) + leftover.slice(tag.endIndex);
  }
  leftover = leftover.trim();

  return { tags, leftover };
}

/**
 * Extract character name from a persona tag like "Luna's Persona" or "CharName's Persona"
 */
function extractNameFromPersonaTag(tagName: string): string | undefined {
  // "Name's Persona" or "Name Persona"
  const match = tagName.match(/^(.+?)(?:'s)?\s+Persona$/i);
  if (match) return match[1].trim();
  return undefined;
}

/**
 * Resolve which V2 field a tag maps to
 */
function resolveTag(tagName: string): { field: keyof ParsedFields; charName?: string } | 'user_persona' | 'skip' | null {
  const lower = tagName.toLowerCase().trim();

  // UserPersona — extract but don't include in card
  if (lower === 'userpersona' || lower === 'user_persona' || lower === 'user persona') {
    return 'user_persona';
  }

  // Persona tags: "<Name's Persona>"
  if (lower.endsWith('persona') || lower.endsWith("'s persona")) {
    const charName = extractNameFromPersonaTag(tagName);
    return { field: 'personality', charName };
  }

  // Scenario
  if (lower === 'scenario' || lower === 'context' || lower === 'setting') {
    return { field: 'scenario' };
  }

  // Example dialogs
  if (lower === 'example_dialogs' || lower === 'example_dialog' ||
      lower === 'example dialogs' || lower === 'example messages' ||
      lower === 'examples' || lower === 'example_messages') {
    return { field: 'mes_example' };
  }

  // Description
  if (lower === 'description' || lower === 'char_description' ||
      lower === 'character description') {
    return { field: 'description' };
  }

  // System prompt
  if (lower === 'system_prompt' || lower === 'system prompt' ||
      lower === 'instructions' || lower === 'rules' || lower === 'guidelines') {
    return { field: 'system_prompt' };
  }

  // Creator notes
  if (lower === 'creator_notes' || lower === 'creator notes' ||
      lower === 'author_notes' || lower === 'author notes') {
    return { field: 'creator_notes' };
  }

  return null;
}

/**
 * Extract the user persona name from UserPersona content.
 * Typically starts with "Name:" or "Name is..." or just "Name\n..."
 */
function extractUserPersonaName(content: string): string | undefined {
  // "Name: description" or "Name\ndescription"
  const match = content.match(/^([A-Z][a-zA-Z\s]{0,25}?)(?:[:.\n])/);
  if (match) return match[1].trim();
  // Just take the first word if it's capitalized
  const firstWord = content.match(/^([A-Z][a-zA-Z]+)/);
  if (firstWord) return firstWord[1];
  return undefined;
}

/**
 * Parse lorebook entries from leftover content outside tags.
 * Lorebook entries are typically plain text blocks that were injected
 * from triggered lorebook entries in JanitorAI.
 */
function parseLorebook(leftover: string): ParsedFields['lorebook'] {
  if (!leftover.trim()) return undefined;

  const entries: { keys: string[]; content: string; enabled: boolean; insertion_order: number }[] = [];

  // Try to split by double newlines into separate entries
  const blocks = leftover.split(/\n{2,}/).filter(b => b.trim());

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    // Try to detect a "key: value" or title pattern at the start
    const titleMatch = block.match(/^([^\n:]{1,80})(?::\s*\n|:\s+|\n)/);
    const key = titleMatch ? titleMatch[1].trim() : `lorebook_entry_${i + 1}`;

    entries.push({
      keys: [key.toLowerCase().replace(/\s+/g, '_')],
      content: block,
      enabled: true,
      insertion_order: i,
    });
  }

  if (entries.length === 0) return undefined;

  return {
    name: 'Imported Lorebook',
    description: 'Lorebook entries extracted from JanitorAI',
    entries,
  };
}

/**
 * Parse OpenAI messages from JanitorAI into character card fields.
 */
export function parseMessages(messages: OpenAIMessage[]): ParsedFields {
  const fields: ParsedFields = {};

  // Separate messages by role
  const systemMessages = messages.filter(m => m.role === 'system');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  const userMessages = messages.filter(m => m.role === 'user');

  // Concat and preprocess all system content
  const systemContent = preprocess(
    systemMessages.map(m => m.content).join('\n\n')
  );

  // Extract all XML-like tags
  const { tags, leftover } = extractTags(systemContent);

  let userPersonaName: string | undefined;
  let userPersonaContent: string | undefined;

  // Process each tag
  for (const tag of tags) {
    const resolved = resolveTag(tag.tagName);

    if (resolved === 'user_persona') {
      userPersonaContent = tag.content;
      userPersonaName = extractUserPersonaName(tag.content);
      continue;
    }

    if (resolved === 'skip' || resolved === null) {
      // Unknown tag — treat as potential lorebook content? Or skip.
      continue;
    }

    // Set the field
    const { field, charName } = resolved;
    if (charName && !fields.name) {
      fields.name = charName;
    }

    const existing = fields[field];
    if (existing && typeof existing === 'string') {
      (fields as Record<string, unknown>)[field] = existing + '\n\n' + tag.content;
    } else {
      (fields as Record<string, unknown>)[field] = tag.content;
    }
  }

  // Parse lorebook from leftover content
  const lorebook = parseLorebook(leftover);
  if (lorebook) {
    fields.lorebook = lorebook;
  }

  // First assistant message = first_mes (greeting)
  // Skip any "." placeholder messages
  const greeting = assistantMessages.find(m => m.content.trim() !== '.');
  if (greeting) {
    fields.first_mes = greeting.content;
  } else if (assistantMessages.length > 0) {
    fields.first_mes = assistantMessages[0].content;
  }

  // Try to get user persona name from the extraction message (last user message)
  // Format: "PersonaName: message text"
  if (!userPersonaName && userMessages.length >= 2) {
    const extractionMsg = userMessages[userMessages.length - 1].content;
    const match = extractionMsg.match(/^([A-Z][a-zA-Z\s]{0,25}?):\s/);
    if (match) {
      userPersonaName = match[1].trim();
    }
  }

  // Store the user persona name for {{user}} replacement
  if (userPersonaName) {
    fields._user_persona_name = userPersonaName;

    // Replace user persona name with {{user}} macro across all text fields
    const textFields: (keyof ParsedFields)[] = [
      'description', 'personality', 'scenario', 'first_mes',
      'mes_example', 'system_prompt', 'creator_notes',
    ];
    for (const key of textFields) {
      const val = fields[key];
      if (typeof val === 'string' && val.includes(userPersonaName)) {
        (fields as Record<string, unknown>)[key] = val.replace(
          new RegExp(escapeRegex(userPersonaName), 'g'),
          '{{user}}'
        );
      }
    }
  }

  // Try to extract name from assistant message if still missing
  // Some bots start with "*Name does something*"
  if (!fields.name && fields.first_mes) {
    const actionMatch = fields.first_mes.match(/^\*([A-Z][a-zA-Z]{1,20})\s/);
    if (actionMatch) {
      fields.name = actionMatch[1];
    }
  }

  return fields;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
