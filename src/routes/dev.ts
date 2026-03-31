import { Hono } from 'hono';
import type { CardIndexEntry, StoredCard } from '../parser/types';

type Bindings = { CARDS: KVNamespace };

const dev = new Hono<{ Bindings: Bindings }>();

// Diagnostic: dump all KV keys to see what's actually stored
dev.get('/dev/diag', async (c) => {
  const list = await c.env.CARDS.list();
  return c.json({
    keys: list.keys.map(k => k.name),
    count: list.keys.length,
    list_complete: list.list_complete,
  });
});

// View a single raw payload — tries debug:id first, then falls back to card:id raw_messages
dev.get('/dev/payloads/:id', async (c) => {
  const id = c.req.param('id');

  // Try debug key first
  const debug = await c.env.CARDS.get(`debug:${id}`);
  if (debug) {
    let parsed: unknown;
    try { parsed = JSON.parse(debug); } catch { parsed = null; }
    return c.json({ id, source: 'debug', raw_length: debug.length, payload: parsed ?? debug });
  }

  // Fall back to card's raw_messages
  const cardRaw = await c.env.CARDS.get(`card:${id}`);
  if (cardRaw) {
    const stored: StoredCard = JSON.parse(cardRaw);
    return c.json({
      id,
      source: 'card',
      raw_length: cardRaw.length,
      payload: { messages: stored.raw_messages },
    });
  }

  return c.json({ error: 'Payload not found' }, 404);
});

// Delete a payload
dev.delete('/dev/payloads/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.CARDS.delete(`debug:${id}`);
  return c.json({ ok: true });
});

