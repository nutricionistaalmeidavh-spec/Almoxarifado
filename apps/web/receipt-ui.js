// Explicit purchase receipt confirmation (no implicit "receive everything").
export function mountPurchaseReceipts({getState,request,onSaved,notify}){
  const dialog=document.createElement('dialog');
  dialog.id='purchase-receive-dialog';
  dialog.style.cssText='max-width:min(95vw,950px);width:100%;max-height:85vh;overflow:auto;border:1px solid #cbd5e1;border-radius:12px;padding:22px';
  const form=document.createElement('form');
  const title=document.createElement('h2');title.textContent='Conferir recebimento';
  const explanation=document.createElement('p');
  explanation.textContent='Informe entregue, aceito, rejeitado e avariado. Só a quantidade aceita entra no estoque.';
  const table=document.createElement('table');table.style.width='100%';
  const error=document.createElement('p');error.setAttribute('role','alert');error.style.color='#b91c1c';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='btn secondary';cancel.textContent='Cancelar';
  const confirm=document.createElement('button');confirm.type='submit';confirm.className='btn';confirm.textContent='Registrar conferência';
  const toolbar=document.createElement('div');toolbar.className='toolbar';toolbar.append(cancel,confirm);
  form.append(title,explanation,table,error,toolbar);dialog.append(form);document.body.append(dialog);
  cancel.addEventListener('click',()=>dialog.close());
  let order=null,operationKey=null,lines=[];
  function cell(row,text){const td=document.createElement('td');td.textContent=String(text??'');row.append(td);return td;}
  function inputCell(row,key,defaultValue=0){
    const td=cell(row,'');const input=document.createElement('input');input.type='number';input.min='0';input.step='any';
    input.name=key;input.value=String(defaultValue);input.required=true;input.style.width='90px';input.setAttribute('aria-label',key);
    td.append(input);return input;
  }
  function open(id){
    order=getState().purchaseOrders.find(o=>o.id===id);
    if(!order)return notify('Pedido não encontrado.',true);
    lines=(order.items||[]).filter(x=>Number(x.pendingQuantity??x.quantity)>0);
    if(!lines.length)return notify('Nenhum item pendente.',true);
    operationKey='receipt-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    table.replaceChildren();const head=table.createTHead().insertRow();
    ['Produto','Pendente','Entregue','Aceito','Rejeitado','Avariado'].forEach(x=>cell(head,x));
    const tbody=table.createTBody();
    for(const item of lines){
      const row=tbody.insertRow();const product=getState().products.find(p=>p.id===item.productId);
      cell(row,product?.name??item.productId);
      cell(row,item.pendingQuantity??item.quantity);
      for(const key of ['quantity','acceptedQuantity','rejectedQuantity','damagedQuantity'])inputCell(row,key);
    }
    error.textContent='';confirm.disabled=false;dialog.showModal();
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!order||confirm.disabled)return;
    const rows=[...table.tBodies[0].rows],items=rows.map((row,i)=>{
      const item={productId:lines[i].productId,lineId:lines[i].lineId};
      for(const key of ['quantity','acceptedQuantity','rejectedQuantity','damagedQuantity'])item[key]=Number(row.querySelector('[name='+key+']').value);
      return item;
    });
    const errors=items.some((x,i)=>Object.values(x).some(v=>typeof v==='number'&&!Number.isFinite(v))||
      x.quantity<0||x.quantity>Number(lines[i].pendingQuantity??lines[i].quantity)||
      x.acceptedQuantity<0||x.rejectedQuantity<0||x.damagedQuantity<0||
      Math.abs(x.quantity-x.acceptedQuantity-x.rejectedQuantity-x.damagedQuantity)>1e-8);
    if(errors||!items.some(x=>x.quantity>0)){error.textContent='Informe valores válidos. Entregue deve ser igual à soma de aceito, rejeitado e avariado, respeitando o saldo pendente.';return;}
    confirm.disabled=true;confirm.textContent='Registrando...';
    try{
      const payload={operationKey,items:items.filter(x=>x.quantity>0)};
      const result=await request('/api/purchases/orders/'+encodeURIComponent(order.id)+'/receive',{method:'POST',body:JSON.stringify(payload)});
      onSaved(result);dialog.close();notify('Recebimento '+result.item.id.slice(0,8)+' registrado.');
    }catch(e){error.textContent=e.message;}
    finally{confirm.disabled=false;confirm.textContent='Registrar conferência';}
  });
  return {open};
}
