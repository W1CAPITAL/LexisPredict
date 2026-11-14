import {describe,it,expect} from "vitest";
import {toPersistedWorkflowSteps} from "./workflow-bridge";

describe("integrated workflows from the evidence engine",()=>{
 const workflow={
  steps:[
   {id:"check_djen",title:"Revisar publicação",detail:"Conferir documento",priority:"high",owner:"controladoria",evidence:"DJEN",requiresHumanReview:true},
   {id:"check_djen",title:"Duplicada",detail:"Não duplicar",priority:"normal",owner:"operacao",evidence:"",requiresHumanReview:true},
   {id:"check_enforcement",title:"Cumprimento",detail:"Conferir teor",priority:"critical",owner:"advogado",evidence:"Sentença",requiresHumanReview:true},
  ]
 } as any;
 it("deduplicates by step id and never invents a due date",()=>{
  const rows=toPersistedWorkflowSteps(workflow,"00000000020268260001","company","actor",23);
  expect(rows).toHaveLength(2);
  expect(rows.every(x=>x.due_at===null&&x.status==="pendente")).toBe(true);
  expect(rows[0].priority).toBe("alta");
  expect(rows[1].priority).toBe("critica");
  expect(rows[0].processo_id).toBe(23);
 });
});
