import { describe, expect, it } from 'vitest';
import { shouldRetryPendingCloudSources, cloudSourceCooldownMs } from './cloud-scan-recovery';

describe('P0: recuperar somente fontes oficiais pendentes', () => {
  it('faz uma passagem adicional após percorrer toda a fila quando há DataJud/DJEN pendente', () => {
    expect(shouldRetryPendingCloudSources({processed:0,pending:40,retryPass:0})).toBe(true);
    expect(shouldRetryPendingCloudSources({processed:0,pending:40,retryPass:1})).toBe(false);
  });
  it('não reinicia fila enquanto o worker processa ou quando falta métrica confiável', () => {
    expect(shouldRetryPendingCloudSources({processed:1,pending:40,retryPass:0})).toBe(false);
    expect(shouldRetryPendingCloudSources({processed:0,pending:0,retryPass:0})).toBe(false);
    expect(shouldRetryPendingCloudSources({processed:0,pending:null,retryPass:0})).toBe(false);
  });
  it('respeita 429 e erros do tribunal, sem bloquear uma consulta saudável', () => {
    expect(cloudSourceCooldownMs([{datajudError:'O tribunal pediu pausa (429)'}])).toBe(45000);
    expect(cloudSourceCooldownMs([{datajudError:'Tribunal instável (shard).'}])).toBe(15000);
    expect(cloudSourceCooldownMs([{datajudError:'Tempo esgotado no tribunal.'}])).toBe(7000);
    expect(cloudSourceCooldownMs([{djenError:'HTTP 429 — limite de consultas'}])).toBe(45000);
    expect(cloudSourceCooldownMs([{djenError:'Timeout ao consultar DJEN'}])).toBe(7000);
    expect(cloudSourceCooldownMs([{datajudError:null,djenError:null}])).toBe(0);
  });
});
