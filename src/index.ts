import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { completions } from './routes/completions';
import { cards } from './routes/cards';
import { ui } from './routes/ui';
import { dev } from './routes/dev';

type Bindings = { CARDS: KVNamespace };

const app = new Hono<{ Bindings: Bindings }>();

// CORS - JanitorAI needs this
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check / OpenAI models endpoint (some clients check this)
app.get('/v1/models', (c) => {
  return c.json({
    object: 'list',
    data: [
      {
        id: 'card-extractor',
        object: 'model',
        created: 1700000000,
        owned_by: 'sucker',
      },
    ],
  });
});

// Mount routes
app.route('/', completions);
app.route('/', cards);
app.route('/', ui);
app.route('/', dev);

export default app;
