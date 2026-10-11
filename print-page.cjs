const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

const value = input => escapeHtml(String(input ?? '').trim() || '-');

function formatDate(input) {
  if (!input) return '-';
  const date = new Date(`${input}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value(input) : date.toLocaleDateString('pt-BR');
}

function field(label, content, className = '') {
  return `<div class="oc-field ${className}"><span>${escapeHtml(label)}</span><b>${value(content)}</b></div>`;
}

function textField(label, content) {
  return field(label, content, 'oc-text-field');
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
  return order[`${key.slice(0, -1)}Name`] ? [order[`${key.slice(0, -1)}Name`]] : [];
}

function sizesHtml(lines) {
  return lines.map(line => `<div class="oc-size-item"><div class="oc-size-circle"><b>${value(line.size)}</b></div><div class="oc-fraction-line"></div><strong>${Math.max(0, Number.parseInt(line.quantity, 10) || 0)}</strong></div>`).join('');
}

function pairedField(label, valueText, colorLabel, colorText) {
  return `<div class="oc-field oc-paired-field"><div class="oc-paired-slot"><span>${label}</span><b>${value(valueText)}</b></div><div class="oc-paired-slot"><span>${colorLabel}</span><b>${value(colorText)}</b></div></div>`;
}

function generatePrintPage(order) {
  const number = String(Number(order.number) || 0).padStart(3, '0');
  const lines = Array.isArray(order.lines) ? order.lines.slice(0, 18) : [];
  const image = String(order.productSnapshot?.image || '').startsWith('/uploads/') ? order.productSnapshot.image : '';
  const total = Number(order.total) || lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const modelVisible = productOptions(order, 'models').length > 0;
  const materialVisible = productOptions(order, 'materials').length > 0;
  const sleeveVisible = productOptions(order, 'sleeves').length > 0;
  const collarVisible = productOptions(order, 'collars').length > 0;
  const yokeVisible = productOptions(order, 'yokes').length > 0;
  const pocketVisible = productOptions(order, 'pockets').length > 0;
  const sizeVisible = productOptions(order, 'sizes').length > 0 || lines.some(line => String(line.size || '').trim());
  const mainFields = [field('PRODUTO', order.productName), modelVisible && field('MODELO', order.modelName), materialVisible && field('TECIDO', order.materialName), field('COR', order.colorName)].filter(Boolean);
  const garmentFields = [sleeveVisible && pairedField('MANGA', order.sleeveName, 'COR DA MANGA', order.sleeveColorName), collarVisible && pairedField('GOLA', order.collarName, 'COR DA GOLA', order.collarColorName), yokeVisible && pairedField('PALA', order.yokeName, 'COR DA PALA', order.yokeColorName)].filter(Boolean);
  const extraFields = [field('TIPO DE IMPRESSÃO', order.printTypeName), pocketVisible && field('BOLSOS', order.pocketName)].filter(Boolean);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Imprimir Ordem de Corte ${number}</title>
<style>
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
body{margin:0;background:#e8edf4;color:#20242b;font-family:Arial,sans-serif}
.toolbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 22px;background:#102344;color:#fff}
.toolbar small{color:#cbd8ea}
.toolbar button{border:1px solid #ffffff38;border-radius:8px;padding:9px 13px;background:#fff;color:#102344;font-weight:700;cursor:pointer}
.order-document{width:210mm;height:297mm;margin:16px auto;padding:8mm;background:#fff;box-shadow:0 18px 50px #10234428;overflow:hidden}
.oc-header{display:grid;grid-template-columns:minmax(0,1fr) 42mm;gap:4mm;height:22mm;margin-bottom:3mm}
.oc-brand,.oc-title{border:2px solid #59606c;display:flex;align-items:center}
.oc-brand{padding:3mm 5mm;gap:4mm}
.oc-mark{display:grid;place-items:center;width:14mm;height:14mm;border-radius:50%;background:#243861;color:#fff;font-size:15px;font-weight:900}
.oc-brand strong{display:block;font-size:17px;letter-spacing:1px}
.oc-brand small{display:block;color:#667085;font-size:8px;letter-spacing:1.5px;margin-top:1mm}
.oc-title{justify-content:center;flex-direction:column;text-align:center}
.oc-title b{font-size:14px;line-height:1;letter-spacing:1px}
.oc-title span{font-size:11px;font-weight:800;margin-top:1.5mm}
.oc-top-row{display:grid;grid-template-columns:1fr 1fr 1.08fr;gap:3mm;margin-bottom:3mm}
.oc-client-row{display:grid;grid-template-columns:1.7fr 1fr;gap:3mm;margin-bottom:3mm}
.oc-production-box{border:2px solid #59606c;min-height:139mm;padding-top:3mm}
.oc-product-row{display:grid;border-top:1.5px solid #747b85;min-height:15mm}
.oc-product-row:first-child{border-top:0}
.oc-product-main{grid-template-columns:1.2fr 1fr 1fr .85fr}
.oc-product-primary{grid-template-columns:1.15fr .85fr .85fr 1.25fr}
.oc-product-garment{grid-template-columns:repeat(3,1fr)}
.oc-product-extra,.oc-product-secondary{grid-template-columns:1fr 1fr}
.oc-field{min-width:0;display:flex;align-items:center;gap:2mm;min-height:10mm;padding:1.4mm 2.1mm;border:2px solid #59606c;background:#fff}
.oc-product-row .oc-field{border:0;border-right:1px solid #9aa0a9}
.oc-product-row .oc-field:last-child{border-right:0}
.oc-field span{flex:0 0 auto;color:#405371;font-size:9.5px;font-weight:900;letter-spacing:.2px;white-space:nowrap}
.oc-field b{min-width:0;font-size:11.5px;line-height:1.22;white-space:pre-line;overflow-wrap:anywhere}
.oc-paired-field{display:grid;grid-template-rows:1fr 1fr;gap:2mm;min-height:22mm}
.oc-paired-slot{display:grid;grid-template-columns:minmax(21mm,auto) minmax(0,1fr);align-items:center;gap:2mm;min-width:0}
.oc-paired-slot+.oc-paired-slot{border-top:1px solid #dfe6ef;padding-top:1.8mm}
.oc-paired-slot span{font-size:8px}
.oc-paired-slot b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.oc-text-field{align-items:flex-start;min-height:18mm}
.oc-text-field span{padding-top:1.2mm}
.oc-product-visual{display:grid;grid-template-columns:130px minmax(0,1fr);grid-template-rows:34mm;gap:3mm;margin:3mm;padding:3mm;border:1px solid #d9e3ef;border-radius:3mm;background:#fff;overflow:hidden}
.oc-product-visual-label{display:grid;grid-template-rows:1fr 1fr;gap:2mm}
.oc-product-visual-label span,.oc-product-visual-label b{display:flex;align-items:center;justify-content:center;padding:2mm;border-radius:2.5mm;background:#f0f5fc;color:#52657f;font-size:8px;font-weight:900;letter-spacing:.4px;text-align:center}
.oc-product-visual figure{display:grid;place-items:center;min-width:0;width:100%;height:100%;margin:0;border:1px dashed #c7d3e3;border-radius:2.5mm;background:#fbfdff;overflow:hidden}
.oc-product-visual img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;padding:1.5mm}
.oc-product-image-empty{color:#8a97a9;font-size:10px}
.oc-sizes{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:2.4mm;min-height:27mm;margin:3mm;padding:2.5mm;border:1.5px solid #747b85}
.oc-size-item{flex:0 0 18mm;display:flex;flex-direction:column;align-items:center}
.oc-size-circle{width:16mm;height:16mm;border:1.7px solid #59606c;border-radius:50%;display:grid;place-items:center;background:#fff;overflow:hidden}
.oc-size-circle b{display:block;max-width:14mm;overflow:hidden;text-align:center;text-overflow:ellipsis;white-space:nowrap;font-size:8.7px;line-height:1}
.oc-fraction-line{width:13mm;border-top:1.7px solid #59606c;margin-top:.7mm}
.oc-size-item strong{padding-top:.8mm;font-size:10.5px}
.oc-total{display:flex;justify-content:flex-end;align-items:center;border:2px solid #59606c;border-top:0;margin-left:auto;width:62mm;min-height:10mm}
.oc-total span{font-size:9.5px;font-weight:900;padding:2mm 3mm}
.oc-total strong{display:grid;place-items:center;align-self:stretch;min-width:18mm;border-left:2px solid #59606c;font-size:14px}
.print-signatures{display:grid;grid-template-columns:1fr 1fr;gap:15mm;margin-top:9mm;padding:0 12mm}
.print-signature{padding-top:2mm;border-top:1px solid #66758a;text-align:center;color:#536176;font-size:6.5pt;font-weight:700}
.print-footer{display:flex;justify-content:space-between;margin-top:5mm;padding-top:2mm;border-top:1px solid #d4dbe5;color:#7a8799;font-size:6pt}
@media print{body{background:#fff}.toolbar{display:none!important}.order-document{width:210mm;height:297mm;margin:0;box-shadow:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div class="toolbar"><div><strong>Ordem de Corte ${number}</strong><br><small>Documento ajustado para caber em uma folha A4.</small></div><button onclick="window.print()">Abrir impressão</button></div>
<article class="order-document oc-reference">
<header class="oc-header"><div class="oc-brand"><span class="oc-mark">OC</span><div><strong>ORDEM DE CORTE</strong><small>CONTROLE DE PRODUÇÃO</small></div></div><div class="oc-title"><b>ORDEM</b><span>Nº ${number}</span></div></header>
<section class="oc-top-row">${field('DATA', formatDate(order.issueDate))}${field('ENTREGA', formatDate(order.deliveryDate))}${field('ORDEM DE COMPRA CLIENTE', order.purchaseOrder)}</section>
<section class="oc-client-row">${field('CLIENTE', order.clientName)}${field('FACÇÃO', order.workshopName)}</section>
<section class="oc-production-box">
<div class="oc-product-row oc-product-main" style="grid-template-columns:repeat(${mainFields.length},minmax(0,1fr))">${mainFields.join('')}</div>
${garmentFields.length ? `<div class="oc-product-row oc-product-garment" style="grid-template-columns:repeat(${garmentFields.length},minmax(0,1fr))">${garmentFields.join('')}</div>` : ''}
<div class="oc-product-row oc-product-extra" style="grid-template-columns:repeat(${extraFields.length},minmax(0,1fr))">${extraFields.join('')}</div>
<div class="oc-product-row oc-product-secondary">${textField('DETALHE', order.detailName)}${textField('OBSERVAÇÕES', order.notes)}</div>
<div class="oc-product-visual"><div class="oc-product-visual-label"><span>DESENHO DO PRODUTO</span><b>IMAGEM DA ORDEM</b></div><figure>${image ? `<img src="${escapeHtml(image)}" alt="Desenho do produto">` : '<div class="oc-product-image-empty">Sem imagem cadastrada</div>'}</figure></div>
${sizeVisible ? `<div class="oc-sizes">${sizesHtml(lines)}</div>` : ''}
</section>
<footer class="oc-total"><span>TOTAL DE PEÇAS</span><strong>${total}</strong></footer>
<section class="print-signatures"><div class="print-signature">RESPONSÁVEL PELA EMISSÃO</div><div class="print-signature">RESPONSÁVEL PELO CORTE</div></section>
<footer class="print-footer"><span>Ordem de corte Nº ${number}</span><span>Documento de produção</span></footer>
</article>
<script>const embedded=new URLSearchParams(location.search).has('embedded');if(embedded)document.querySelector('.toolbar').remove();addEventListener('afterprint',()=>{if(embedded)parent.postMessage({type:'order-print-complete'},location.origin)});addEventListener('load',()=>setTimeout(()=>{window.focus();window.print()},250));<\/script>
</body>
</html>`;
}

module.exports = { generatePrintPage };
