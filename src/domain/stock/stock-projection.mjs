// Canonical read model. Only stock-service mutates physical balances.
export function stockProjection(repository){
  const products=repository.listProducts().filter(p=>p.active!==false);
  const warehouses=repository.listWarehouses().filter(w=>w.active!==false);
  const balances=new Map(repository.listBalances().map(b=>[`${b.productId}::${b.warehouseId}`,Number(b.quantity)||0]));
  const reserved=new Map();
  for(const r of repository.listReservations?.()??[]){
    if(r.status!=='ACTIVE')continue;
    const key=`${r.productId}::${r.warehouseId}`;
    reserved.set(key,(reserved.get(key)??0)+Number(r.quantity||0));
  }
  const positions=new Map();
  for(const p of repository.listStockPositions?.()??[]){
    if(p.active===false)continue;
    const key=`${p.productId}::${p.warehouseId}`;
    positions.set(key,(positions.get(key)??0)+Number(p.quantity||0));
  }
  return products.flatMap(product=>warehouses.map(warehouse=>{
    const key=`${product.id}::${warehouse.id}`;
    const physical=balances.get(key)??0;
    const committed=reserved.get(key)??0;
    const tracked=positions.get(key)??0;
    const minStock=Number(product.minStock||0);
    const avgCost=Number(product.avgCost??product.unitCost??0);
    return {productId:product.id,warehouseId:warehouse.id,physical,reserved:committed,available:physical-committed,tracked,unlocated:physical-tracked,minStock,lowStock:minStock>0&&physical-committed<minStock,avgCost,value:Number((physical*avgCost).toFixed(2))};
  }));
}
