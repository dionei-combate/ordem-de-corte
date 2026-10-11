const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const C = {
  navy: rgb(36 / 255, 56 / 255, 97 / 255),
  ink: rgb(32 / 255, 36 / 255, 43 / 255),
  muted: rgb(64 / 255, 83 / 255, 113 / 255),
  line: rgb(89 / 255, 96 / 255, 108 / 255),
  softLine: rgb(154 / 255, 160 / 255, 169 / 255),
  pale: rgb(240 / 255, 245 / 255, 252 / 255),
  white: rgb(1, 1, 1)
};

const clean = (value, fallback = '-') => String(value ?? '').trim() || fallback;

function stripAccents(value) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function joined(...parts) {
  return parts.map(part => String(part ?? '').trim()).filter(Boolean).join(' / ');
}

function productOptions(order, key) {
  const aliases = { collars: ['collars', 'golas', 'gola', 'collar'], yokes: ['yokes', 'palas', 'pala', 'yoke'] };
  const keys = aliases[key] || [key];
  for (const optionKey of keys) {
    if (Array.isArray(order.productSnapshot?.[optionKey])) return order.productSnapshot[optionKey].map(item => String(item ?? '').trim()).filter(Boolean);
  }
  const names = { models: 'modelName', materials: 'materialName', sleeves: 'sleeveName', collars: 'collarName', yokes: 'yokeName', pockets: 'pocketName' };
  return names[key] && order[names[key]] ? [order[names[key]]] : [];
}

function formatDate(input) {
  if (!input) return '-';
  const parts = String(input).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return stripAccents(input);
}

function fitText(font, value, maxWidth, initialSize = 9.5, minSize = 6.2) {
  let size = initialSize;
  const text = stripAccents(value).slice(0, 160);
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.4;
  return { text, size };
}

