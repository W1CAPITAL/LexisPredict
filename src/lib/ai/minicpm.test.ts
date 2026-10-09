import {afterEach,describe,expect,it,vi} from 'vitest';
import { miniCpmConfig, availableMiniCpmModels, callMiniCpm, probeMiniCpm } from './minicpm';
afterEach(()=>vi.unstubAllGlobals());

describe('MiniCPM private inference bridge',()=>{
  it('requires HTTPS on production, and allows Ollama localhost during development',()=>{
    expect(miniCpmConfig({NODE_ENV:'production',MINICPM_BASE_URL:'http://127.0.0.1:11434'})).toBeNull();
    expect(miniCpmConfig({NODE_ENV:'development',MINICPM_BASE_URL:'http://127.0.0.1:11434'})?.endpoint)
      .toBe('http://127.0.0.1:11434/v1/chat/completions');
    expect(miniCpmConfig({NODE_ENV:'production',MINICPM_BASE_URL:'https://models.example.com/v1'})?.endpoint)
      .toBe('https://models.example.com/v1/chat/completions');
  });
  it('refuses to route to a different model when MiniCPM is not loaded',async()=>{
    const cfg=miniCpmConfig({NODE_ENV:'production',MINICPM_BASE_URL:'https://mini.example.com/v1'})!;
    vi.stubGlobal('fetch', vi.fn(async()=>({ok:true,json:async()=>({data:[{id:'llama-3.3'}]})})));
    expect(await availableMiniCpmModels(cfg)).toEqual([]);
  });
  it('discovers MiniCPM and sends a short OpenAI-compatible text request',async()=>{
    const fetchMock=vi.fn(async (_input:any,opts?:any)=>{
      if(!opts || opts.method==='GET') return {ok:true,json:async()=>({data:[{id:'openbmb/MiniCPM5-1B'}]})};
      return {ok:true,json:async()=>({model:'openbmb/MiniCPM5-1B',choices:[{message:{content:'Olá, tudo bem?'}}]})};
    });
    vi.stubGlobal('fetch',fetchMock);
    const old=process.env.MINICPM_BASE_URL;
    const oldModel=process.env.MINICPM_MODEL;
    try{
      process.env.MINICPM_BASE_URL='https://mini.example.com/v1';
      process.env.MINICPM_MODEL='auto';
      const output=await callMiniCpm([{role:'user',content:'Oi!'}]);
      expect(output.text).toContain('Olá');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }finally{
      if(old===undefined)delete process.env.MINICPM_BASE_URL;else process.env.MINICPM_BASE_URL=old;
      if(oldModel===undefined)delete process.env.MINICPM_MODEL;else process.env.MINICPM_MODEL=oldModel;
    }
  });
  it('does not accept vision in text-only MiniCPM',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({data:[{id:'openbmb/MiniCPM5-1B'}]})})));
    const old=process.env.MINICPM_BASE_URL;
    try{
      process.env.MINICPM_BASE_URL='https://mini.example.com/v1';
      await expect(callMiniCpm([{role:'user',content:'Veja a imagem'}],{images:[{mediaType:'image/png',data:'AA=='}]}))
        .rejects.toThrow(/MiniCPM-V/);
    }finally{if(old===undefined)delete process.env.MINICPM_BASE_URL;else process.env.MINICPM_BASE_URL=old;}
  });
});
