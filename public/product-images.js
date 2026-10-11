(function(){
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const baseOpenEntity=window.openEntity;
  const baseOpenOrder=window.openOrder;
  const basePrintOrder=window.printOrder;
  const optionGroups=[
    ['models','Modelos','Novo modelo'],
    ['materials','Tecidos','Novo tecido'],
    ['sleeves','Mangas','Nova manga'],
    ['pockets','Bolsos','Novo bolso'],
    ['sizes','Tamanhos','Novo tamanho']
  ];
  let orderFormDirty=false;
  window.requestOrderClose=function(){if(orderFormDirty&&!confirm('Existem alterações não salvas. Deseja descartá-las e voltar ao menu principal?'))return false;orderFormDirty=false;closeModal();return true};
  function normalizeProductImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Formato de imagem inválido.'));img.onload=()=>{const limit=1200,ratio=Math.min(1,limit/Math.max(img.naturalWidth,img.naturalHeight)),scan=document.createElement('canvas');scan.width=Math.max(1,Math.round(img.naturalWidth*ratio));scan.height=Math.max(1,Math.round(img.naturalHeight*ratio));const sctx=scan.getContext('2d',{willReadFrequently:true});sctx.drawImage(img,0,0,scan.width,scan.height);const pixels=sctx.getImageData(0,0,scan.width,scan.height).data;let minX=scan.width,minY=scan.height,maxX=-1,maxY=-1;for(let y=0;y<scan.height;y++){for(let x=0;x<scan.width;x++){const i=(y*scan.width+x)*4,a=pixels[i+3],colored=a>12&&(pixels[i]<244||pixels[i+1]<244||pixels[i+2]<244);if(colored){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}}}if(maxX<minX||maxY<minY){minX=0;minY=0;maxX=scan.width-1;maxY=scan.height-1}const margin=Math.max(8,Math.round(Math.max(maxX-minX,maxY-minY)*.035));minX=Math.max(0,minX-margin);minY=Math.max(0,minY-margin);maxX=Math.min(scan.width-1,maxX+margin);maxY=Math.min(scan.height-1,maxY+margin);const sx=minX/ratio,sy=minY/ratio,sw=(maxX-minX+1)/ratio,sh=(maxY-minY+1)/ratio,out=document.createElement('canvas');out.width=1600;out.height=900;const ctx=out.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);const padding=42,scale=Math.min((out.width-padding*2)/sw,(out.height-padding*2)/sh),dw=sw*scale,dh=sh*scale,dx=(out.width-dw)/2,dy=(out.height-dh)/2;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);resolve(out.toDataURL('image/png'))};img.src=String(reader.result||'')};reader.readAsDataURL(file)})}
  window.openEntity=function(id){
    if(state.view!=='products')return baseOpenEntity(id);
    const item=state.products.find(x=>x.id===id)||{};
    const values=key=>Array.isArray(item[key])?item[key].filter(Boolean):(item[key]?[item[key]]:[]);
    const optionRow=(key,value='',index=0)=>`<div class="product-option-row" data-option-row><input name="${key}" value="${safe(value)}" placeholder="${safe(optionGroups.find(x=>x[0]===key)?.[2]||'Novo item')}" aria-label="Item ${index+1}"><button type="button" class="danger" data-remove-option title="Excluir">×</button></div>`;
    const optionCard=([key,label])=>`<article class="product-option-card" data-option-group="${key}"><header><b>${safe(label)}</b><button type="button" data-add-option="${key}">＋ Incluir</button></header><div class="product-option-list">${(values(key).length?values(key):['']).map((value,index)=>optionRow(key,value,index)).join('')}</div></article>`;
    modal(`<div class="modal-head"><div><small>CADASTRO</small><h2>${id?'Editar':'Novo'} produto</h2></div><button onclick="closeModal()">×</button></div><form id="entity-form" class="product-form"><label>Nome do produto<input name="name" value="${safe(item.name)}" required></label><div class="product-image-editor"><div class="product-image-preview" id="product-image-preview">${item.image?`<img src="${safe(item.image)}" alt="Imagem atual do produto">`:'<span>Sem imagem</span>'}</div><div class="product-image-actions"><label class="product-upload">Selecionar imagem<input id="product-image-file" type="file" accept="image/png,image/jpeg,image/webp"></label><button id="product-image-remove" type="button">Remover imagem</button><small>Use uma imagem contendo frente e verso. PNG, JPG ou WebP.</small></div></div><section class="product-option-editor"><div><small>OPÇÕES DO PRODUTO</small><h3>Pré-cadastros usados na Ordem de Corte</h3></div>${optionGroups.map(optionCard).join('')}</section><footer><button type="button" onclick="closeModal()">Cancelar</button><button class="primary">Salvar</button></footer></form>`);
    let imageValue=item.image||'',pendingData='';
    const preview=document.querySelector('#product-image-preview'),file=document.querySelector('#product-image-file');
    file.onchange=async()=>{const selected=file.files?.[0];if(!selected)return;if(selected.size>8*1024*1024){toast('A imagem deve ter no máximo 8 MB.');file.value='';return}preview.innerHTML='<span>Padronizando imagem…</span>';try{pendingData=await normalizeProductImage(selected);preview.innerHTML=`<img src="${pendingData}" alt="Pré-visualização padronizada do produto">`;toast('Imagem ajustada ao padrão do produto.')}catch(error){pendingData='';file.value='';preview.innerHTML='<span>Sem imagem</span>';toast(error.message)}};
    document.querySelector('#product-image-remove').onclick=()=>{imageValue='';pendingData='';file.value='';preview.innerHTML='<span>Sem imagem</span>'};
    document.querySelectorAll('[data-add-option]').forEach(button=>button.onclick=()=>{const key=button.dataset.addOption,list=button.closest('[data-option-group]').querySelector('.product-option-list');list.insertAdjacentHTML('beforeend',optionRow(key,'',list.children.length));list.lastElementChild.querySelector('input').focus()});
    document.querySelector('#entity-form').addEventListener('click',event=>{const button=event.target.closest('[data-remove-option]');if(!button)return;const list=button.closest('.product-option-list');if(list.children.length<=1){button.closest('[data-option-row]').querySelector('input').value='';return}button.closest('[data-option-row]').remove()});
    document.querySelector('#entity-form').onsubmit=async e=>{e.preventDefault();const data=formValues(e.target);delete data.image;for(const [key] of optionGroups)data[key]=[...document.querySelectorAll(`[name="${key}"]`)].map(input=>input.value.trim()).filter(Boolean);if(pendingData){const uploaded=await api('/api/upload',{method:'POST',body:JSON.stringify({data:pendingData})});imageValue=uploaded.url}data.image=imageValue;data.id=item.id;await api(`/api/products${id?'/'+id:''}`,{method:id?'PUT':'POST',body:JSON.stringify(data)});closeModal();await load();toast('Produto salvo com sucesso.')};
  };

  function visualHtml(image){return `<div class="oc-product-visual"><div class="oc-product-visual-label"><span>DESENHO DO PRODUTO</span><label class="product-upload">ENVIAR IMAGEM<input id="order-image-file" type="file" accept="image/png,image/jpeg,image/webp"></label></div><figure>${image?`<img src="${safe(image)}" alt="Desenho do produto">`:'<div class="oc-product-image-empty">A imagem do produto aparecerá aqui</div>'}</figure><input type="hidden" name="orderImage" value="${safe(image)}"></div>`}
  function bindOrderImageUpload(root){
    const file=root.querySelector('#order-image-file'),hidden=root.querySelector('[name="orderImage"]'),visual=root.querySelector('.oc-product-visual figure');
    if(!file||!hidden||!visual)return;
    file.onchange=async()=>{const selected=file.files?.[0];if(!selected)return;if(selected.size>8*1024*1024){toast('A imagem deve ter no máximo 8 MB.');file.value='';return}visual.innerHTML='<div class="oc-product-image-empty">Padronizando imagem…</div>';try{const normalized=await normalizeProductImage(selected),uploaded=await api('/api/upload',{method:'POST',body:JSON.stringify({data:normalized})});hidden.value=uploaded.url;visual.innerHTML=`<img src="${safe(uploaded.url)}" alt="Desenho do produto">`;orderFormDirty=true;toast('Imagem da ordem atualizada. Salve a ordem para gravar.')}catch(error){file.value='';visual.innerHTML=hidden.value?`<img src="${safe(hidden.value)}" alt="Desenho do produto">`:'<div class="oc-product-image-empty">A imagem do produto aparecerá aqui</div>';toast(error.message)}};
  }
  function mountOrderVisual(root,product,image){
    const anchor=root.querySelector('.oc-product-secondary');if(!anchor)return;
    root.querySelector('.oc-product-visual')?.remove();anchor.insertAdjacentHTML('afterend',visualHtml(image||product?.image||''));bindOrderImageUpload(root);
  }
  window.openOrder=function(id){
    baseOpenOrder(id);
    const form=document.querySelector('#order-form'),productSelect=form?.querySelector('[name="productId"]');if(!form||!productSelect)return;
    orderFormDirty=false;
    const overlay=document.querySelector('#overlay'),toolbar=document.querySelector('.order-toolbar'),backButton=toolbar?.querySelector('button:last-child'),cancelButton=document.querySelector('.order-form-actions button:first-child'),heading=document.querySelector('.order-modal .modal-head h2');
    if(overlay)overlay.onmousedown=e=>{if(e.target===overlay)toast('Use “Menu principal” para sair com segurança.')};
    if(backButton){backButton.classList.add('order-back');backButton.innerHTML='← <span>Menu principal</span>';backButton.removeAttribute('onclick');backButton.onclick=requestOrderClose}
    if(cancelButton){cancelButton.classList.add('order-discard');cancelButton.textContent='Descartar e voltar';cancelButton.removeAttribute('onclick');cancelButton.onclick=requestOrderClose}
    if(heading)heading.insertAdjacentHTML('afterend','<p class="order-modal-hint">Dados gerais · Produto · Tamanhos e quantidades</p>');
    const order=state.orders.find(x=>x.id===id)||{},initialProduct=state.products.find(x=>x.id===productSelect.value),initialImage=order.productSnapshot?.image||initialProduct?.image||'';
    const sync=()=>mountOrderVisual(form,state.products.find(x=>x.id===productSelect.value));mountOrderVisual(form,initialProduct,initialImage);productSelect.addEventListener('change',sync);
    window.addEventListener('order-product-changed',event=>{if(event.detail?.form)mountOrderVisual(event.detail.form,event.detail.product)});
    form.addEventListener('input',()=>orderFormDirty=true);form.addEventListener('change',()=>orderFormDirty=true);form.querySelector('#doc-add')?.addEventListener('click',()=>orderFormDirty=true);form.querySelector('#doc-remove-last')?.addEventListener('click',()=>orderFormDirty=true);
  };
  window.printOrder=async function(id){
    const order=state.orders.find(x=>x.id===id);if(!order)return toast('Salve a ordem antes de imprimir.');
    if(orderStatus(order)!=='Impressa'){
      try{
        const updated=await api(`/api/orders/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({...order,status:'Impressa'})});
        Object.assign(order,updated);
        state.orders=state.orders.map(x=>x.id===id?updated:x);
        const list=document.querySelector('#order-list');if(list)list.innerHTML=orderTable(filteredOrders());
      }catch(error){
        toast(error.message||'Não foi possível marcar a ordem como impressa.');
        return;
      }
    }
    document.querySelector('#order-print-frame')?.remove();
    const frame=document.createElement('iframe');frame.id='order-print-frame';frame.title='Impressão da ordem de corte';frame.style.cssText='position:fixed;left:-300vw;top:0;width:210mm;height:297mm;border:0;';frame.src=`/print/orders/${encodeURIComponent(id)}?embedded=1&v=${encodeURIComponent(order.updatedAt||Date.now())}`;document.body.appendChild(frame);
    const cleanup=event=>{if(event.origin===location.origin&&event.data?.type==='order-print-complete'){frame.remove();window.removeEventListener('message',cleanup)}};window.addEventListener('message',cleanup);setTimeout(()=>{if(frame.isConnected){frame.remove();window.removeEventListener('message',cleanup)}},120000);
    toast('Abrindo a impressão…');
  };
  window.downloadOrderPdf=function(id){
    const order=state.orders.find(x=>x.id===id);if(!order)return toast('Salve a ordem antes de gerar o PDF.');
    const button=document.activeElement instanceof HTMLButtonElement?document.activeElement:null,original=button?.textContent;
    if(button){button.disabled=true;button.textContent='GERANDO PDF…'}
    fetch(`/api/orders/${encodeURIComponent(id)}/pdf`).then(async response=>{if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||'Não foi possível gerar o PDF.')}const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`Ordem-de-Corte-${String(order.number||'').padStart(3,'0')}.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('PDF gerado e baixado com sucesso.')}).catch(error=>toast(error.message)).finally(()=>{if(button){button.disabled=false;button.textContent=original}});
  };
})();
