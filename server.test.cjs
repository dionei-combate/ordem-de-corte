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
  const completeClient = await json(`/api/clients/${client.data.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...client.data, address: 'Rua Um', neighborhood: 'Centro', city: 'São José', state: 'SC', zip: '88000-000' }) });
  assert.equal(completeClient.response.status, 200);
  assert.equal(completeClient.data.city, 'São José');

  const quote = await json('/api/quotes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    clientId: client.data.id,
    clientName: 'Cliente de teste',
    status: 'Aprovado',
    issueDate: '2026-10-11',
    validUntil: '2026-10-30',
    items: [{ productName: 'Produto de orçamento', modelName: 'Modelo A', quantity: 2, size: 'XXGG3', unitPrice: 15.5 }],
    shipping: 7,
    discount: 3,
    paymentTerms: '50% na aprovação e 50% na entrega',
    deliveryTime: '10 dias úteis',
    sellerName: 'Responsável comercial'
  }) });
  assert.equal(quote.response.status, 201);
    assert.equal(quote.data.number, 1);
    assert.equal(quote.data.shipping, 7);
    assert.equal(quote.data.discount, 3);
    assert.equal(quote.data.paymentTerms, '50% na aprovação e 50% na entrega');
    assert.equal(quote.data.deliveryTime, '10 dias úteis');
    assert.equal(quote.data.sellerName, 'Responsável comercial');
    assert.equal(quote.data.subtotal, 31);
    assert.equal(quote.data.total, 35);
    const updatedQuote = await json(`/api/quotes/${quote.data.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...quote.data, shipping: 12.5, discount: 4.5 }) });
    assert.equal(updatedQuote.response.status, 200);
    assert.equal(updatedQuote.data.shipping, 12.5);
    assert.equal(updatedQuote.data.discount, 4.5);
    assert.equal(updatedQuote.data.total, 39);
    const listedQuotes = await json('/api/quotes');
    assert.equal(listedQuotes.data[0].shipping, 12.5);
    assert.equal(listedQuotes.data[0].discount, 4.5);
  const quotePdf = await fetch(`${base}/api/quotes/${quote.data.id}/pdf`);
  const quotePdfBytes = Buffer.from(await quotePdf.arrayBuffer());
  assert.equal(quotePdf.status, 200);
  assert.equal(quotePdf.headers.get('content-type'), 'application/pdf');
  assert.match(quotePdf.headers.get('content-disposition'), /Orcamento-001\.pdf/);
  assert.equal(quotePdfBytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(quotePdfBytes.length > 2000);
  const quotePrint = await fetch(`${base}/print/quotes/${quote.data.id}?external=1`);
  const quotePrintHtml = await quotePrint.text();
  assert.equal(quotePrint.status, 200);
  assert.match(quotePrint.headers.get('content-type'), /^text\/html/);
  assert.match(quotePrintHtml, /PROPOSTA COMERCIAL/);
  assert.match(quotePrintHtml, /Cliente de teste/);
  assert.match(quotePrintHtml, /Total final/);
  assert.match(quotePrintHtml, /window\.print\(\)/);
  const converted = await json(`/api/quotes/${quote.data.id}/convert`, { method: 'POST' });
  assert.equal(converted.response.status, 201);
  assert.equal(converted.data.orders.length, 1);
  assert.equal(converted.data.quote.status, 'Gerada OC');
  assert.equal(converted.data.orders[0].purchaseOrder, 'Orçamento 001');
  assert.equal(converted.data.orders[0].status, 'Gerada OC');

  const orderPayload = {
    clientId: client.data.id,
    clientName: 'Cliente de teste',
    productName: 'Produto de teste',
    status: 'Liberada',
    lines: [{ quantity: 3, size: 'M' }, { quantity: -9, size: 'G' }]
  };
  const order = await json('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(orderPayload) });
  assert.equal(order.response.status, 201);
  assert.equal(order.data.number, 2);
  assert.equal(order.data.total, 3);
  assert.equal(order.data.lines[1].quantity, 0);

  const pdf = await fetch(`${base}/api/orders/${order.data.id}/pdf`);
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.match(pdf.headers.get('content-disposition'), /Ordem-de-Corte-002\.pdf/);
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
  const saved = JSON.parse(persisted.prepare('SELECT data_json FROM cut_orders WHERE id=?').get(order.data.id).data_json);
  assert.equal(saved.id, order.data.id);
  persisted.close();
  assert.ok(fs.readdirSync(path.join(dataDirectory, 'backups')).some(name => name.endsWith('.sqlite')));
});

test.after(() => fs.rmSync(dataDirectory, { recursive: true, force: true }));
