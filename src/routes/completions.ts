import { Hono } from 'hono';
import type { OpenAIChatRequest, StoredCard, CardIndexEntry } from '../parser/types';
import { parseMessages } from '../parser/index';
import { buildV2Card } from '../card/v2';
import { buildChatCompletionResponse, buildStreamResponse } from '../openai/response';

type Bindings = { CARDS: KVNamespace };

const completions = new Hono<{ Bindings: Bindings }>();

completions.post('/v1/chat/completions', async (c) => {
  let body: OpenAIChatRequest;
  try {
    body = await c.req.json<OpenAIChatRequest>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: 'No messages provided' }, 400);
  }

  // Generate a sortable ID (used for both debug and card)
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const rand = crypto.randomUUID().slice(0, 8);
  const cardId = `${timestamp}-${rand}`;

  // Store raw payload for dev/debug — use the same ID as the card
  const debugPayload = JSON.stringify(body);
  await c.env.CARDS.put(`debug:${cardId}`, debugPayload);

  const debugIndexRaw = await c.env.CARDS.get('debug:index');
  const debugIndex: { id: string; created_at: string; size: number }[] = debugIndexRaw ? JSON.parse(debugIndexRaw) : [];
  debugIndex.unshift({ id: cardId, created_at: now.toISOString(), size: debugPayload.length });
  if (debugIndex.length > 50) debugIndex.length = 50;
  await c.env.CARDS.put('debug:index', JSON.stringify(debugIndex));

  // Parse the messages into card fields
  const parsed = parseMessages(body.messages);
  const card = buildV2Card(parsed);

  // Store the card + raw messages
  const stored: StoredCard = {
    id: cardId,
    card,
    raw_messages: body.messages,
    created_at: now.toISOString(),
  };

  await c.env.CARDS.put(`card:${cardId}`, JSON.stringify(stored));

  // Update index
  const indexRaw = await c.env.CARDS.get('cards:index');
  const index: CardIndexEntry[] = indexRaw ? JSON.parse(indexRaw) : [];
  index.unshift({
    id: cardId,
    name: card.data.name,
    created_at: now.toISOString(),
  });
  // Keep last 100 entries
  if (index.length > 100) index.length = 100;
  await c.env.CARDS.put('cards:index', JSON.stringify(index));

  const baseUrl = new URL(c.req.url).origin;

  // Handle streaming requests
  if (body.stream) {
    const sseBody = buildStreamResponse(cardId, card.data.name, baseUrl);
    return new Response(sseBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  return c.json(buildChatCompletionResponse(cardId, card.data.name, baseUrl));
});

// Also handle /chat/completions without the v1 prefix
completions.post('/chat/completions', async (c) => {
  // Rewrite to the canonical path
  const url = new URL(c.req.url);
  url.pathname = '/v1/chat/completions';
  const newReq = new Request(url.toString(), c.req.raw);
  return completions.fetch(newReq, c.env);
});

export { completions };
