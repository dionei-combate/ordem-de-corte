const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const C = { navy: rgb(36 / 255, 56 / 255, 97 / 255), ink: rgb(32 / 255, 36 / 255, 43 / 255), muted: rgb(64 / 255, 83 / 255, 113 / 255), line: rgb(89 / 255, 96 / 255, 108 / 255), soft: rgb(215 / 255, 222 / 255, 232 / 255), pale: rgb(238 / 255, 245 / 255, 1), white: rgb(1, 1, 1) };
const clean = value => String(value ?? '').trim() || '-';
const money = value => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = value => { if (!value) return '-'; const parts = String(value).split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : clean(value); };
const strip = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function fit(font, value, width, size = 8.5, min = 5.8) { let current = size; const text = strip(value).slice(0, 180); while (current > min && font.widthOfTextAtSize(text, current) > width) current -= .35; return { text, size: current }; }
function wrap(font, value, width, size = 7.5, maxLines = 3) { const words = strip(value).split(/\s+/).filter(Boolean), lines = []; let line = ''; for (const word of words) { const next = line ? `${line} ${word}` : word; if (font.widthOfTextAtSize(next, size) <= width) line = next; else { if (line) lines.push(line); line = word; } } if (line) lines.push(line); return lines.slice(0, maxLines); }
function itemDescription(item) { const fields = [item.modelName && `Modelo: ${item.modelName}`, item.materialName && `Tecido: ${item.materialName}`, item.colorName && `Cor: ${item.colorName}`, item.sleeveName && `Manga: ${item.sleeveName}${item.sleeveColorName ? ` (${item.sleeveColorName})` : ''}`, item.collarName && `Gola: ${item.collarName}${item.collarColorName ? ` (${item.collarColorName})` : ''}`, item.yokeName && `Pala: ${item.yokeName}${item.yokeColorName ? ` (${item.yokeColorName})` : ''}`, item.pocketName && `Bolsos: ${item.pocketName}`, item.printTypeName && `Impressao: ${item.printTypeName}`, item.detailName && `Detalhe: ${item.detailName}`].filter(Boolean); return { product: item.productName || 'Produto', details: fields.join(' · ') || 'Sem caracteristicas adicionais' }; }
function field(page, fonts, label, value, x, y, width, height) { page.drawRectangle({ x, y, width, height, borderColor: C.line, borderWidth: 1, color: C.white }); page.drawText(strip(label).toUpperCase(), { x: x + 7, y: y + height - 11, size: 6.3, font: fonts.bold, color: C.muted }); const fitted = fit(fonts.bold, value, width - 14, 9); page.drawText(fitted.text, { x: x + 7, y: y + 7, size: fitted.size, font: fonts.bold, color: C.ink }); }
function tableCell(page, fonts, text, x, y, width, height, options = {}) { page.drawRectangle({ x, y, width, height, borderColor: C.soft, borderWidth: .7, color: options.header ? C.pale : C.white }); const lines = wrap(fonts[options.header ? 'bold' : 'regular'], text, width - 12, options.header ? 6.4 : 7.4, options.maxLines || 3); lines.forEach((line, index) => page.drawText(line, { x: options.align === 'right' ? x + width - 6 - fonts[options.header ? 'bold' : 'regular'].widthOfTextAtSize(line, options.header ? 6.4 : 7.4) : options.align === 'center' ? x + (width - fonts[options.header ? 'bold' : 'regular'].widthOfTextAtSize(line, options.header ? 6.4 : 7.4)) / 2 : x + 6, y: y + height - 12 - index * 9, size: options.header ? 6.4 : 7.4, font: fonts[options.header ? 'bold' : 'regular'], color: options.header ? C.muted : C.ink })); }

