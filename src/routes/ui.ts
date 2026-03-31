import { Hono } from 'hono';
import type { StoredCard, CardIndexEntry } from '../parser/types';

type Bindings = { CARDS: KVNamespace };

const ui = new Hono<{ Bindings: Bindings }>();

const PAGE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: #0f0f0f;
    color: #e0e0e0;
    min-height: 100vh;
  }
  .container { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
  h1 { color: #bb86fc; margin-bottom: 0.5rem; font-size: 1.8rem; }
  .subtitle { color: #888; margin-bottom: 2rem; font-size: 0.9rem; }
  .setup-box {
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 1.2rem;
    margin-bottom: 2rem;
  }
  .setup-box h3 { color: #bb86fc; margin-bottom: 0.8rem; font-size: 1rem; }
  .setup-box code {
    background: #0d0d1a;
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    color: #03dac6;
    word-break: break-all;
  }
  .setup-box ol { padding-left: 1.5rem; line-height: 2; }
  .setup-box li { color: #ccc; font-size: 0.9rem; }
  .card-list { display: flex; flex-direction: column; gap: 0.8rem; }
  .card-item {
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 1rem 1.2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: border-color 0.2s;
  }
  .card-item:hover { border-color: #bb86fc; }
  .card-name { font-weight: 600; color: #e0e0e0; font-size: 1.05rem; }
  .card-date { color: #666; font-size: 0.8rem; margin-top: 0.2rem; }
  .card-actions { display: flex; gap: 0.5rem; }
  .btn {
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    border: 1px solid #444;
    background: #252540;
    color: #bb86fc;
    text-decoration: none;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn:hover { background: #333355; border-color: #bb86fc; }
  .btn-primary { background: #bb86fc; color: #0f0f0f; border-color: #bb86fc; font-weight: 600; }
  .btn-primary:hover { background: #d4a5ff; }
  .btn-danger { color: #cf6679; border-color: #cf6679; }
  .btn-danger:hover { background: #3a1a1a; }
  .empty { text-align: center; color: #666; padding: 3rem; font-size: 1.1rem; }
  /* Detail page */
  .back-link { color: #bb86fc; text-decoration: none; font-size: 0.9rem; margin-bottom: 1rem; display: inline-block; }
  .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  .field-section { margin-bottom: 1.2rem; }
  .field-label { color: #bb86fc; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.3rem; }
  .field-content {
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 0.8rem 1rem;
    white-space: pre-wrap;
    font-size: 0.9rem;
    line-height: 1.5;
    max-height: 400px;
    overflow-y: auto;
  }
  .field-empty { color: #555; font-style: italic; }
`;

ui.get('/', async (c) => {
  const indexRaw = await c.env.CARDS.get('cards:index');
  const index: CardIndexEntry[] = indexRaw ? JSON.parse(indexRaw) : [];
  const baseUrl = new URL(c.req.url).origin;

  const cardListHtml = index.length === 0
    ? '<div class="empty">No cards extracted yet. Set your API URL in JanitorAI and start a chat!</div>'
    : index.map(entry => `
        <div class="card-item">
          <div>
            <div class="card-name">${escapeHtml(entry.name)}</div>
            <div class="card-date">${new Date(entry.created_at).toLocaleString()}</div>
          </div>
          <div class="card-actions">
            <a href="/cards/${entry.id}" class="btn btn-primary">View</a>
            <a href="/cards/${entry.id}/json" class="btn">JSON</a>
            <a href="/cards/${entry.id}/png" class="btn">PNG</a>
            <button onclick="deleteCard('${entry.id}')" class="btn btn-danger">Delete</button>
          </div>
        </div>
      `).join('');

  const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sucker - RP Card Extractor</title>
  <style>${PAGE_STYLES}</style>
</head>
<body>
  <div class="container">
    <h1>Sucker</h1>
    <p class="subtitle">RP Character Card Extractor - OpenAI-compatible API endpoint</p>

    <div class="setup-box">
      <h3>Setup Instructions</h3>
      <ol>
        <li>In JanitorAI, go to <strong>API Settings</strong></li>
        <li>Set your API URL to: <code>${baseUrl}/v1</code></li>
        <li>Enter any string as the API key (it's not checked)</li>
        <li>Start a chat with any character - the card will appear here!</li>
      </ol>
    </div>

    <div class="card-list">
      ${cardListHtml}
    </div>
  </div>
  <script>
    async function deleteCard(id) {
      if (!confirm('Delete this card?')) return;
      await fetch('/cards/' + id, { method: 'DELETE' });
      location.reload();
    }
  </script>
</body>
</html>`;

  return c.html(page);
});

ui.get('/cards/:id', async (c) => {
  const id = c.req.param('id');
  const raw = await c.env.CARDS.get(`card:${id}`);
  if (!raw) return c.html('<h1>Card not found</h1>', 404);

  const stored: StoredCard = JSON.parse(raw);
  const data = stored.card.data;

  const fields = [
    ['Name', data.name],
    ['Description', data.description],
    ['Personality', data.personality],
    ['Scenario', data.scenario],
    ['First Message', data.first_mes],
    ['Example Messages', data.mes_example],
    ['System Prompt', data.system_prompt],
    ['Creator Notes', data.creator_notes],
    ['Post History Instructions', data.post_history_instructions],
    ['Creator', data.creator],
    ['Character Version', data.character_version],
  ];

  const fieldsHtml = fields.map(([label, value]) => `
    <div class="field-section">
      <div class="field-label">${label}</div>
      <div class="field-content">${value ? escapeHtml(value as string) : '<span class="field-empty">Not extracted</span>'}</div>
    </div>
  `).join('');

  const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.name)} - Sucker</title>
  <style>${PAGE_STYLES}</style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">&larr; Back to all cards</a>
    <div class="card-header">
      <h1>${escapeHtml(data.name)}</h1>
      <div class="card-actions">
        <a href="/cards/${id}/json" class="btn btn-primary">Download JSON</a>
        <a href="/cards/${id}/png" class="btn">Download PNG</a>
        <a href="/cards/${id}/raw" class="btn">View Raw</a>
      </div>
    </div>
    <div class="card-date" style="margin-bottom: 1.5rem; color: #888;">
      Extracted: ${new Date(stored.created_at).toLocaleString()}
    </div>
    ${fieldsHtml}
  </div>
</body>
</html>`;

  return c.html(page);
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { ui };
