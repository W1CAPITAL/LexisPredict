/**
 * Compactação progressiva, sob demanda, apenas no dispositivo do usuário.
 * Evita carregar PNGs de vários MB na Server Action (HTTP 413).
 * O original permanece disponível com o usuário; o Lexis envia a miniatura
 * para interpretação, nunca a trata como prova superior ao documento original.
 */
export async function prepareOmniImage(file:File):Promise<{
  mediaType:'image/jpeg';data:string;name:string
}>{
  if(!/^image\/(?:jpeg|png|gif|webp)$/.test(file.type))
    throw Error('Imagem não suportada.');
  if(file.size>35*1024*1024)throw Error('Imagem excede 35 MB. Reduza antes de anexar.');
  if(typeof document==='undefined')throw Error('Compactação requer navegador.');
  const bitmap=await createImageBitmap(file);
  try{
    const maxSide=1550,scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('Não foi possível preparar a imagem neste dispositivo.');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    // 8-bit JPEG, max 1.55 MP ~= <1 MB na maioria dos prints.
    const uri=canvas.toDataURL('image/jpeg',.72);
    if(uri.length>2_000_000)
      throw Error('Imagem continua grande para envio. Recorte ou reduza a resolução.');
    return {name:file.name,mediaType:'image/jpeg',data:uri.split(',')[1]};
  }finally{bitmap.close()}
}
