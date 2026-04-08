import { Hono } from 'hono';
import type { StoredCard } from '../parser/types';
import { parseMessages } from '../parser/index';
import { buildV2Card } from '../card/v2';
import { embedCardInPng } from '../card/png';

type Bindings = { CARDS: KVNamespace };

const cards = new Hono<{ Bindings: Bindings }>();

// Helper: rebuild card with or without lorebook
function getCard(stored: StoredCard, includeLorebook: boolean) {
  if (!includeLorebook) {
    // Re-parse and rebuild without lorebook
    const parsed = parseMessages(stored.raw_messages);
    return buildV2Card(parsed, false);
  }
  return stored.card;
}

// Get card detail as JSON
cards.get('/cards/:id/json', async (c) => {
  const id = c.req.param('id');
  const raw = await c.env.CARDS.get(`card:${id}`);
  if (!raw) return c.json({ error: 'Card not found' }, 404);

  const stored: StoredCard = JSON.parse(raw);
  const includeLorebook = c.req.query('lorebook') !== 'false';
  const card = getCard(stored, includeLorebook);
  const suffix = includeLorebook ? '' : '_no-lorebook';

  return c.json(card, 200, {
    'Content-Disposition': `attachment; filename="${(card.data.name || 'card') + suffix}.json"`,
  });
});

// Get card as PNG with embedded metadata
cards.get('/cards/:id/png', async (c) => {
  const id = c.req.param('id');
  const raw = await c.env.CARDS.get(`card:${id}`);
  if (!raw) return c.json({ error: 'Card not found' }, 404);

  const stored: StoredCard = JSON.parse(raw);
  const includeLorebook = c.req.query('lorebook') !== 'false';
  const card = getCard(stored, includeLorebook);
  const suffix = includeLorebook ? '' : '_no-lorebook';
  const png = embedCardInPng(card);

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${(card.data.name || 'card') + suffix}.png"`,
    },
  });
});

// Get raw messages (for debugging)
cards.get('/cards/:id/raw', async (c) => {
  const id = c.req.param('id');
  const raw = await c.env.CARDS.get(`card:${id}`);
  if (!raw) return c.json({ error: 'Card not found' }, 404);

  const stored: StoredCard = JSON.parse(raw);
  return c.json(stored.raw_messages);
});

// Delete a card
cards.delete('/cards/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.CARDS.delete(`card:${id}`);
  await c.env.CARDS.delete(`debug:${id}`);

  // Remove from index
  const indexRaw = await c.env.CARDS.get('cards:index');
  if (indexRaw) {
    const index = JSON.parse(indexRaw);
    const filtered = index.filter((e: { id: string }) => e.id !== id);
    await c.env.CARDS.put('cards:index', JSON.stringify(filtered));
  }

  return c.json({ ok: true });
});

export { cards };
