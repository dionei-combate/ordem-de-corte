const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ordem-corte-test-'));
const port = 4197;
process.env.PORT = String(port);
process.env.ORDEM_CORTE_DATA_DIR = dataDirectory;
const { server, db, verifyDatabase } = require('./server.cjs');
const base = `http://127.0.0.1:${port}`;

async function waitUntilReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Servidor de teste não iniciou.');
}

async function json(pathname, options) {
  const response = await fetch(`${base}${pathname}`, options);
  return { response, data: await response.json() };
}

test('protege e preserva o banco durante o ciclo completo', { timeout: 20_000 }, async () => {
  await waitUntilReady();
  const health = await json('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.data.ok, true);

  const invalid = await json('/api/clients', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(invalid.response.status, 400);

  const client = await json('/api/clients', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Cliente de teste' }) });
  assert.equal(client.response.status, 201);
  assert.ok(client.data.id);

  const orderPayload = {
    clientId: client.data.id,
    clientName: 'Cliente de teste',
    productName: 'Produto de teste',
    status: 'Liberada',
    lines: [{ quantity: 3, size: 'M' }, { quantity: -9, size: 'G' }]
  };
  const order = await json('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(orderPayload) });
  assert.equal(order.response.status, 201);
  assert.equal(order.data.number, 1);
  assert.equal(order.data.total, 3);
  assert.equal(order.data.lines[1].quantity, 0);

  const pdf = await fetch(`${base}/api/orders/${order.data.id}/pdf`);
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.match(pdf.headers.get('content-disposition'), /Ordem-de-Corte-001\.pdf/);
  assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdfBytes.length > 2000);
  const printablePdf = await fetch(`${base}/api/orders/${order.data.id}/pdf?print=1`);
  assert.match(printablePdf.headers.get('content-disposition'), /^inline;/);
  assert.equal(Buffer.from(await printablePdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  const printPage = await fetch(`${base}/print/orders/${order.data.id}?external=1`);
  const printHtml = await printPage.text();
  assert.equal(printPage.status, 200);
  assert.match(printPage.headers.get('content-type'), /^text\/html/);
  assert.match(printHtml, /ORDEM DE CORTE/);
  assert.match(printHtml, /CONTROLE DE PRODUÇÃO/);
  assert.match(printHtml, /Cliente de teste/);
  assert.match(printHtml, /Produto de teste/);
  assert.match(printHtml, /window\.print\(\)/);
  assert.doesNotMatch(printHtml, /microsoft-edge:/);
  assert.match(printHtml, /order-print-complete/);

  const missingUpdate = await json('/api/orders/inexistente', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(orderPayload) });
  assert.equal(missingUpdate.response.status, 404);
  verifyDatabase();

  await new Promise(resolve => server.close(resolve));
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  db.close();

  const persisted = new DatabaseSync(path.join(dataDirectory, 'ordem-de-corte.sqlite'), { readOnly: true });
  assert.equal(persisted.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  const saved = JSON.parse(persisted.prepare('SELECT data_json FROM cut_orders').get().data_json);
  assert.equal(saved.id, order.data.id);
  persisted.close();
  assert.ok(fs.readdirSync(path.join(dataDirectory, 'backups')).some(name => name.endsWith('.sqlite')));
});

test.after(() => fs.rmSync(dataDirectory, { recursive: true, force: true }));
