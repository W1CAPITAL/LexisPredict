/** O resultado exibido deve representar a execução ATUAL.
 * DataJud não confirmado + DJEN OK é PARCIAL; não equivale a Both OK.
 * Os estados salvos no CRM não são eventos de consulta.
 */
export function scanSourceLogMessage(
 item:{success?:boolean;datajudOk?:boolean;djenOk?:boolean;error?:string|null},
 mode:'datajud'|'djen'|'both'
):string{
 const datajud=item.datajudOk===true;
 const djen=item.djenOk===true;
 if(item.success!==true){
  return 'Falha de consulta · '+String(item.error||'fontes indisponíveis').slice(0,140);
 }
 if(mode==='datajud')
  return datajud?'DataJud: consulta oficial confirmada':'DataJud: sem confirmação oficial; verificar fonte';
 if(mode==='djen')
  return djen?'DJEN: consulta oficial confirmada':'DJEN: sem confirmação oficial; verificar fonte';
 if(datajud&&djen)return 'DataJud e DJEN: consultas oficiais confirmadas';
 if(datajud)return 'Consulta PARCIAL · DataJud: OK · DJEN: não confirmado; reconsultar DJEN';
 if(djen)return 'Consulta PARCIAL · DataJud: não confirmado · DJEN: OK; reconsultar DataJud';
 return 'Consulta sem confirmação de fontes oficiais; verificar falhas';
}
