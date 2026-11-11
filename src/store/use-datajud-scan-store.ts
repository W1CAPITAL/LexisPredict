          },
        },
      };
    });
  },

  runInitialHealthCheck: async (protocols) => {
    const targets=new Map<string,string>();
    for(const raw of protocols){
      const cnj=String(raw||'').replace(/\D/g,'');
      const alias=resolveDataJudAlias(cnj);
      if(alias&&!targets.has(alias))targets.set(alias,cnj);
    }
    for(const [alias,cnj] of [...targets.entries()].slice(0,8)){
      const result=await probeDataJudHealthAction(cnj);
      if(result.errorCode==='terms_restricted'){
        set({courtHealthMap:{}});
        get().addLog({
          protocolo:'SISTEMA',
          message:'Auditoria DataJud não executada: os termos da API pública não autorizam este uso comercial. O sucesso do DJEN não será contado como sucesso DataJud.',
          latency:0,success:false,type:'error',engine:'Local',source:'DataJud',
        });
        return;
      }
      const latency=Number(result.latencyMs)||0;
      get().updateCourtHealth(alias,latency,result.success);
      get().addLog({
        protocolo:cnj,
        message:result.success
          ?'DataJud '+alias.toUpperCase()+' respondeu; '+(result.found?'processo localizado':'processo não localizado no índice')+'; '+(result.movementCount||0)+' movimento(s).'
          :String(result.message||'DataJud não confirmou a consulta para '+alias.toUpperCase()+'.'),
        latency,success:result.success,type:result.success?'ok':'error',engine:'Nuvem',source:'DataJud',
      });
    }
  },

  restoreCloudScan: (empresaId,userId) => {
    if(get().status!=='idle')return;
    const cp=loadCloudCheckpoint(empresaId,userId);
    if(!cp?.startedAt||!/^[0-9]*$/.test(String(cp.cursor||'')))return;
    set({status:'paused',isMinimized:false,cloudTenantId:empresaId,cloudUserId:userId,
      cloudStartedAt:String(cp.startedAt),cloudCursorId:String(cp.cursor||''),
      done:Number(cp.done||0),total:Number(cp.total||0),
      cloudSuccesses:Number(cp.successes||0),cloudFailures:Number(cp.failures||0),
      cloudPartials:Number(cp.partials||0),
      cloudAttempts:Number(cp.attempts||cp.done||0),cloudRetryPass:Number(cp.retryPass||0),