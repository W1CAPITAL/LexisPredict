import type {HermesStalledSummary} from '@/lib/hermes-company-service';

/** Conta exclusivamente os estados de monitoramento registrados pelo Hermes.
 * Uma consulta parcial não comprova que o processo está parado.
 */
export function summarizeHermesStalled(rows:readonly HermesStalledSummary[]){
 return {
  total:rows.length,
  confirmedIdle:rows.filter(row=>row.state==='confirmed_idle').length,
  recent:rows.filter(row=>row.state==='recent_movement').length,
  partial:rows.filter(row=>row.state==='partial').length,
  unavailable:rows.filter(row=>row.state==='unavailable').length,
 };
}
