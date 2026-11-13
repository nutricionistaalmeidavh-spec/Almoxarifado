import bwipjs from 'bwip-js';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { buildStockRows, buildLabels } from './report-service.mjs';

const A4=[595.28,841.89];
const safe=value=>String(value??'').replace(/[^\x20-\xFF]/g,' ').slice(0,116);

export async function exportStockPdf(repository){
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  let page=pdf.addPage(A4),y=790;
  const header=()=>{page.drawText('ArtiSys | Posicao de estoque',{x:40,y,size:16,font:bold,color:rgb(.06,.1,.19)});y-=36;};
  header();
  for(const row of buildStockRows(repository)){
    if(y<65){page=pdf.addPage(A4);y=790;header();}
    const line=[row.sku,row.product,row.warehouse,'Qtd '+row.quantity+' '+row.unit,'R$ '+Number(row.value).toFixed(2)].join(' | ');
    page.drawText(safe(line),{x:40,y,size:9,font});y-=19;
  }
  return Buffer.from(await pdf.save());
}
export async function exportStockXlsx(repository){
  const book=new ExcelJS.Workbook();book.creator='ArtiSys Almoxarifado';
  const sheet=book.addWorksheet('Estoque');
  sheet.columns=[
    {header:'SKU',key:'sku',width:20},
    {header:'Código de barras',key:'barcode',width:24},
    {header:'Produto',key:'product',width:45},
    {header:'Depósito',key:'warehouse',width:28},
    {header:'Quantidade',key:'quantity',width:18},
    {header:'Unidade',key:'unit',width:12},
    {header:'Estoque mínimo',key:'minStock',width:20},
    {header:'Custo médio',key:'unitCost',width:18},
    {header:'Valor',key:'value',width:20}
  ];
  sheet.addRows(buildStockRows(repository));
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0F172A'}};
  sheet.autoFilter={from:'A1',to:'I1'};
  sheet.views=[{state:'frozen',ySplit:1}];
  for(const col of ['H','I'])sheet.getColumn(col).numFmt='"R$" #,##0.00';
  return Buffer.from(await book.xlsx.writeBuffer());
}
export async function exportLabelsPdf(repository,{format='code128'}={}){
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const labels=buildLabels(repository);
  let page;
  if(!labels.length){page=pdf.addPage(A4);page.drawText('Sem produtos para etiquetar',{x:40,y:790,font,size:12});}
  for(let i=0;i<labels.length;i++){
    if(i%16===0)page=pdf.addPage(A4);
    const col=i%2,row=Math.floor((i%16)/2),x=38+col*276,y=806-row*98;
    page.drawRectangle({x,y:y-86,width:258,height:91,borderWidth:0.5,borderColor:rgb(.65,.7,.77)});
    page.drawText(safe(labels[i].name).slice(0,36),{x:x+12,y:y-13,size:10,font:bold});
    page.drawText(safe(labels[i].sku),{x:x+12,y:y-27,size:8,font});
    const text=String(labels[i].barcode||labels[i].sku);
    const png=await bwipjs.toBuffer({bcid:format==='qr'?'qrcode':'code128',text,scale:2,height:12,includetext:false});
    const image=await pdf.embedPng(png);
    const size=image.scale(Math.min(220/image.width,53/image.height));
    page.drawImage(image,{x:x+12,y:y-83,width:size.width,height:size.height});
  }
  return Buffer.from(await pdf.save());
}