async function generateQuotePdf(quote) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };
  const margin = 32;
  const width = 595.28 - margin * 2;
  const items = Array.isArray(quote.items) ? quote.items : [];
  const chunks = [];
  for (let i = 0; i < Math.max(1, items.length); i += 9) chunks.push(items.slice(i, i + 9));
  for (let pageIndex = 0; pageIndex < chunks.length; pageIndex += 1) {
    const page = document.addPage([595.28, 841.89]);
    page.drawRectangle({ x: margin, y: 752, width: width - 120, height: 58, borderColor: C.line, borderWidth: 1.4, color: C.white });
    page.drawEllipse({ x: margin + 35, y: 781, xScale: 19, yScale: 19, color: C.navy });
    page.drawText('OC', { x: margin + 26, y: 776, size: 12, font: bold, color: C.white });
    page.drawText('ORDEM DE CORTE', { x: margin + 67, y: 784, size: 16, font: bold, color: C.ink });
    page.drawText('PROPOSTA COMERCIAL', { x: margin + 67, y: 771, size: 7, font: bold, color: C.muted });
    page.drawRectangle({ x: page.getWidth() - margin - 120, y: 752, width: 120, height: 58, borderColor: C.line, borderWidth: 1.4, color: C.white });
    page.drawText('ORCAMENTO', { x: page.getWidth() - margin - 91, y: 783, size: 10, font: bold, color: C.ink });
    page.drawText(`No ${String(Number(quote.number) || 0).padStart(3, '0')}`, { x: page.getWidth() - margin - 73, y: 767, size: 10, font: bold, color: C.muted });
    page.drawText('ORCAMENTO', { x: margin, y: 726, size: 17, font: bold, color: C.navy });
    const col = (width - 16) / 3;
    field(page, fonts, 'Data de criacao', date(quote.issueDate), margin, 684, col, 29);
    field(page, fonts, 'Validade', date(quote.validUntil), margin + col + 8, 684, col, 29);
    field(page, fonts, 'Status', quote.status, margin + (col + 8) * 2, 684, col, 29);
    field(page, fonts, 'Cliente', quote.clientName, margin, 646, width * .62, 29);
    field(page, fonts, 'CPF / CNPJ', quote.clientDocument, margin + width * .62 + 8, 646, width * .38 - 8, 29);
    const address = [quote.clientAddress, quote.clientNeighborhood, quote.clientCity, quote.clientState, quote.clientZip].filter(Boolean).join(' · ');
    field(page, fonts, 'Contato e endereco', [quote.clientPhone, quote.clientEmail, address].filter(Boolean).join(' · '), margin, 608, width, 29);
    page.drawText(pageIndex ? 'Itens do orcamento - continuação' : 'ITENS DO ORCAMENTO', { x: margin, y: 583, size: 8, font: bold, color: C.white });
    page.drawRectangle({ x: margin, y: 578, width, height: 18, color: C.navy });
    page.drawText(pageIndex ? 'ITENS DO ORCAMENTO - CONTINUACAO' : 'ITENS DO ORCAMENTO', { x: margin + 7, y: 584, size: 7, font: bold, color: C.white });
    const productW = width - 62 - 78 - 82;
    const headers = [['Produto e caracteristicas', productW, 'left'], ['Qtd.', 62, 'center'], ['Preco unit.', 78, 'right'], ['Total', 82, 'right']];
    let x = margin; headers.forEach(([label, cellWidth, align]) => { tableCell(page, fonts, label, x, 558, cellWidth, 20, { header: true, align }); x += cellWidth; });
    let y = 558;
    for (const item of chunks[pageIndex]) { const description = itemDescription(item); const detailLines = wrap(regular, description.details, productW - 12, 7.2, 2); const rowHeight = 32; x = margin; tableCell(page, fonts, `${description.product}\n${detailLines.join(' · ')}`, x, y - rowHeight, productW, rowHeight, { maxLines: 3 }); x += productW; tableCell(page, fonts, String(Number(item.quantity) || 0), x, y - rowHeight, 62, rowHeight, { align: 'center' }); x += 62; tableCell(page, fonts, money(item.unitPrice), x, y - rowHeight, 78, rowHeight, { align: 'right' }); x += 78; tableCell(page, fonts, money(item.lineTotal), x, y - rowHeight, 82, rowHeight, { align: 'right' }); y -= rowHeight; }
    if (pageIndex === chunks.length - 1) {
      const summaryX = margin + width - 190;
      const summaryY = Math.max(280, y - 18);
      [['Subtotal', quote.subtotal], ['Frete', quote.shipping], ['Desconto', quote.discount], ['Total final', quote.total]].forEach(([label, amount], index) => { const h = index === 3 ? 25 : 20; page.drawRectangle({ x: summaryX, y: summaryY - index * 20 - h, width: 190, height: h, borderColor: index === 3 ? C.navy : C.soft, borderWidth: 1, color: index === 3 ? C.pale : C.white }); page.drawText(label.toUpperCase(), { x: summaryX + 7, y: summaryY - index * 20 - h + 7, size: index === 3 ? 7.5 : 7, font: bold, color: index === 3 ? C.navy : C.muted }); const amountText = money(amount); page.drawText(amountText, { x: summaryX + 183 - bold.widthOfTextAtSize(amountText, index === 3 ? 10 : 8), y: summaryY - index * 20 - h + 6, size: index === 3 ? 10 : 8, font: bold, color: index === 3 ? C.navy : C.ink }); });
      const notesY = summaryY - 112; page.drawRectangle({ x: margin, y: notesY - 52, width: width - 205, height: 52, borderColor: C.soft, borderWidth: 1, color: C.white }); page.drawRectangle({ x: margin, y: notesY - 17, width: width - 205, height: 17, color: C.navy }); page.drawText('OBSERVACOES', { x: margin + 7, y: notesY - 12, size: 7, font: bold, color: C.white }); wrap(regular, quote.notes, width - 219, 7.5, 3).forEach((line, index) => page.drawText(line, { x: margin + 7, y: notesY - 29 - index * 9, size: 7.5, font: regular, color: C.ink }));
    }
    page.drawLine({ start: { x: margin, y: 58 }, end: { x: margin + width, y: 58 }, thickness: .5, color: C.soft });
    page.drawText(`Orcamento No ${String(Number(quote.number) || 0).padStart(3, '0')}`, { x: margin, y: 44, size: 6.5, font: regular, color: C.muted });
    page.drawText(`Pagina ${pageIndex + 1} de ${chunks.length}`, { x: margin + width - 55, y: 44, size: 6.5, font: regular, color: C.muted });
  }
  return Buffer.from(await document.save());
}

module.exports = { generateQuotePdf };
