import type { DocumentCase } from "@/app/actions/document-case-actions";
import type { PartePessoa } from "@/lib/partes-editaveis";
import type { PecaMeta } from "@/lib/pecas-modelos";

/** Projeta somente valores que realmente constam da carteira. Não infere classe, vara ou comarca. */
export function clientAsParte(item: DocumentCase): PartePessoa {
  return {
    nome:item.cliente,cpf:item.cpf,rg:item.rg,email:item.email,telefone:item.telefone,
    endereco:item.endereco,nacionalidade:item.nacionalidade,estado_civil:item.estadoCivil,
    estadoCivil:item.estadoCivil,profissao:item.profissao,
  };
}
export function clientAsPecaMeta(item:DocumentCase): PecaMeta {
  return {
    protocolo:item.cnj,cliente:item.cliente,cpfCliente:item.cpf,rgCliente:item.rg,
    nacionalidadeCliente:item.nacionalidade,estadoCivilCliente:item.estadoCivil,
    profissaoCliente:item.profissao,enderecoCliente:item.endereco,telefoneCliente:item.telefone,
    emailCliente:item.email,banco:item.banco,cnpjBanco:item.cnpjBanco,
    tribunal:item.tribunal,comarca:item.comarca,orgao:item.orgaoJulgador,
    classeAcao:item.classeAcao,tipoAcao:item.classeAcao,
    includeBanco:Boolean(item.banco),
  };
}
