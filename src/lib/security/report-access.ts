import {canExportOperationalData} from "@/lib/roles";

export type ReportPrincipal={
 auth_id?:string|null;empresa_id?:string|null;cargo?:string|null;role?:string|null;
 isSupervisor?:boolean;isSuperAdmin?:boolean;
};
export type ReportScope="empresa"|"meus";

/** Only supervisor and superadmin may receive tenant-wide staff and case metrics.
 * A UI filter is not an authorization boundary: use this from the server too.
 */
export function getReportAccess(ctx:ReportPrincipal,requestedScope:ReportScope){
 const loggedIn=Boolean(ctx.auth_id&&ctx.empresa_id);
 const canViewTeam=loggedIn&&Boolean(ctx.isSupervisor||ctx.isSuperAdmin);
 const canExport=loggedIn&&canExportOperationalData(ctx);
 const scope:ReportScope=canViewTeam&&requestedScope==="empresa"?"empresa":"meus";
 return {
  canViewTeam,canExport,scope,
  exportAllowed:canExport&&(requestedScope==="meus"||canViewTeam),
  // Backend must enforce even if the caller changes ?escopo= by hand.
  requestedScopeAllowed:requestedScope==="meus"||canViewTeam,
 };
}
