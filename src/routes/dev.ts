import { Hono } from 'hono';
import type { CardIndexEntry } from '../parser/types';

type Bindings = { CARDS: KVNamespace };

const dev = new Hono<{ Bindings: Bindings }>();

// Store full raw payloads from /v1/chat/completions
dev.post('/dev/intercept', async (c) => {
  const rawText = await c.req.text();
  const now = new Date();
  const id = now.toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + crypto.randomUUID().slice(0, 8);

  await c.env.CARDS.put(`debug:${id}`, rawText);

  // Update debug index
  const indexRaw = await c.env.CARDS.get('debug:index');
  const index: { id: string; created_at: string; size: number }[] = indexRaw ? JSON.parse(indexRaw) : [];
  index.unshift({ id, created_at: now.toISOString(), size: rawText.length });
  if (index.length > 50) index.length = 50;
  await c.env.CARDS.put('debug:index', JSON.stringify(index));

  return c.json({ stored: true, id, size: rawText.length });
});

// View a single raw payload
dev.get('/dev/payloads/:id', async (c) => {
  const id = c.req.param('id');
  const raw = await c.env.CARDS.get(`debug:${id}`);
  if (!raw) return c.json({ error: 'Payload not found' }, 404);

  // Try to parse as JSON for pretty display
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }

  return c.json({
    id,
    raw_length: raw.length,
    payload: parsed ?? raw,
  }, 200, {
    'Content-Type': 'application/json',
  });
});

// Delete a payload
dev.delete('/dev/payloads/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.CARDS.delete(`debug:${id}`);

  const indexRaw = await c.env.CARDS.get('debug:index');
  if (indexRaw) {
    const index = JSON.parse(indexRaw);
    const filtered = index.filter((e: { id: string }) => e.id !== id);
    await c.env.CARDS.put('debug:index', JSON.stringify(filtered));
  }

  return c.json({ ok: true });
});

// Dev dashboard - lists all captured payloads
dev.get('/dev', async (c) => {
  const indexRaw = await c.env.CARDS.get('debug:index');
  const index: { id: string; created_at: string; size: number }[] = indexRaw ? JSON.parse(indexRaw) : [];

  const listHtml = index.length === 0
    ? '<div class="empty">No payloads captured yet. Send a request to <code>/v1/chat/completions</code> and it will show up here.</div>'
    : index.map(entry => `
        <div class="payload-item">
          <div>
            <div class="payload-id">${entry.id}</div>
            <div class="payload-meta">${new Date(entry.created_at).toLocaleString()} &middot; ${(entry.size / 1024).toFixed(1)} KB</div>
          </div>
          <div class="payload-actions">
            <button onclick="viewPayload('${entry.id}')" class="btn btn-primary">View</button>
            <a href="/dev/payloads/${entry.id}" class="btn" target="_blank">Raw JSON</a>
            <button onclick="deletePayload('${entry.id}')" class="btn btn-danger">Delete</button>
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
    .btn-danger { color: #cf6679; border-color: #cf6679; }
    .btn-danger:hover { background: #2a1111; }
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
    <div class="nav"><a href="/">&larr; Back to main</a></div>
    <h1>Dev Debug</h1>
    <p class="subtitle">Raw payloads received at /v1/chat/completions</p>

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

      title.textContent = 'Payload: ' + id;
      viewer.style.display = 'block';

      // If it's an OpenAI request with messages, render them nicely
      const payload = data.payload;
      if (payload && payload.messages && Array.isArray(payload.messages)) {
        let html = '<div style="margin-bottom:1rem;color:#888;font-size:0.8rem;">';
        html += 'Model: ' + (payload.model || 'N/A');
        html += ' | Stream: ' + (payload.stream || false);
        html += ' | Messages: ' + payload.messages.length;
        html += '</div>';

        for (const msg of payload.messages) {
          const roleClass = msg.role || 'system';
          html += '<div class="msg-block ' + roleClass + '">';
          html += '<div class="msg-role msg-' + roleClass + '">' + escapeHtml(msg.role) + '</div>';
          html += '<pre>' + escapeHtml(msg.content || '') + '</pre>';
          html += '</div>';
        }

        // Also show full raw JSON collapsed
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

    async function deletePayload(id) {
      if (!confirm('Delete this payload?')) return;
      await fetch('/dev/payloads/' + id, { method: 'DELETE' });
      location.reload();
    }

    function escapeHtml(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
  </script>
</body>
</html>`;

  return c.html(page);
});

export { dev };
