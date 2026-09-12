import { executeOcr } from '@artisys/ocr';
import { DomainError } from '../domain/shared/domain-error.mjs';

function extractCandidates(text='') {
  const source=String(text);
  const invoiceNumber=source.match(/(?:NF(?:-?e)?|nota(?:\s+fiscal)?)\s*(?:n[ºo°.]?\s*)?[:#-]?\s*([A-Z0-9./-]{2,})/i)?.[1]??null;
  const document=source.match(/\b(?:CNPJ|CPF)\s*[:.-]?\s*([0-9./-]{11,18})/i)?.[1]??null;
  const totalRaw=source.match(/(?:total|valor\s+total)\s*[:R$\s]*([0-9.]+,[0-9]{2}|[0-9]+\.[0-9]{2})/i)?.[1]??null;
  const total=totalRaw==null?null:Number(totalRaw.replace(/\./g,'').replace(',','.'));
  const date=source.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)?.[1]??null;
  return {invoiceNumber,document,total:Number.isFinite(total)?total:null,date};
}

export function createOcrAdapter({providers={}}={}) {
  const available=()=>Object.values(providers).some((provider)=>typeof provider?.recognize==='function');
  return {
    available,
    async recognize(input={}) {
      if(!available()) throw new DomainError('OCR_UNAVAILABLE','local OCR provider is unavailable');
      try {
        const result=await executeOcr(providers,{...input,environment:'native',prefer:'auto'});
        return {...result,candidates:extractCandidates(result.text),reviewed:false};
      } catch(error) {
        if(error instanceof DomainError) throw error;
        throw new DomainError('OCR_FAILED','OCR processing failed',{cause:String(error?.message??error)});
      }
    }
  };
}
