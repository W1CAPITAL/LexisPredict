import {describe,it,expect} from "vitest";
import {getReportAccess} from "./report-access";

describe("P0: report tenant/role authorization",()=>{
 const base={auth_id:"a",empresa_id:"e"};
 it("denies every export without authentication",()=>{
  expect(getReportAccess({},'empresa').exportAllowed).toBe(false);
 });
 it("keeps operator and viewer in own non-exportable view",()=>{
  for(const cargo of ["Operador","Visualizador"]){
   const p=getReportAccess({...base,cargo},'empresa');
   expect(p.scope).toBe("meus");
   expect(p.canViewTeam).toBe(false);
   expect(p.exportAllowed).toBe(false);
  }
 });
 it("allows an administrator to export only their own portfolio",()=>{
  expect(getReportAccess({...base,cargo:"Administrador"},'meus').exportAllowed).toBe(true);
  expect(getReportAccess({...base,cargo:"Administrador"},'empresa').exportAllowed).toBe(false);
 });
 it("grants employee and company exports only to supervisor/superadmin",()=>{
  for(const p of [{...base,cargo:"Supervisor",isSupervisor:true},{...base,cargo:"Superadmin",isSuperAdmin:true}]){
   expect(getReportAccess(p,'empresa')).toMatchObject({canViewTeam:true,canExport:true,scope:'empresa',exportAllowed:true});
  }
 });
});
