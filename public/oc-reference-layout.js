(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options=(rows,value,labeler)=>rows.map(x=>`<option value="${x.id}" ${x.id===value?'selected':''}>${esc(labeler(x))}</option>`).join('');
  const textOptions=(rows,value)=>rows.map(x=>`<option value="${esc(x)}" ${x===value?'selected':''}>${esc(x)}</option>`).join('');
  const edit=(label,name,value,type='text')=>`<label class="oc-field"><span>${label}</span><input type="${type}" name="${name}" value="${esc(value)}"></label>`;
  const textEdit=(label,name,value)=>`<label class="oc-field oc-text-field"><span>${label}</span><textarea name="${name}" rows="3">${esc(value)}</textarea></label>`;
  const show=(label,value)=>`<div class="oc-field"><span>${label}</span><b>${esc(value)||'—'}</b></div>`;
  const selectEdit=(label,name,rows,value,labeler)=>`<label class="oc-field"><span>${label}</span><select name="${name}">${options(rows,value,labeler)}</select></label>`;
  const optionAliases={collars:['collars','golas','gola','collar'],yokes:['yokes','palas','pala','yoke']};
  const asOptionList=value=>Array.isArray(value)?value:typeof value==='string'?value.split(/[,;\r\n]+/):[];
  const uniqueOptions=values=>[...new Set(values.map(x=>String(x??'').trim()).filter(Boolean))];
  const productOptions=(product,key,fallback=[])=>{const keys=optionAliases[key]||[key];for(const optionKey of keys){const values=uniqueOptions(asOptionList(product?.[optionKey]));if(values.length)return values}return uniqueOptions(fallback.map(x=>x.name))};

  function productSelect(label,name,values,value,shown){return values.length?`<label class="oc-field"><span>${label}</span><select name="${name}">${textOptions(values,value)}</select></label>`:edit(label,name,value||shown||'')}
  function productOptionSelect(label,name,values,value){return `<label class="oc-field"><span>${label}</span><select name="${name}">${values.length?textOptions(values,value):'<option value="">SEM OPÇÕES CADASTRADAS</option>'}</select></label>`}
  function productPair(label,control,colorLabel,colorControl){return `<div class="oc-field oc-paired-field"><div class="oc-paired-slot"><span>${label}</span>${control}</div><div class="oc-paired-slot"><span>${colorLabel}</span>${colorControl}</div></div>`}
  function fieldControl(name,rows,value,labeler){return `<select name="${name}">${options(rows,value,labeler)}</select>`}
  function productControl(name,values,value,shown){return values.length?`<select name="${name}">${textOptions(values,value)}</select>`:`<input name="${name}" value="${esc(value||shown||'')}">`}
  function productOptionControl(name,values,value){return `<select name="${name}">${values.length?textOptions(values,value):'<option value="">SEM OPÇÕES CADASTRADAS</option>'}</select>`}
  function sizes(lines,editable,sizeOptions=[]){return lines.map((line,i)=>editable?`<div class="oc-size-item" data-line="${i}"><div class="oc-size-circle">${sizeOptions.length?`<select class="size" aria-label="Tamanho ${i+1}">${textOptions(sizeOptions,line.size)}</select>`:`<input class="size" value="${esc(line.size)}" placeholder="TAM." aria-label="Tamanho ${i+1}">`}</div><div class="oc-fraction-line"></div><input class="quantity" type="number" min="0" value="${+line.quantity||0}" placeholder="0" aria-label="Quantidade do tamanho ${i+1}" oninput="updateDocTotal()"></div>`:`<div class="oc-size-item"><div class="oc-size-circle"><b>${esc(line.size)||'—'}</b></div><div class="oc-fraction-line"></div><strong>${+line.quantity||0}</strong></div>`).join('')}

  function documentHtml(o={},editable=true){
    const p=state.products.find(x=>x.id===o.productId)||o.productSnapshot||{};
    const lines=o.lines?.length?legacyGrade(o.lines):[{quantity:0,size:''}];
    const number=String(o.number||state.orders.reduce((m,x)=>Math.max(m,+x.number||0),0)+1).padStart(3,'0');
    const total=lines.reduce((s,x)=>s+(+x.quantity||0),0);
    const modelOptions=productOptions(p,'models');
    const materialOptions=productOptions(p,'materials');
    const sizeOptions=productOptions(p,'sizes');
    const sleeveOptions=productOptions(p,'sleeves');
    const collarOptions=productOptions(p,'collars');
    const yokeOptions=productOptions(p,'yokes');
    const pocketOptions=productOptions(p,'pockets');
    const field=(label,name,value,type='text')=>editable?edit(label,name,value,type):show(label,type==='date'?date(value):value);
    const select=(label,name,rows,value,labeler,shown)=>editable?selectEdit(label,name,rows,value,labeler):show(label,shown);
    const garmentFields=editable?`${sleeveOptions.length?productPair('MANGA',productControl('sleeveName',sleeveOptions,o.sleeveName),'COR DA MANGA',fieldControl('sleeveColorId',state.colors,o.sleeveColorId,x=>x.name)):''}${collarOptions.length?productPair('GOLA',productOptionControl('collarName',collarOptions,o.collarName),'COR DA GOLA',fieldControl('collarColorId',state.colors,o.collarColorId,x=>x.name)):''}${yokeOptions.length?productPair('PALA',productOptionControl('yokeName',yokeOptions,o.yokeName),'COR DA PALA',fieldControl('yokeColorId',state.colors,o.yokeColorId,x=>x.name)):''}`:`${sleeveOptions.length?productPair('MANGA',`<b>${esc(o.sleeveName)||'—'}</b>`,'COR DA MANGA',`<b>${esc(o.sleeveColorName)||'—'}</b>`):''}${collarOptions.length?productPair('GOLA',`<b>${esc(o.collarName)||'—'}</b>`,'COR DA GOLA',`<b>${esc(o.collarColorName)||'—'}</b>`):''}${yokeOptions.length?productPair('PALA',`<b>${esc(o.yokeName)||'—'}</b>`,'COR DA PALA',`<b>${esc(o.yokeColorName)||'—'}</b>`):''}`;
    return `<article class="order-document oc-reference"><header class="oc-header"><div class="oc-brand"><span class="oc-mark">OC</span><div><strong>ORDEM DE CORTE</strong><small>CONTROLE DE PRODUÇÃO</small></div></div><div class="oc-title"><span>Nº ${number}</span></div></header><section class="oc-top-row">${field('DATA','issueDate',o.issueDate||new Date().toISOString().slice(0,10),'date')}${field('ENTREGA','deliveryDate',o.deliveryDate||'','date')}${field('ORDEM DE COMPRA CLIENTE','purchaseOrder',o.purchaseOrder||'')}</section><section class="oc-client-row">${select('CLIENTE','clientId',state.clients,o.clientId,x=>x.name,o.clientName)}${select('FACÇÃO','workshopId',state.workshops,o.workshopId,x=>x.name,o.workshopName)}</section><section class="oc-production-box"><div class="oc-product-row oc-product-main">${select('PRODUTO','productId',state.products,o.productId,productLabel,productLabel(p)||o.productName)}${modelOptions.length?(editable?productSelect('MODELO','modelName',modelOptions,o.modelName):show('MODELO',o.modelName)):''}${materialOptions.length?(editable?productSelect('TECIDO','materialName',materialOptions,o.materialName):show('TECIDO',o.materialName)):''}${select('COR','colorId',state.colors,o.colorId,x=>x.name,o.colorName)}</div>${garmentFields?`<div class="oc-product-row oc-product-garment">${garmentFields}</div>`:''}<div class="oc-product-row oc-product-extra">${select('TIPO DE IMPRESSÃO','printTypeId',state.printTypes,o.printTypeId,x=>x.name,o.printTypeName)}${pocketOptions.length?(editable?productSelect('BOLSOS','pocketName',pocketOptions,o.pocketName):show('BOLSOS',o.pocketName)):''}</div><div class="oc-product-row oc-product-secondary">${editable?textEdit('DETALHE','detailName',o.detailName||''):show('DETALHE',o.detailName)}${editable?textEdit('OBSERVAÇÕES','notes',o.notes||''):show('OBSERVAÇÕES',o.notes)}</div>${sizeOptions.length?`<div class="oc-size-zone"><div class="oc-sizes" id="doc-grade-rows">${sizes(lines,editable,sizeOptions)}</div>${editable?'<div class="oc-size-controls" aria-label="Controles de tamanhos"><button id="doc-add" type="button" title="Adicionar tamanho" aria-label="Adicionar tamanho">＋</button><button id="doc-remove-last" type="button" title="Excluir último tamanho" aria-label="Excluir último tamanho">−</button></div>':''}</div>`:''}</section><footer class="oc-total"><span>TOTAL DE PEÇAS</span><strong id="doc-total">${total}</strong></footer>${editable?`<input type="hidden" name="status" value="${esc(orderStatus(o))}">`:''}</article>`;
   }

  const baseDocumentHtml=documentHtml;documentHtml=(...args)=>baseDocumentHtml(...args).replace('CONTROLE DE PRODUÇÃO','O R D E M  D E   C O R T E');
  window.updateDocTotal=function(){
    const root=[...document.querySelectorAll('.overlay')].at(-1)||document;
    const total=[...root.querySelectorAll('#doc-grade-rows .oc-size-item')].reduce((s,r)=>s+(+r.querySelector('.quantity')?.value||0),0);
    const el=root.querySelector('#doc-total');
    if(el)el.textContent=total;
  };

  window.openOrder=function(id){
    const baseOrder=state.orders.find(x=>x.id===id)||{},sourceQuote=orderSourceQuote(baseOrder),o=!baseOrder.deliveryDate&&sourceQuote?.deliveryTime?{...baseOrder,deliveryDate:sourceQuote.deliveryTime}:baseOrder;
    modal(`<div class="modal-head"><div><small>ORDEM DE CORTE</small><h2>${id?'EDITAR ORDEM '+String(o.number).padStart(3,'0'):'NOVA ORDEM DE CORTE'}</h2></div><div class="order-toolbar"><button type="button" onclick="closeModal()">×</button></div></div><form id="order-form" class="order-form document-form"><div class="document-stage" id="document-stage">${documentHtml(o,true)}</div><div class="order-form-actions"><button type="button" onclick="closeModal()">CANCELAR</button><button type="button" class="primary" id="order-save">SALVAR ORDEM</button></div></form>`);
    document.querySelector('.modal').classList.add('order-modal');
    const form=document.querySelector('#order-form'),stage=document.querySelector('#document-stage');
    let currentOrder={...o,status:orderStatus(o)},saving=false;

    const setup=()=>{
      const box=document.querySelector('#doc-grade-rows'),productSelect=form.querySelector('[name="productId"]');
      const renumber=()=>{[...box.children].forEach((row,i)=>{row.dataset.line=i;row.querySelector('.size').setAttribute('aria-label',`Tamanho ${i+1}`);row.querySelector('.quantity').setAttribute('aria-label',`Quantidade do tamanho ${i+1}`)})};
      const addSizeButton=document.querySelector('#doc-add'),removeSizeButton=document.querySelector('#doc-remove-last');
      if(addSizeButton)addSizeButton.onclick=()=>{const product=state.products.find(x=>x.id===productSelect.value)||{},sizeOptions=productOptions(product,'sizes');box.insertAdjacentHTML('beforeend',sizes([{quantity:0,size:''}],true,sizeOptions));renumber();box.lastElementChild.querySelector('.size').focus();updateDocTotal()};
      if(removeSizeButton)removeSizeButton.onclick=()=>{if(box.children.length<=1){toast('A ordem deve manter pelo menos um tamanho.');return}box.lastElementChild.remove();renumber();updateDocTotal()};
      productSelect.onchange=()=>{currentOrder={...currentOrder,...formValues(form),productId:productSelect.value,lines:[{quantity:0,size:''}]};stage.innerHTML=documentHtml(currentOrder,true);setup();window.dispatchEvent(new CustomEvent('order-product-changed',{detail:{form,product:state.products.find(x=>x.id===productSelect.value)}}));};
    };

    const saveOrder=async()=>{
      if(saving)return;
      saving=true;
      const button=document.querySelector('#order-save'),original=button?.textContent;
      if(button){button.disabled=true;button.textContent='SALVANDO...'}
      try{
        const d=formValues(form);
        const client=state.clients.find(x=>x.id===d.clientId);
        const product=state.products.find(x=>x.id===d.productId);
        const color=state.colors.find(x=>x.id===d.colorId);
        const sleeveColor=state.colors.find(x=>x.id===d.sleeveColorId);
        const collarColor=state.colors.find(x=>x.id===d.collarColorId);
        const yokeColor=state.colors.find(x=>x.id===d.yokeColorId);
        const printType=state.printTypes.find(x=>x.id===d.printTypeId);
        const workshop=state.workshops.find(x=>x.id===d.workshopId);
        const lines=[...document.querySelectorAll('#doc-grade-rows .oc-size-item')].map(r=>({quantity:+r.querySelector('.quantity').value||0,size:r.querySelector('.size').value.trim()}));
        const total=lines.reduce((s,x)=>s+x.quantity,0);
        const productSnapshot={...(product||{}),image:d.orderImage||product?.image||''};
        delete d.orderImage;
        Object.assign(d,{status:d.status==='Impressa'?'Impressa':'Aberta',clientName:client?.name||'',productName:productLabel(product),modelId:'',modelName:d.modelName||'',colorName:color?.name||'',detailId:'',detailName:d.detailName||'',materialId:'',materialName:d.materialName||'',sleeveName:d.sleeveName||'',sleeveColorName:sleeveColor?.name||'',collarName:d.collarName||'',collarColorName:collarColor?.name||'',yokeName:d.yokeName||'',yokeColorName:yokeColor?.name||'',printTypeName:printType?.name||'',artName:'',pocketName:d.pocketName||'',workshopName:workshop?.name||'',productSnapshot,lines,total});
        await api(`/api/orders${id?'/'+id:''}`,{method:id?'PUT':'POST',body:JSON.stringify(d)});
        closeModal();
        state.view='orders';
        await load();
        toast('Ordem salva no banco local.');
      }catch(error){
        toast(error.message||'Não foi possível salvar a ordem.');
        if(button){button.disabled=false;button.textContent=original}
        saving=false;
      }
    };

    setup();
    form.onsubmit=e=>{e.preventDefault();saveOrder()};
    const saveButton=document.querySelector('#order-save');
    saveButton.onclick=saveOrder;
    saveButton.addEventListener('click',saveOrder);
  };

  window.printOrder=function(id){
    const o=state.orders.find(x=>x.id===id);
    if(!o)return toast('Salve a ordem antes de imprimir.');
    const w=open('','_blank','width=900,height=1000');
    if(!w)return toast('O navegador bloqueou a janela de impressão.');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ordem de Corte ${esc(o.number)}</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/oc-reference-layout.css"></head><body class="print-body">${documentHtml(o,false)}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    w.document.close();
  };
})();
