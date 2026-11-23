/** Pure helper shared by progressive lists. */
export function nextAutoListCount(current:number,total:number,step:number):number{
 const safeTotal=Number.isFinite(total)?Math.max(0,Math.floor(total)):0;
 const safeCurrent=Number.isFinite(current)?Math.max(0,Math.floor(current)):0;
 const safeStep=Number.isFinite(step)?Math.max(1,Math.floor(step)):1;
 return Math.min(safeTotal,safeCurrent+safeStep);
}
