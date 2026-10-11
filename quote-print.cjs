const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

const text = value => escapeHtml(String(value ?? '').trim() || '-');
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '-';

function itemDescription(item) {
  const characteristics = [
    item.modelName && `Modelo: ${item.modelName}`,
    item.materialName && `Tecido: ${item.materialName}`,
    item.colorName && `Cor: ${item.colorName}`,
    item.sleeveName && `Manga: ${item.sleeveName}${item.sleeveColorName ? ` (${item.sleeveColorName})` : ''}`,
    item.collarName && `Gola: ${item.collarName}${item.collarColorName ? ` (${item.collarColorName})` : ''}`,
    item.yokeName && `Pala: ${item.yokeName}${item.yokeColorName ? ` (${item.yokeColorName})` : ''}`,
    item.pocketName && `Bolsos: ${item.pocketName}`,
    item.printTypeName && `Impressão: ${item.printTypeName}`,
    item.detailName && `Detalhe: ${item.detailName}`
  ].filter(Boolean);
  return { product: item.productName || 'Produto', details: characteristics.join(' · ') || 'Sem características adicionais' };
}

function generateQuotePrint(quote) {
  const number = String(Number(quote.number) || 0).padStart(3, '0');
  const items = Array.isArray(quote.items) ? quote.items : [];
  const rows = items.map(item => {
    const description = itemDescription(item);
    return `<tr><td><strong>${text(description.product)}</strong><small>${text(description.details)}</small></td><td class="center">${Number(item.quantity) || 0}</td><td class="right">${money(item.unitPrice)}</td><td class="right strong">${money(item.lineTotal)}</td></tr>`;
  }).join('');
  const clientAddress = [quote.clientAddress, quote.clientNeighborhood, quote.clientCity, quote.clientState, quote.clientZip].filter(Boolean).join(' · ');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orçamento ${number}</title>
<style>
@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#e8edf4;color:#20242b;font-family:Arial,sans-serif}.toolbar{display:flex;justify-content:space-between;align-items:center;padding:12px 22px;background:#102344;color:#fff}.toolbar button{border:1px solid #ffffff38;border-radius:8px;padding:9px 13px;background:#fff;color:#102344;font-weight:700;cursor:pointer}.sheet{width:210mm;min-height:297mm;margin:16px auto;padding:12mm;background:#fff;box-shadow:0 18px 50px #10234428}.brand{display:grid;grid-template-columns:1fr 42mm;gap:4mm}.brand-main,.quote-box{border:2px solid #59606c;min-height:24mm;padding:5mm;display:flex;align-items:center}.brand-main{gap:4mm}.mark{display:grid;place-items:center;width:16mm;height:16mm;border-radius:50%;background:#243861;color:#fff;font-size:15px;font-weight:900}.brand-main strong{display:block;font-size:18px;letter-spacing:1px}.brand-main small{display:block;margin-top:1mm;color:#667085;font-size:8px;letter-spacing:1.4px}.quote-box{justify-content:center;flex-direction:column;text-align:center;padding:3mm}.quote-box b{font-size:16px}.quote-box span{margin-top:2mm;color:#52657f;font-size:10px;font-weight:700}.title{margin:4mm 0 3mm;text-align:center;color:#172b4d;font-size:24px}.meta-grid,.client-grid{display:grid;gap:2mm;margin-bottom:2mm}.meta-grid{grid-template-columns:repeat(3,1fr)}.client-grid{grid-template-columns:1.6fr 1fr}.cell{border:1px solid #9aa7b8;padding:2.3mm;min-height:12mm}.cell small{display:block;color:#52657f;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.45px}.cell b{display:block;margin-top:1mm;font-size:10.5px;line-height:1.3;overflow-wrap:anywhere}.section-title{margin-top:5mm;padding:2.5mm 3mm;background:#172b4d;color:#fff;font-size:10px;font-weight:900;letter-spacing:.7px;text-transform:uppercase}table{width:100%;border-collapse:collapse}th{padding:2.5mm 3mm;background:#eef3f9;color:#405371;font-size:8.5px;text-align:left;text-transform:uppercase}td{border:1px solid #d7dee8;padding:2.5mm 3mm;vertical-align:top;font-size:10px}td strong{display:block;color:#172b4d;font-size:10.5px}td small{display:block;margin-top:1mm;color:#66758a;font-size:8.5px;line-height:1.35}.center{text-align:center}.right{text-align:right;white-space:nowrap}.strong{font-weight:900;color:#172b4d}.summary{display:flex;justify-content:flex-end;margin-top:4mm}.summary table{width:82mm}.summary td{padding:2.5mm 3mm}.summary td:last-child{font-weight:900;text-align:right}.summary .final td{background:#eef5ff;border-color:#a9c4ee;color:#123c7a;font-size:12px}.notes{margin-top:5mm;border:1px solid #9aa7b8;min-height:22mm}.notes h4{margin:0;padding:2.5mm 3mm;background:#172b4d;color:#fff;font-size:9px;text-transform:uppercase}.notes p{margin:0;padding:3mm;font-size:10px;white-space:pre-wrap}.footer{display:flex;justify-content:space-between;margin-top:14mm;padding-top:3mm;border-top:1px solid #d4dbe5;color:#66758a;font-size:8px}@media print{body{background:#fff}.toolbar{display:none}.sheet{width:210mm;min-height:297mm;margin:0;box-shadow:none;padding:10mm}}
</style></head><body><div class="toolbar"><strong>Orçamento ${number}</strong><button onclick="window.print()">Abrir impressão</button></div><article class="sheet"><section class="brand"><div class="brand-main"><span class="mark">OC</span><div><strong>ORDEM DE CORTE</strong><small>PROPOSTA COMERCIAL</small></div></div><div class="quote-box"><b>ORÇAMENTO</b><span>Nº ${number}</span></div></section><h1 class="title">Orçamento</h1><section class="meta-grid"><div class="cell"><small>Data de criação</small><b>${date(quote.issueDate)}</b></div><div class="cell"><small>Validade</small><b>${date(quote.validUntil)}</b></div><div class="cell"><small>Status</small><b>${text(quote.status)}</b></div></section><section class="client-grid"><div class="cell"><small>Cliente</small><b>${text(quote.clientName)}</b></div><div class="cell"><small>CPF / CNPJ</small><b>${text(quote.clientDocument)}</b></div></section><section class="client-grid"><div class="cell"><small>Contato</small><b>${text([quote.clientPhone,quote.clientEmail].filter(Boolean).join(' · '))}</b></div><div class="cell"><small>Endereço</small><b>${text(clientAddress)}</b></div></section><div class="section-title">Itens do orçamento</div><table><thead><tr><th>Produto e características</th><th class="center">Qtd.</th><th class="right">Preço unit.</th><th class="right">Total</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Nenhum item cadastrado.</td></tr>'}</tbody></table><section class="summary"><table><tr><td>Subtotal</td><td>${money(quote.subtotal)}</td></tr><tr><td>Frete</td><td>${money(quote.shipping)}</td></tr><tr><td>Desconto</td><td>${money(quote.discount)}</td></tr><tr class="final"><td>Total final</td><td>${money(quote.total)}</td></tr></table></section><section class="notes"><h4>Observações</h4><p>${text(quote.notes)}</p></section><footer class="footer"><span>Orçamento Nº ${number}</span><span>Documento comercial</span></footer></article><script>addEventListener('load',()=>setTimeout(()=>{window.focus();window.print()},250))<\/script></body></html>`;
}

module.exports = { generateQuotePrint };
