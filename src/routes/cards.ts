import { Hono } from 'hono';
import type { StoredCard } from '../parser/types';
import { embedCardInPng } from '../card/png';

type Bindings = { CARDS: KVNamespace };

const cards = new Hono<{ Bindings: Bindings }>();

// Get card detail as JSON (for API consumers)
cards.get('/cards/:id/json', async (c) => {
  const id = c.req.param('id');
  const raw = await c.env.CARDS.get(`card:${id}`);
  if (!raw) return c.json({ error: 'Card not found' }, 404);

  const stored: StoredCard = JSON.parse(raw);
  return c.json(stored.card, 200, {
    'Content-Disposition': `attachment; filename="${stored.card.data.name || 'card'}.json"`,
  });
});

// Get card as PNG with embedded metadata
cards.get('/cards/:id/png', async (c) => {
  const id = c.req.param('id');
  const raw = await c.env.CARDS.get(`card:${id}`);
  if (!raw) return c.json({ error: 'Card not found' }, 404);

  const stored: StoredCard = JSON.parse(raw);
  const png = embedCardInPng(stored.card);

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${stored.card.data.name || 'card'}.png"`,
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
