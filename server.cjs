const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { generateOrderPdf } = require('./pdf-generator.cjs');
const { generatePrintPage } = require('./print-page.cjs');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.resolve(process.env.ORDEM_CORTE_DATA_DIR || path.join(ROOT, 'dados'));
const UPLOADS = path.join(DATA, 'imagens');
const BACKUPS = path.join(DATA, 'backups');
const DB_FILE = path.join(DATA, 'ordem-de-corte.sqlite');
const PORT = Number(process.env.PORT || 4180);
const HOST = process.env.HOST || '127.0.0.1';
const JSON_LIMIT = 15 * 1024 * 1024;
const ALLOWED_ENTITIES = new Set(['clients', 'products', 'models', 'details', 'colors', 'printTypes', 'materials', 'workshops']);
const ALLOWED_STATUSES = new Set(['Aberta', 'Impressa']);
const QUOTE_STATUSES = new Set(['Em elaboração', 'Em análise', 'Aprovado', 'Rejeitado', 'Cancelado', 'Expirado', 'Faturado']);
const MIME_EXTENSIONS = new Map([['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']]);

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(BACKUPS, { recursive: true });
const databaseWasNew = !fs.existsSync(DB_FILE);
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;
  PRAGMA synchronous=FULL;
  PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS entities(
    type TEXT NOT NULL,
    id TEXT NOT NULL,
    data_json TEXT NOT NULL CHECK(json_valid(data_json)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(type,id)
  );
  CREATE TABLE IF NOT EXISTS cut_orders(
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE CHECK(number > 0),
    status TEXT NOT NULL DEFAULT 'Aberta',
    data_json TEXT NOT NULL CHECK(json_valid(data_json)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quotes(
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE CHECK(number > 0),
    status TEXT NOT NULL DEFAULT 'Em elaboração',
    data_json TEXT NOT NULL CHECK(json_valid(data_json)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON cut_orders(status);
  CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
`);

const now = () => new Date().toISOString();
const asString = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseJson(value, context) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('objeto esperado');
    return parsed;
  } catch (error) {
    throw new Error(`Registro inválido no banco (${context}): ${error.message}`);
  }
}

function verifyDatabase() {
  const result = db.prepare('PRAGMA quick_check').get();
  if (result.quick_check !== 'ok') throw new Error(`Falha de integridade do SQLite: ${result.quick_check}`);
  for (const row of db.prepare('SELECT type,id,data_json FROM entities').all()) parseJson(row.data_json, `${row.type}/${row.id}`);
  for (const row of db.prepare('SELECT id,data_json FROM cut_orders').all()) parseJson(row.data_json, `orders/${row.id}`);
  for (const row of db.prepare('SELECT id,data_json FROM quotes').all()) parseJson(row.data_json, `quotes/${row.id}`);
}

function cleanEntity(data) {
  if (!data || Array.isArray(data) || typeof data !== 'object') throw httpError(400, 'Cadastro inválido.');
  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) continue;
    clean[key] = typeof value === 'string' ? value.slice(0, key === 'image' ? 1000 : 5000) : value;
  }
  clean.id = asString(clean.id || crypto.randomUUID(), 120);
  if (!clean.id) throw httpError(400, 'Identificador inválido.');
  if (!asString(clean.name, 200)) throw httpError(400, 'Informe o nome do cadastro.');
  clean.name = asString(clean.name, 200);
  return clean;
}

function cleanOrder(data) {
  if (!data || Array.isArray(data) || typeof data !== 'object') throw httpError(400, 'Ordem inválida.');
  const clean = {};
  const stringFields = ['clientId', 'clientName', 'productId', 'productName', 'modelId', 'modelName', 'colorId', 'colorName', 'detailId', 'detailName', 'materialId', 'materialName', 'sleeveName', 'sleeveColorId', 'sleeveColorName', 'collarName', 'collarColorId', 'collarColorName', 'yokeName', 'yokeColorId', 'yokeColorName', 'printTypeId', 'printTypeName', 'artName', 'pocketName', 'workshopId', 'workshopName', 'purchaseOrder', 'issueDate', 'deliveryDate', 'notes'];
  for (const field of stringFields) clean[field] = asString(data[field], field === 'notes' ? 5000 : 500);
  clean.status = ALLOWED_STATUSES.has(data.status) ? data.status : data.status === 'Impressa' ? 'Impressa' : 'Aberta';
  clean.lines = Array.isArray(data.lines) ? data.lines.slice(0, 200).map(line => ({
    quantity: Math.max(0, Math.min(999999, Number.parseInt(line?.quantity, 10) || 0)),
    size: asString(line?.size, 80)
  })) : [];
  if (!clean.lines.length) clean.lines = [{ quantity: 0, size: '' }];
  clean.total = clean.lines.reduce((sum, line) => sum + line.quantity, 0);
  if (data.productSnapshot && !Array.isArray(data.productSnapshot) && typeof data.productSnapshot === 'object') {
    clean.productSnapshot = cleanEntity({ ...data.productSnapshot, name: data.productSnapshot.name || clean.productName || 'Produto' });
  } else clean.productSnapshot = {};
  return clean;
}

function cleanQuote(data) {
  if (!data || Array.isArray(data) || typeof data !== 'object') throw httpError(400, 'Orçamento inválido.');
  const clean = {};
  const stringFields = ['clientId', 'clientName', 'clientDocument', 'clientPhone', 'clientEmail', 'clientAddress', 'clientNeighborhood', 'clientCity', 'clientState', 'clientZip', 'issueDate', 'validUntil', 'notes'];
  for (const field of stringFields) clean[field] = asString(data[field], field === 'notes' ? 5000 : 500);
  clean.status = QUOTE_STATUSES.has(data.status) ? data.status : 'Em elaboração';
  const discountValue = data.discount ?? data.discountValue ?? 0;
  const shippingValue = data.shipping ?? data.freight ?? data.shippingCost ?? 0;
  clean.discount = Math.max(0, Number(discountValue) || 0);
  clean.shipping = Math.max(0, Number(shippingValue) || 0);
  clean.items = Array.isArray(data.items) ? data.items.slice(0, 100).map(item => {
    const quantity = Math.max(0, Math.min(999999, Number(item?.quantity) || 0));
    const unitPrice = Math.max(0, Math.min(9999999, Number(item?.unitPrice) || 0));
    const product = item?.productSnapshot && !Array.isArray(item.productSnapshot) && typeof item.productSnapshot === 'object'
      ? cleanEntity({ ...item.productSnapshot, name: item.productSnapshot.name || item.productName || 'Produto' })
      : {};
    return {
      productId: asString(item?.productId, 120),
      productName: asString(item?.productName, 500),
      modelName: asString(item?.modelName, 500),
      materialName: asString(item?.materialName, 500),
      colorId: asString(item?.colorId, 120),
      colorName: asString(item?.colorName, 500),
      sleeveName: asString(item?.sleeveName, 500),
      sleeveColorId: asString(item?.sleeveColorId, 120),
      sleeveColorName: asString(item?.sleeveColorName, 500),
      collarName: asString(item?.collarName, 500),
      collarColorId: asString(item?.collarColorId, 120),
      collarColorName: asString(item?.collarColorName, 500),
      yokeName: asString(item?.yokeName, 500),
      yokeColorId: asString(item?.yokeColorId, 120),
      yokeColorName: asString(item?.yokeColorName, 500),
      pocketName: asString(item?.pocketName, 500),
      printTypeId: asString(item?.printTypeId, 120),
      printTypeName: asString(item?.printTypeName, 500),
      detailName: asString(item?.detailName, 1000),
      size: asString(item?.size, 80),
      quantity,
      unitPrice,
      lineTotal: Math.round(quantity * unitPrice * 100) / 100,
      productSnapshot: product
    };
  }) : [];
  if (!clean.items.length) clean.items = [];
  clean.subtotal = Math.round(clean.items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  clean.total = Math.max(0, Math.round((clean.subtotal + clean.shipping - clean.discount) * 100) / 100);
  return clean;
}

function normalizeOrder(data) {
  const order = parseJson(data.data_json ?? data, data.id ? `orders/${data.id}` : 'order');
  order.status = order.status === 'Impressa' ? 'Impressa' : 'Aberta';
  return order;
}

function normalizeQuote(data) {
  const quote = parseJson(data.data_json ?? data, data.id ? `quotes/${data.id}` : 'quote');
  quote.status = QUOTE_STATUSES.has(quote.status) ? quote.status : 'Em elaboração';
  return quote;
}

function orderFromQuote(quote, item) {
  const product = item.productSnapshot && typeof item.productSnapshot === 'object' ? item.productSnapshot : {};
  return cleanOrder({
    clientId: quote.clientId,
    clientName: quote.clientName,
    productId: item.productId,
    productName: item.productName,
    modelName: item.modelName,
    materialName: item.materialName,
    colorId: item.colorId,
    colorName: item.colorName,
    sleeveName: item.sleeveName,
    sleeveColorId: item.sleeveColorId,
    sleeveColorName: item.sleeveColorName,
    collarName: item.collarName,
    collarColorId: item.collarColorId,
    collarColorName: item.collarColorName,
    yokeName: item.yokeName,
    yokeColorId: item.yokeColorId,
    yokeColorName: item.yokeColorName,
    pocketName: item.pocketName,
    printTypeId: item.printTypeId,
    printTypeName: item.printTypeName,
    detailName: item.detailName,
    purchaseOrder: `Orçamento ${String(quote.number).padStart(3, '0')}`,
    issueDate: quote.issueDate,
    notes: quote.notes,
    productSnapshot: product,
    lines: [{ quantity: item.quantity, size: item.size }]
  });
}

function send(res, data, status = 200, type = 'application/json; charset=utf-8', extraHeaders = {}) {
  if (res.writableEnded || res.destroyed) return;
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(type.startsWith('application/json') ? JSON.stringify(data) : String(data));
  res.writeHead(status, {
    'content-type': type,
    'content-length': payload.length,
    'cache-control': type.startsWith('text/html') ? 'no-cache' : 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders
  });
  res.end(payload);
}

function readBody(req, limit = JSON_LIMIT) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        finish(reject, httpError(413, 'Conteúdo acima do limite permitido.'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      try { finish(resolve, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { finish(reject, httpError(400, 'Conteúdo JSON inválido.')); }
    });
    req.on('aborted', () => finish(reject, httpError(400, 'Envio interrompido.')));
    req.on('error', error => finish(reject, error));
  });
}

function list(type) {
  return db.prepare('SELECT id,data_json FROM entities WHERE type=? ORDER BY updated_at DESC').all(type)
    .map(row => parseJson(row.data_json, `${type}/${row.id}`));
}

function upsert(type, input, expectedId = '') {
  const data = cleanEntity(input);
  if (expectedId) data.id = expectedId;
  const timestamp = now();
  db.prepare(`INSERT INTO entities(type,id,data_json,created_at,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(type,id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at`)
    .run(type, data.id, JSON.stringify(data), timestamp, timestamp);
  return data;
}

function transaction(work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

function seedNewDatabase() {
  if (!databaseWasNew) return;
  transaction(() => {
    upsert('clients', { id: 'cli-1', name: 'Cliente demonstração', document: '', phone: '', email: '' });
    upsert('workshops', { id: 'fac-1', name: 'Produção interna', contact: '', phone: '' });
    upsert('materials', { id: 'mat-1', name: 'Malha penteada', kind: 'Tecido', unit: 'kg' });
    upsert('products', { id: 'prod-1', name: 'Camiseta Tradicional', image: '' });
  });
}

function safePath(root, relative) {
  const file = path.resolve(root, relative);
  const relation = path.relative(root, file);
  return relation && !relation.startsWith('..') && !path.isAbsolute(relation) ? file : null;
}

function backupDatabase() {
  const date = new Date().toISOString().slice(0, 10);
  const target = path.join(BACKUPS, `ordem-de-corte-${date}.sqlite`);
  if (fs.existsSync(target)) return target;
  db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  return target;
}

verifyDatabase();
seedNewDatabase();
backupDatabase();

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const resource = parts[1];
  const id = asString(parts[2] ? decodeURIComponent(parts[2]) : '', 120);

  if (url.pathname === '/api/health' && req.method === 'GET') {
    const check = db.prepare('PRAGMA quick_check').get().quick_check;
    return send(res, { ok: check === 'ok', database: check, time: now() }, check === 'ok' ? 200 : 503);
  }

  if (ALLOWED_ENTITIES.has(resource)) {
    if (req.method === 'GET' && !id) return send(res, list(resource));
    if (req.method === 'POST' && !id) return send(res, upsert(resource, await readBody(req)), 201);
    if (req.method === 'PUT' && id) {
      const exists = db.prepare('SELECT 1 FROM entities WHERE type=? AND id=?').get(resource, id);
      if (!exists) return send(res, { error: 'Cadastro não encontrado.' }, 404);
      return send(res, upsert(resource, await readBody(req), id));
    }
    if (req.method === 'DELETE' && id) {
      const result = db.prepare('DELETE FROM entities WHERE type=? AND id=?').run(resource, id);
      return result.changes ? send(res, { deleted: true }) : send(res, { error: 'Cadastro não encontrado.' }, 404);
    }
  }

  if (resource === 'orders') {
    if (req.method === 'GET' && !id) {
      const rows = db.prepare('SELECT id,data_json FROM cut_orders ORDER BY number DESC').all();
      return send(res, rows.map(row => normalizeOrder(row)));
    }
    if (req.method === 'GET' && id && parts[3] === 'pdf') {
      const row = db.prepare('SELECT number,data_json FROM cut_orders WHERE id=?').get(id);
      if (!row) return send(res, { error: 'Ordem não encontrada.' }, 404);
      const order = normalizeOrder({ id, data_json: row.data_json });
      let pdf;
      try {
        pdf = await generateOrderPdf(order, UPLOADS);
      } catch (error) {
        console.error('Falha ao gerar PDF:', error);
        throw httpError(503, 'Não foi possível gerar o PDF neste computador.');
      }
      const filename = `Ordem-de-Corte-${String(row.number).padStart(3, '0')}.pdf`;
      const disposition = url.searchParams.get('print') === '1' ? 'inline' : 'attachment';
      return send(res, pdf, 200, 'application/pdf', { 'content-disposition': `${disposition}; filename="${filename}"` });
    }
    if (req.method === 'POST' && !id) {
      const input = cleanOrder(await readBody(req));
      const create = () => transaction(() => {
        const number = db.prepare('SELECT COALESCE(MAX(number),0)+1 AS next FROM cut_orders').get().next;
        const timestamp = now();
        const data = { ...input, id: crypto.randomUUID(), number, createdAt: timestamp, updatedAt: timestamp };
        db.prepare('INSERT INTO cut_orders(id,number,status,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?)')
          .run(data.id, number, data.status, JSON.stringify(data), timestamp, timestamp);
        return data;
      });
      return send(res, create(), 201);
    }
    if (req.method === 'PUT' && id) {
      const input = cleanOrder(await readBody(req));
      const old = db.prepare('SELECT number,created_at FROM cut_orders WHERE id=?').get(id);
      if (!old) return send(res, { error: 'Ordem não encontrada.' }, 404);
      const data = { ...input, id, number: old.number, createdAt: old.created_at, updatedAt: now() };
      db.prepare('UPDATE cut_orders SET status=?,data_json=?,updated_at=? WHERE id=?')
        .run(data.status, JSON.stringify(data), data.updatedAt, id);
      return send(res, data);
    }
    if (req.method === 'DELETE' && id) {
      const result = db.prepare('DELETE FROM cut_orders WHERE id=?').run(id);
      return result.changes ? send(res, { deleted: true }) : send(res, { error: 'Ordem não encontrada.' }, 404);
    }
  }

  if (resource === 'quotes') {
    if (req.method === 'GET' && !id) {
      const rows = db.prepare('SELECT id,data_json FROM quotes ORDER BY number DESC').all();
      return send(res, rows.map(row => normalizeQuote(row)));
    }
    if (req.method === 'POST' && !id) {
      const input = cleanQuote(await readBody(req));
      const create = () => transaction(() => {
        const number = db.prepare('SELECT COALESCE(MAX(number),0)+1 AS next FROM quotes').get().next;
        const timestamp = now();
        const data = { ...input, id: crypto.randomUUID(), number, createdAt: timestamp, updatedAt: timestamp };
        db.prepare('INSERT INTO quotes(id,number,status,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?)')
          .run(data.id, number, data.status, JSON.stringify(data), timestamp, timestamp);
        return data;
      });
      return send(res, create(), 201);
    }
    if (req.method === 'PUT' && id) {
      const input = cleanQuote(await readBody(req));
      const old = db.prepare('SELECT number,created_at FROM quotes WHERE id=?').get(id);
      if (!old) return send(res, { error: 'Orçamento não encontrado.' }, 404);
      const data = { ...input, id, number: old.number, createdAt: old.created_at, updatedAt: now() };
      db.prepare('UPDATE quotes SET status=?,data_json=?,updated_at=? WHERE id=?')
        .run(data.status, JSON.stringify(data), data.updatedAt, id);
      return send(res, data);
    }
    if (req.method === 'POST' && id && parts[3] === 'convert') {
      const row = db.prepare('SELECT number,data_json FROM quotes WHERE id=?').get(id);
      if (!row) return send(res, { error: 'Orçamento não encontrado.' }, 404);
      const quote = normalizeQuote({ id, data_json: row.data_json });
      if (quote.status !== 'Aprovado') return send(res, { error: 'Apenas orçamentos aprovados podem virar Ordem de Corte.' }, 400);
      if (!quote.items?.length) return send(res, { error: 'Inclua pelo menos um item no orçamento antes de converter.' }, 400);
      const created = transaction(() => {
        const timestamp = now();
        const orders = quote.items.filter(item => item.quantity > 0).map(item => {
          const number = db.prepare('SELECT COALESCE(MAX(number),0)+1 AS next FROM cut_orders').get().next;
          const input = orderFromQuote(quote, item);
          const data = { ...input, id: crypto.randomUUID(), number, createdAt: timestamp, updatedAt: timestamp };
          db.prepare('INSERT INTO cut_orders(id,number,status,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?)')
            .run(data.id, number, data.status, JSON.stringify(data), timestamp, timestamp);
          return data;
        });
        const updatedQuote = { ...quote, status: 'Faturado', convertedAt: timestamp, orderIds: orders.map(order => order.id), updatedAt: timestamp };
        db.prepare('UPDATE quotes SET status=?,data_json=?,updated_at=? WHERE id=?')
          .run(updatedQuote.status, JSON.stringify(updatedQuote), timestamp, id);
        return { quote: updatedQuote, orders };
      });
      return send(res, created, 201);
    }
    if (req.method === 'DELETE' && id) {
      const result = db.prepare('DELETE FROM quotes WHERE id=?').run(id);
      return result.changes ? send(res, { deleted: true }) : send(res, { error: 'Orçamento não encontrado.' }, 404);
    }
  }

  if (resource === 'upload' && req.method === 'POST' && !id) {
    const data = await readBody(req);
    const match = asString(data.data, JSON_LIMIT).match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return send(res, { error: 'Imagem inválida. Use PNG, JPG ou WebP.' }, 400);
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) return send(res, { error: 'A imagem deve ter no máximo 8 MB.' }, 413);
    const name = `${crypto.randomUUID()}.${MIME_EXTENSIONS.get(match[1])}`;
    fs.writeFileSync(path.join(UPLOADS, name), buffer, { flag: 'wx' });
    return send(res, { url: `/uploads/${name}` }, 201);
  }

  return send(res, { error: 'Rota não encontrada.' }, 404);
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname.startsWith('/print/orders/') && req.method === 'GET') {
      const id = asString(decodeURIComponent(url.pathname.slice('/print/orders/'.length)), 120);
      const row = db.prepare('SELECT data_json FROM cut_orders WHERE id=?').get(id);
      if (!row) return send(res, '<h1>Ordem não encontrada.</h1>', 404, 'text/html; charset=utf-8');
      return send(res, generatePrintPage(normalizeOrder({ id, data_json: row.data_json })), 200, 'text/html; charset=utf-8');
    }
    const isUpload = url.pathname.startsWith('/uploads/');
    const root = isUpload ? UPLOADS : PUBLIC;
    const relative = isUpload ? decodeURIComponent(url.pathname.slice(9)) : (url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    const file = safePath(root, relative);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, { error: 'Arquivo não encontrado.' }, 404);
    return send(res, fs.readFileSync(file), 200, types[path.extname(file).toLowerCase()] || 'application/octet-stream');
  } catch (error) {
    if (!error.status || error.status >= 500) console.error(`[${now()}] ${req.method} ${req.url}:`, error);
    return send(res, { error: error.status && error.status < 500 ? error.message : 'Erro interno. Seus dados não foram alterados.' }, error.status || 500);
  }
});

server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 1000;
server.on('clientError', (error, socket) => {
  console.warn(`[${now()}] Conexão inválida: ${error.message}`);
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  const force = setTimeout(() => process.exit(code || 1), 5000);
  force.unref();
  server.close(() => {
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (error) { console.error('Falha ao consolidar o banco:', error); }
    try { db.close(); } catch {}
    clearTimeout(force);
    process.exit(code);
  });
}

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} já está em uso. O aplicativo provavelmente já está aberto.`);
    shutdown(2);
  } else {
    console.error('Falha do servidor:', error);
    shutdown(1);
  }
});
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('uncaughtException', error => { console.error('Erro inesperado:', error); shutdown(1); });
process.on('unhandledRejection', error => { console.error('Falha assíncrona:', error); });

server.listen(PORT, HOST, () => console.log(`Ordem de Corte disponível em http://${HOST}:${PORT}`));

module.exports = { server, db, backupDatabase, verifyDatabase };
