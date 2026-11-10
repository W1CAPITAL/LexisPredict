/** Endereços oficiais CNJ; nunca incluir token, CPF, CNPJ ou certificado nos links. */
export const OFFICIAL_JUDICIAL_SERVICES = {
  djen: {
    label: 'Diário de Justiça Eletrônico Nacional — DJEN',
    portal: 'https://comunica.pje.jus.br',
    api: 'https://comunicaapi.pje.jus.br/api/v1/comunicacao',
    swagger: 'https://comunicaapi.pje.jus.br/swagger/index.html',
    publicRead: true,
  },
  domicilio: {
    label: 'Domicílio Judicial Eletrônico — PDPJ/CNJ',
    portal: 'https://domicilio-eletronico.pdpj.jus.br',
    documentation: 'https://docs.pdpj.jus.br/servicos-negociais/domicilio-judicial-eletronico/',
    requiresInstitutionalCredentials: true,
    mayRegisterReceipt: true,
  },
} as const;