function wrapText(font, value, maxWidth, size = 8.2, maxLines = 3) {
  const words = stripAccents(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function drawField(page, fonts, label, value, x, y, width, height, options = {}) {
  page.drawRectangle({ x, y, width, height, borderColor: options.borderColor || C.line, borderWidth: options.borderWidth || 1.2, color: C.white });
  page.drawText(stripAccents(label).toUpperCase(), { x: x + 7, y: y + height - 10, size: 6.6, font: fonts.bold, color: C.muted });
  const fitted = fitText(fonts.bold, value, width - 14, options.valueSize || 9.3);
  page.drawText(fitted.text, { x: x + 7, y: y + 7, size: fitted.size, font: fonts.bold, color: C.ink });
}

function drawInlineField(page, fonts, label, value, x, y, width, height, isLast = false) {
  page.drawRectangle({ x, y, width, height, borderColor: C.softLine, borderWidth: 0.8, color: C.white });
  if (!isLast) page.drawLine({ start: { x: x + width, y }, end: { x: x + width, y: y + height }, thickness: 0.8, color: C.softLine });
  page.drawText(stripAccents(label).toUpperCase(), { x: x + 7, y: y + height - 10, size: 6.4, font: fonts.bold, color: C.muted });
  const fitted = fitText(fonts.bold, value, width - 14, 8.8);
  page.drawText(fitted.text, { x: x + 7, y: y + 7, size: fitted.size, font: fonts.bold, color: C.ink });
}

function drawPairedField(page, fonts, label, valueText, colorLabel, colorText, x, y, width, height, isLast = false) {
  page.drawRectangle({ x, y, width, height, borderColor: C.softLine, borderWidth: 0.8, color: C.white });
  if (!isLast) page.drawLine({ start: { x: x + width, y }, end: { x: x + width, y: y + height }, thickness: 0.8, color: C.softLine });
  page.drawLine({ start: { x: x + 7, y: y + height / 2 }, end: { x: x + width - 7, y: y + height / 2 }, thickness: 0.45, color: C.softLine });
  const top = fitText(fonts.bold, valueText, width - 78, 8.4, 5.8);
  const bottom = fitText(fonts.bold, colorText, width - 78, 8.4, 5.8);
  page.drawText(stripAccents(label).toUpperCase(), { x: x + 7, y: y + height - 13, size: 6.1, font: fonts.bold, color: C.muted });
  page.drawText(top.text, { x: x + 58, y: y + height - 14, size: top.size, font: fonts.bold, color: C.ink });
  page.drawText(stripAccents(colorLabel).toUpperCase(), { x: x + 7, y: y + 8, size: 6.1, font: fonts.bold, color: C.muted });
  page.drawText(bottom.text, { x: x + 58, y: y + 7, size: bottom.size, font: fonts.bold, color: C.ink });
}

function drawMultilineField(page, fonts, label, value, x, y, width, height, isLast = false) {
  page.drawRectangle({ x, y, width, height, borderColor: C.softLine, borderWidth: 0.8, color: C.white });
  if (!isLast) page.drawLine({ start: { x: x + width, y }, end: { x: x + width, y: y + height }, thickness: 0.8, color: C.softLine });
  page.drawText(stripAccents(label).toUpperCase(), { x: x + 7, y: y + height - 10, size: 6.4, font: fonts.bold, color: C.muted });
  wrapText(fonts.bold, value, width - 14, 8.2, 3).forEach((line, index) => {
    page.drawText(line, { x: x + 7, y: y + height - 22 - index * 10, size: 8.2, font: fonts.bold, color: C.ink });
  });
}

function safeImagePath(order, uploads) {
  const image = String(order.productSnapshot?.image || '');
  if (!image.startsWith('/uploads/')) return null;
  const candidate = path.resolve(uploads, image.slice('/uploads/'.length));
  const relation = path.relative(uploads, candidate);
  return relation && !relation.startsWith('..') && !path.isAbsolute(relation) && fs.existsSync(candidate) ? candidate : null;
}

function safeCompanyIconPath(company, uploads) {
  const icon = String(company.iconUrl || '');
  if (!uploads || !icon.startsWith('/uploads/')) return null;
  const candidate = path.resolve(uploads, icon.slice('/uploads/'.length));
  const relation = path.relative(uploads, candidate);
  return relation && !relation.startsWith('..') && !path.isAbsolute(relation) && fs.existsSync(candidate) ? candidate : null;
}

async function drawCompanyIcon(document, page, company, uploads, x, y, size) {
  const iconPath = safeCompanyIconPath(company, uploads);
  if (!iconPath) return false;
  try {
    const bytes = fs.readFileSync(iconPath);
    const image = /\.png$/i.test(iconPath) ? await document.embedPng(bytes) : await document.embedJpg(bytes);
    const scale = Math.min(size / image.width, size / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, { x: x + (size - width) / 2, y: y + (size - height) / 2, width, height });
    return true;
  } catch {
    return false;
  }
}

async function drawOrderImage(document, page, fonts, order, uploads, x, y, width, height) {
  page.drawRectangle({ x, y, width, height, borderColor: rgb(217 / 255, 227 / 255, 239 / 255), borderWidth: 0.8, color: C.white });
  const labelWidth = 126;
  page.drawRectangle({ x: x + 10, y: y + 10, width: labelWidth, height: height - 20, color: C.pale });
  page.drawText('DESENHO DO PRODUTO', { x: x + 20, y: y + height - 33, size: 7, font: fonts.bold, color: C.muted });
  page.drawText('IMAGEM DA ORDEM', { x: x + 28, y: y + 31, size: 7, font: fonts.bold, color: C.muted });

  const imageX = x + labelWidth + 22;
  const imageY = y + 10;
  const imageW = width - labelWidth - 32;
  const imageH = height - 20;
  page.drawRectangle({ x: imageX, y: imageY, width: imageW, height: imageH, borderColor: rgb(199 / 255, 211 / 255, 227 / 255), borderWidth: 0.8, color: rgb(251 / 255, 253 / 255, 1) });

  const imagePath = safeImagePath(order, uploads);
  if (!imagePath) {
    page.drawText('Sem imagem cadastrada', { x: imageX + imageW / 2 - 44, y: imageY + imageH / 2 - 3, size: 8, font: fonts.regular, color: C.muted });
    return;
  }

  try {
    const bytes = fs.readFileSync(imagePath);
    const image = /\.png$/i.test(imagePath) ? await document.embedPng(bytes) : await document.embedJpg(bytes);
    const scale = Math.min((imageW - 18) / image.width, (imageH - 14) / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    page.drawImage(image, { x: imageX + (imageW - drawW) / 2, y: imageY + (imageH - drawH) / 2, width: drawW, height: drawH });
  } catch {
    page.drawText('Imagem indisponivel', { x: imageX + imageW / 2 - 39, y: imageY + imageH / 2 - 3, size: 8, font: fonts.regular, color: C.muted });
  }
}

function drawSizes(page, fonts, lines, x, y, width, height) {
  page.drawRectangle({ x, y, width, height, borderColor: C.softLine, borderWidth: 1.1, color: C.white });
  const safeLines = lines.slice(0, 18);
  const cardWidth = Math.min(38, Math.max(27, (width - 28) / Math.max(safeLines.length || 1, 10)));
  const gap = 5;
  const totalWidth = safeLines.length * cardWidth + Math.max(0, safeLines.length - 1) * gap;
  const firstX = x + Math.max(10, (width - totalWidth) / 2);
  safeLines.forEach((line, index) => {
    const cardX = firstX + index * (cardWidth + gap);
    const circle = 29;
    page.drawEllipse({ x: cardX + cardWidth / 2, y: y + height - 25, xScale: circle / 2, yScale: circle / 2, borderColor: C.line, borderWidth: 1.2, color: C.white });
    const size = fitText(fonts.bold, line.size, Math.min(cardWidth - 3, circle - 5), 8, 5.2);
    page.drawText(size.text, { x: cardX + (cardWidth - fonts.bold.widthOfTextAtSize(size.text, size.size)) / 2, y: y + height - 28, size: size.size, font: fonts.bold, color: C.ink });
    page.drawLine({ start: { x: cardX + 5, y: y + height - 39 }, end: { x: cardX + cardWidth - 5, y: y + height - 39 }, thickness: 1, color: C.line });
    const quantity = String(Math.max(0, Number.parseInt(line.quantity, 10) || 0));
    page.drawText(quantity, { x: cardX + (cardWidth - fonts.bold.widthOfTextAtSize(quantity, 9.2)) / 2, y: y + 10, size: 9.2, font: fonts.bold, color: C.ink });
  });
}

async function generateOrderPdf(order, uploads, company = {}) {
  const document = await PDFDocument.create();
  const number = String(Number(order.number) || 0).padStart(3, '0');
  const companyName = String(company.tradeName || 'ORDEM DE CORTE').trim();
  document.setTitle(`Ordem de Corte ${number}`);
  document.setAuthor('Ordem de Corte');
  document.setCreator('Ordem de Corte - banco local');

  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };
  const margin = 23;
  const contentWidth = page.getWidth() - margin * 2;
  const gap = 8;

  page.drawRectangle({ x: margin, y: 754, width: contentWidth - 125, height: 62, borderColor: C.line, borderWidth: 1.5, color: C.white });
  if (!await drawCompanyIcon(document, page, company, uploads, margin + 19, 765, 40)) { page.drawEllipse({ x: margin + 39, y: 785, xScale: 20, yScale: 20, color: C.navy }); page.drawText('OC', { x: margin + 30, y: 780, size: 13, font: bold, color: C.white }); }
  const companyTitle = fitText(bold, companyName, 205, 17, 8);
  page.drawText(companyTitle.text, { x: margin + 72, y: 787, size: companyTitle.size, font: bold, color: C.ink });
  page.drawText('CONTROLE DE PRODUCAO', { x: margin + 72, y: 773, size: 7.3, font: bold, color: C.muted });
  page.drawRectangle({ x: page.getWidth() - margin - 117, y: 754, width: 117, height: 62, borderColor: C.line, borderWidth: 1.5, color: C.white });
  page.drawText('ORDEM', { x: page.getWidth() - margin - 81, y: 787, size: 12, font: bold, color: C.ink });
  page.drawText(`No ${number}`, { x: page.getWidth() - margin - 76, y: 770, size: 12, font: bold, color: C.ink });

  const third = (contentWidth - gap * 2) / 3;
  drawField(page, fonts, 'Data', formatDate(order.issueDate), margin, 710, third, 31);
  drawField(page, fonts, 'Entrega', formatDate(order.deliveryDate), margin + third + gap, 710, third, 31);
  drawField(page, fonts, 'Ordem de compra cliente', order.purchaseOrder, margin + (third + gap) * 2, 710, third, 31);

  const clientW = (contentWidth - gap) * 0.63;
  drawField(page, fonts, 'Cliente', order.clientName, margin, 671, clientW, 31);
  drawField(page, fonts, 'Faccao', order.workshopName, margin + clientW + gap, 671, contentWidth - clientW - gap, 31);

  const boxY = 209;
  const boxH = 449;
  page.drawRectangle({ x: margin, y: boxY, width: contentWidth, height: boxH, borderColor: C.line, borderWidth: 1.5, color: C.white });

  const modelVisible = productOptions(order, 'models').length > 0;
  const materialVisible = productOptions(order, 'materials').length > 0;
  const sleeveVisible = productOptions(order, 'sleeves').length > 0;
  const collarVisible = productOptions(order, 'collars').length > 0;
  const yokeVisible = productOptions(order, 'yokes').length > 0;
  const pocketVisible = productOptions(order, 'pockets').length > 0;
  const mainFields = [['Produto', order.productName], ...(modelVisible ? [['Modelo', order.modelName]] : []), ...(materialVisible ? [['Tecido', order.materialName]] : []), ['Cor', order.colorName]];
  const mainW = contentWidth / mainFields.length;
  mainFields.forEach(([label, text], index) => drawInlineField(page, fonts, label, text, margin + mainW * index, 623, mainW, 32, index === mainFields.length - 1));

  const garmentFields = [sleeveVisible && ['Manga', order.sleeveName, 'Cor da manga', order.sleeveColorName], collarVisible && ['Gola', order.collarName, 'Cor da gola', order.collarColorName], yokeVisible && ['Pala', order.yokeName, 'Cor da pala', order.yokeColorName]].filter(Boolean);
  if (garmentFields.length) {
    const garmentW = contentWidth / garmentFields.length;
    garmentFields.forEach(([label, text, colorLabel, colorText], index) => drawPairedField(page, fonts, label, text, colorLabel, colorText, margin + garmentW * index, 577, garmentW, 46, index === garmentFields.length - 1));
  }

  const extraFields = [['Tipo de impressao', order.printTypeName], ...(pocketVisible ? [['Bolsos', order.pocketName]] : [])];
  const extraW = contentWidth / extraFields.length;
  extraFields.forEach(([label, text], index) => drawInlineField(page, fonts, label, text, margin + extraW * index, 545, extraW, 32, index === extraFields.length - 1));

  drawMultilineField(page, fonts, 'Detalhe', order.detailName, margin, 497, contentWidth / 2, 48);
  drawMultilineField(page, fonts, 'Observacoes', order.notes, margin + contentWidth / 2, 497, contentWidth / 2, 48, true);

  await drawOrderImage(document, page, fonts, order, uploads, margin + 10, 374, contentWidth - 20, 111);

  const lines = Array.isArray(order.lines) ? order.lines : [];
  const sizeVisible = productOptions(order, 'sizes').length > 0 || lines.some(line => String(line.size || '').trim());
  if (sizeVisible) drawSizes(page, fonts, lines, margin + 10, 250, contentWidth - 20, 112);

  const total = Number(order.total) || lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  page.drawRectangle({ x: page.getWidth() - margin - 176, y: 209, width: 176, height: 30, borderColor: C.line, borderWidth: 1.4, color: C.white });
  page.drawText('TOTAL DE PECAS', { x: page.getWidth() - margin - 165, y: 220, size: 7.2, font: bold, color: C.ink });
  const totalText = String(total);
  page.drawLine({ start: { x: page.getWidth() - margin - 52, y: 209 }, end: { x: page.getWidth() - margin - 52, y: 239 }, thickness: 1.1, color: C.line });
  page.drawText(totalText, { x: page.getWidth() - margin - 25 - bold.widthOfTextAtSize(totalText, 14), y: 217, size: 14, font: bold, color: C.ink });

  page.drawLine({ start: { x: margin + 28, y: 150 }, end: { x: margin + 216, y: 150 }, thickness: 0.7, color: C.muted });
  page.drawLine({ start: { x: page.getWidth() - margin - 216, y: 150 }, end: { x: page.getWidth() - margin - 28, y: 150 }, thickness: 0.7, color: C.muted });
  page.drawText('RESPONSAVEL PELA EMISSAO', { x: margin + 69, y: 137, size: 6.3, font: bold, color: C.muted });
  page.drawText('RESPONSAVEL PELO CORTE', { x: page.getWidth() - margin - 166, y: 137, size: 6.3, font: bold, color: C.muted });
  page.drawLine({ start: { x: margin, y: 93 }, end: { x: page.getWidth() - margin, y: 93 }, thickness: 0.5, color: C.softLine });
  page.drawText(`Ordem de corte No ${number}`, { x: margin, y: 78, size: 6, font: regular, color: C.muted });
  const footer = 'Documento de producao';
  page.drawText(footer, { x: page.getWidth() - margin - regular.widthOfTextAtSize(footer, 6), y: 78, size: 6, font: regular, color: C.muted });

  return Buffer.from(await document.save());
}

module.exports = { generateOrderPdf };
