import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const app = express();
app.use(express.json());

const AUTH_USER = 'AdminFlowers';
const AUTH_PASS = 'LockyTeam123';
const AUTH_TOKEN = 'token-' + Math.random().toString(36).substr(2); // Simple runtime token

// Bot State for two shops
const bots = {
  shop1: {
    isRunning: false,
    interval: null,
    logs: [],
    config: {
      clientId: '2795090',
      apiKey: '78e9d3ca-3b3d-40ec-ba72-1425b93aab09',
      intervalSec: 30,
    }
  },
  shop2: {
    isRunning: false,
    interval: null,
    logs: [],
    config: {
      clientId: '',
      apiKey: '',
      intervalSec: 30,
    }
  }
};

function addLog(shopId, msg) {
  const time = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Baku' });
  const logMsg = `[${time}] ${msg}`;
  console.log(`[${shopId}] ${logMsg}`);
  bots[shopId].logs.push(logMsg);
  if (bots[shopId].logs.length > 1000) bots[shopId].logs.shift();
}

async function getAwaitingPostings(shopId) {
  const config = bots[shopId].config;
  const url = 'https://api-seller.ozon.ru/v3/posting/fbs/unfulfilled/list';
  const now = new Date();
  const dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dateTo = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    dir: 'asc',
    filter: {
      status: 'awaiting_packaging',
      cutoff_from: dateFrom,
      cutoff_to: dateTo,
    },
    limit: 50,
    offset: 0,
    with: {
      analytics_data: false,
      financial_data: false,
      translit: false,
    },
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Client-Id': config.clientId,
        'Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.result?.postings || [];
    } else {
      const text = await resp.text();
      addLog(shopId, `Ошибка ${resp.status}: ${text}`);
      return [];
    }
  } catch (e) {
    addLog(shopId, `Ошибка запроса: ${e.message}`);
    return [];
  }
}

async function shipPosting(shopId, posting) {
  const config = bots[shopId].config;
  const url = 'https://api-seller.ozon.ru/v4/posting/fbs/ship';
  const postingNumber = posting.posting_number;
  const products = posting.products || [];

  const packageProducts = products.map((p) => ({
    product_id: p.sku || p.product_id,
    quantity: p.quantity,
  }));

  const payload = {
    posting_number: postingNumber,
    packages: [{ products: packageProducts }],
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Client-Id': config.clientId,
        'Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      addLog(shopId, `✅ Заказ ${postingNumber} собран!`);
      return true;
    } else {
      const text = await resp.text();
      addLog(shopId, `❌ Ошибка сборки ${postingNumber}: ${text}`);
      return false;
    }
  } catch (e) {
    addLog(shopId, `❌ Ошибка сети: ${e.message}`);
    return false;
  }
}

async function botTick(shopId) {
  addLog(shopId, '🔍 Проверка новых заказов...');
  const postings = await getAwaitingPostings(shopId);
  
  if (postings && postings.length > 0) {
    addLog(shopId, `Найдено заказов: ${postings.length}`);
    for (const p of postings) {
      await shipPosting(shopId, p);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } else {
    addLog(shopId, 'Новых заказов для сборки нет.');
  }
}

function startBot(shopId) {
  if (bots[shopId].isRunning) return;
  bots[shopId].isRunning = true;
  addLog(shopId, '🚀 БОТ OZON ЗАПУЩЕН');
  botTick(shopId);
  bots[shopId].interval = setInterval(() => botTick(shopId), bots[shopId].config.intervalSec * 1000);
}

function stopBot(shopId) {
  if (!bots[shopId].isRunning) return;
  bots[shopId].isRunning = false;
  if (bots[shopId].interval) clearInterval(bots[shopId].interval);
  bots[shopId].interval = null;
  addLog(shopId, '🛑 БОТ OZON ОСТАНОВЛЕН');
}

// Auth Route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === AUTH_USER && password === AUTH_PASS) {
    res.json({ success: true, token: AUTH_TOKEN });
  } else {
    res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
  }
});

// Auth Middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization;
  if (token === AUTH_TOKEN) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

app.use('/api/bot', requireAuth);

// API Routes
app.get('/api/bot/status', (req, res) => {
  res.json({
    shop1: { isRunning: bots.shop1.isRunning, config: bots.shop1.config },
    shop2: { isRunning: bots.shop2.isRunning, config: bots.shop2.config }
  });
});

app.get('/api/bot/logs', (req, res) => {
  res.json({
    shop1: bots.shop1.logs,
    shop2: bots.shop2.logs
  });
});

app.post('/api/bot/:shopId/start', (req, res) => {
  const shopId = req.params.shopId;
  if (bots[shopId]) startBot(shopId);
  res.json({ success: true });
});

app.post('/api/bot/:shopId/stop', (req, res) => {
  const shopId = req.params.shopId;
  if (bots[shopId]) stopBot(shopId);
  res.json({ success: true });
});

app.post('/api/bot/:shopId/config', (req, res) => {
  const shopId = req.params.shopId;
  if (!bots[shopId]) return res.status(404).json({ error: 'Shop not found' });

  const { clientId, apiKey, intervalSec } = req.body;
  if (clientId !== undefined) bots[shopId].config.clientId = clientId;
  if (apiKey !== undefined) bots[shopId].config.apiKey = apiKey;
  if (intervalSec !== undefined) bots[shopId].config.intervalSec = intervalSec;
  
  if (bots[shopId].isRunning) {
    stopBot(shopId);
    startBot(shopId);
  }
  res.json({ success: true, config: bots[shopId].config });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
