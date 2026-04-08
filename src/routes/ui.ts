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
  .card-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
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
  .back-link { color: #bb86fc; text-decoration: none; font-size: 0.9rem; margin-bottom: 1rem; display: inline-block; }
  .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
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
  /* Tabs */
  .tabs { display: flex; gap: 0; margin-bottom: 1.5rem; border-bottom: 2px solid #333; }
  .tab {
    padding: 0.6rem 1.2rem;
    cursor: pointer;
    color: #888;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: all 0.2s;
    font-size: 0.9rem;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
    font-family: inherit;
  }
  .tab:hover { color: #e0e0e0; }
  .tab.active { color: #bb86fc; border-bottom-color: #bb86fc; }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
  /* Lorebook */
  .lore-entry {
    background: #111128;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 0.8rem 1rem;
    margin-bottom: 0.8rem;
  }
  .lore-entry-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  .lore-key { color: #03dac6; font-weight: 600; font-size: 0.85rem; }
  .lore-order { color: #666; font-size: 0.75rem; }
  .lore-content { white-space: pre-wrap; font-size: 0.85rem; line-height: 1.4; color: #ccc; }
  /* Download box */
  .download-box {
    background: #1a1a2e;
    border: 1px solid #bb86fc;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }
  .download-box h3 { color: #bb86fc; margin-bottom: 0.8rem; font-size: 0.95rem; }
  .download-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .download-label { color: #888; font-size: 0.8rem; margin-bottom: 0.3rem; }
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
            <a href="/cards/${entry.id}/png" class="btn">PNG</a>
            <a href="/cards/${entry.id}/json" class="btn">JSON</a>
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
  const lorebook = data.extensions?.lorebook as {
    entries: Record<string, { key: string[]; content: string; comment: string; insertion_order: number }>;
  } | undefined;
  const hasLorebook = lorebook && Object.keys(lorebook.entries || {}).length > 0;

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
  ];

  const fieldsHtml = fields.map(([label, value]) => `
    <div class="field-section">
      <div class="field-label">${label}</div>
      <div class="field-content">${value ? escapeHtml(value as string) : '<span class="field-empty">Not extracted</span>'}</div>
    </div>
  `).join('');

  let lorebookHtml = '';
  if (hasLorebook) {
    const entries = Object.values(lorebook.entries);
    lorebookHtml = entries.map(entry => `
      <div class="lore-entry">
        <div class="lore-entry-header">
          <span class="lore-key">${escapeHtml(entry.key?.join(', ') || entry.comment || 'Entry')}</span>
          <span class="lore-order">#${entry.insertion_order}</span>
        </div>
        <div class="lore-content">${escapeHtml(entry.content)}</div>
      </div>
    `).join('');
  }

  const lorebookCount = hasLorebook ? Object.keys(lorebook.entries).length : 0;

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
      <div>
        <h1>${escapeHtml(data.name)}</h1>
        <div class="card-date" style="color: #888; margin-top: 0.3rem;">
          Extracted: ${new Date(stored.created_at).toLocaleString()}
        </div>
      </div>
    </div>

    <div class="download-box">
      <h3>Download</h3>
      <div class="download-label">With lorebook${hasLorebook ? ' (' + lorebookCount + ' entries)' : ' (none found)'}:</div>
      <div class="download-row">
        <a href="/cards/${id}/png" class="btn btn-primary"${!hasLorebook ? ' style="opacity:0.5"' : ''}>PNG + Lorebook</a>
        <a href="/cards/${id}/json" class="btn"${!hasLorebook ? ' style="opacity:0.5"' : ''}>JSON + Lorebook</a>
      </div>
      <div class="download-label" style="margin-top: 0.5rem;">Without lorebook:</div>
      <div class="download-row">
        <a href="/cards/${id}/png?lorebook=false" class="btn btn-primary">PNG Only</a>
        <a href="/cards/${id}/json?lorebook=false" class="btn">JSON Only</a>
      </div>
      <div class="download-row" style="margin-top: 0.5rem;">
        <a href="/cards/${id}/raw" class="btn" style="font-size:0.75rem;">View Raw Messages</a>
        <a href="/dev" class="btn" style="font-size:0.75rem;">Dev Debug</a>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" onclick="switchTab('fields')">Card Fields</button>
      <button class="tab" onclick="switchTab('lorebook')">Lorebook${hasLorebook ? ' (' + lorebookCount + ')' : ''}</button>
    </div>

    <div id="tab-fields" class="tab-content active">
      ${fieldsHtml}
    </div>

    <div id="tab-lorebook" class="tab-content">
      ${hasLorebook
        ? lorebookHtml
        : '<div class="empty" style="padding:2rem;">No lorebook entries detected in this card.</div>'}
    </div>
  </div>
  <script>
    function switchTab(name) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.getElementById('tab-' + name).classList.add('active');
      event.target.classList.add('active');
    }
  </script>
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
