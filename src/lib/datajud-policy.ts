/** Policy gate for the CNJ DataJud public API.
 * Production use remains off unless the intended use is formally authorized.
 */
export function isDataJudUseAuthorized():boolean{
 return typeof process!=='undefined'&&process.env?.DATAJUD_USE_AUTHORIZED==='true';
}