// Dev dashboard — reads from the CARDS index (which we know works) instead of a separate debug index
dev.get('/dev', async (c) => {
  // Use the cards index as our source of truth since cards ARE being created
  const cardsIndexRaw = await c.env.CARDS.get('cards:index');
  const cardsIndex: CardIndexEntry[] = cardsIndexRaw ? JSON.parse(cardsIndexRaw) : [];

  const listHtml = cardsIndex.length === 0
    ? '<div class="empty">No payloads captured yet. Send a request to <code>/v1/chat/completions</code> and it will show up here.</div>'
    : cardsIndex.map(entry => `
        <div class="payload-item">
          <div>
            <div class="payload-id">${escapeHtml(entry.name)} <span style="color:#666;font-size:0.75rem;">(${entry.id})</span></div>
            <div class="payload-meta">${new Date(entry.created_at).toLocaleString()}</div>
          </div>
          <div class="payload-actions">
            <button onclick="viewPayload('${entry.id}')" class="btn btn-primary">View Payload</button>
            <a href="/dev/payloads/${entry.id}" class="btn" target="_blank">Raw JSON</a>
          </div>
        </div>
      `).join('');

  const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sucker - Dev Debug</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; background: #0a0a0a; color: #e0e0e0; min-height: 100vh; }
    .container { max-width: 1100px; margin: 0 auto; padding: 2rem 1rem; }
    h1 { color: #ff9800; margin-bottom: 0.3rem; font-size: 1.6rem; }
    .subtitle { color: #888; margin-bottom: 1.5rem; font-size: 0.85rem; }
    .nav { margin-bottom: 1.5rem; }
    .nav a { color: #bb86fc; text-decoration: none; margin-right: 1rem; }
    .diag-link { color: #ff9800; text-decoration: none; font-size: 0.8rem; }
    .payload-item {
      background: #111;
      border: 1px solid #333;
      border-radius: 6px;
      padding: 0.8rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.6rem;
    }
    .payload-item:hover { border-color: #ff9800; }
    .payload-id { font-weight: 600; color: #ff9800; font-size: 0.9rem; }
    .payload-meta { color: #666; font-size: 0.75rem; margin-top: 0.2rem; }
    .payload-actions { display: flex; gap: 0.4rem; }
    .btn {
      padding: 0.35rem 0.7rem;
      border-radius: 4px;
      border: 1px solid #444;
      background: #1a1a1a;
      color: #ff9800;
      text-decoration: none;
      font-size: 0.75rem;
      cursor: pointer;
      font-family: inherit;
    }
    .btn:hover { background: #2a2a2a; border-color: #ff9800; }
    .btn-primary { background: #ff9800; color: #000; border-color: #ff9800; font-weight: 600; }
    .btn-primary:hover { background: #ffb74d; }
    .empty { text-align: center; color: #555; padding: 3rem; }
    .empty code { background: #1a1a1a; padding: 0.2rem 0.5rem; border-radius: 3px; color: #ff9800; }
    #viewer {
      display: none;
      background: #111;
      border: 1px solid #ff9800;
      border-radius: 6px;
      padding: 1rem;
      margin-top: 1rem;
      max-height: 70vh;
      overflow-y: auto;
    }
    #viewer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.8rem;
    }
    #viewer-header h3 { color: #ff9800; font-size: 0.95rem; }
    #viewer pre {
      background: #0a0a0a;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.8rem;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .msg-system { color: #81d4fa; }
    .msg-user { color: #a5d6a7; }
    .msg-assistant { color: #ffcc80; }
    .msg-role { font-weight: bold; text-transform: uppercase; margin-bottom: 0.3rem; }
    .msg-block { margin-bottom: 1rem; padding: 0.6rem; border-left: 3px solid #333; }
    .msg-block.system { border-color: #81d4fa; }
    .msg-block.user { border-color: #a5d6a7; }
    .msg-block.assistant { border-color: #ffcc80; }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/">&larr; Back to main</a>
      <a href="/dev/diag" class="diag-link">[KV Diagnostic]</a>
    </div>
    <h1>Dev Debug</h1>
    <p class="subtitle">Raw payloads received at /v1/chat/completions (sourced from card data)</p>

    ${listHtml}

    <div id="viewer">
      <div id="viewer-header">
        <h3 id="viewer-title">Payload</h3>
        <button onclick="closeViewer()" class="btn">Close</button>
      </div>
      <div id="viewer-content"></div>
    </div>
  </div>
  <script>
    async function viewPayload(id) {
      const res = await fetch('/dev/payloads/' + id);
      const data = await res.json();
      const viewer = document.getElementById('viewer');
      const content = document.getElementById('viewer-content');
      const title = document.getElementById('viewer-title');

      title.textContent = 'Payload: ' + id + ' (source: ' + (data.source || '?') + ')';
      viewer.style.display = 'block';

      const payload = data.payload;
      if (payload && payload.messages && Array.isArray(payload.messages)) {
        let html = '<div style="margin-bottom:1rem;color:#888;font-size:0.8rem;">';
        html += 'Source: ' + (data.source || '?');
        html += ' | Messages: ' + payload.messages.length;
        if (payload.model) html += ' | Model: ' + payload.model;
        if (payload.stream !== undefined) html += ' | Stream: ' + payload.stream;
        html += '</div>';

        for (const msg of payload.messages) {
          const roleClass = msg.role || 'system';
          html += '<div class="msg-block ' + roleClass + '">';
          html += '<div class="msg-role msg-' + roleClass + '">' + escapeHtml(msg.role || 'unknown') + '</div>';
          html += '<pre>' + escapeHtml(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)) + '</pre>';
          html += '</div>';
        }

        html += '<details style="margin-top:1rem;"><summary style="cursor:pointer;color:#888;">Full raw JSON</summary>';
        html += '<pre>' + escapeHtml(JSON.stringify(payload, null, 2)) + '</pre>';
        html += '</details>';

        content.innerHTML = html;
      } else {
        content.innerHTML = '<pre>' + escapeHtml(JSON.stringify(payload, null, 2)) + '</pre>';
      }

      viewer.scrollIntoView({ behavior: 'smooth' });
    }

    function closeViewer() {
      document.getElementById('viewer').style.display = 'none';
    }

    function escapeHtml(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
  </script>
</body>
</html>`;

  return c.html(page);
});

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export { dev };
