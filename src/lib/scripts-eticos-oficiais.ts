/**
 * Biblioteca de scripts oficiais éticos (nunca “causa ganha”).
 * Placeholders: {{nome}}, {{empresa}}, {{fase}}, {{protocolo}}
 */

export type ScriptEtico = {
  id: string;
  titulo: string;
  fase: string;
  texto: string;
};

export const SCRIPTS_ETICOS: ScriptEtico[] = [
  {
    id: "abertura",
    titulo: "Abertura de contato",
    fase: "qualquer",
    texto:
      "Bom dia, {{nome}}. Sou da {{empresa}}. Vou te explicar exatamente em que fase está o seu caso e o que isso significa na prática. Pode interromper a qualquer momento. Não prometemos resultado judicial — trabalhamos com transparência e o que está no contrato.",
  },
  {
    id: "diagnostico",
    titulo: "Entrega do diagnóstico",
    fase: "diagnostico",
    texto:
      "{{nome}}, concluímos a análise do seu contrato. Há pontos que merecem atenção técnica. Isso NÃO é garantia de êxito em juízo — é um parecer para você decidir com informação. Posso te explicar as opções: só extrajudicial ou extrajudicial com possibilidade de judicial depois, se você autorizar por escrito.",
  },
  {
    id: "extra_para_judicial",
    titulo: "Extrajudicial → judicial (consentimento)",
    fase: "consentimento_judicial",
    texto:
      "{{nome}}, você contratou a tentativa extrajudicial. Ela foi feita e documentada. Como o banco não avançou em boa-fé negociável, a opção judicial existe, mas envolve custas, prazos do Judiciário e risco de sucumbência. Quer que eu explique o contrato de honorários do advogado e os custos antes de você decidir?",
  },
  {
    id: "demora",
    titulo: "Demora / sem prazo garantido",
    fase: "judicial",
    texto:
      "{{nome}}, o prazo depende exclusivamente do juiz e da vara. Nós acompanhamos e avisamos quando houver movimentação relevante. Não existe prazo garantido de decisão.",
  },
  {
    id: "citacao",
    titulo: "Explicar citação (não é vitória)",
    fase: "judicial",
    texto:
      "{{nome}}, a citação é apenas a notificação oficial para a parte contrária entrar no processo. Não é sentença e não significa vitória. O processo segue com prazos de defesa e decisões do juiz.",
  },
  {
    id: "custas",
    titulo: "Custas e justiça gratuita",
    fase: "judicial",
    texto:
      "{{nome}}, as custas são despesas do Poder Judiciário. Se a justiça gratuita for indeferida, elas precisam ser pagas para o processo continuar. O valor varia por estado — posso indicar a tabela oficial. A decisão de seguir ou desistir é sua, por escrito.",
  },
  {
    id: "distribuicao",
    titulo: "Distribuição do processo",
    fase: "judicial",
    texto:
      "{{nome}}, o processo foi distribuído a uma vara. O juiz analisará a petição inicial. Ainda não há decisão de mérito.",
  },
  {
    id: "contestacao",
    titulo: "Contestação do banco",
    fase: "judicial",
    texto:
      "{{nome}}, o banco apresentou defesa. O advogado analisará e, se necessário, fará réplica. Isso é etapa normal — não significa derrota nem vitória.",
  },
  {
    id: "relatorio_mensal",
    titulo: "Relatório de transparência (sem movimento)",
    fase: "qualquer",
    texto:
      "{{nome}}, relatório de transparência: neste período não houve movimentação relevante no tribunal/banco. Continuamos no acompanhamento conforme o contrato. Qualquer novidade você recebe aviso objetivo, sem linguagem de “fase final”.",
  },
];

export function preencherScript(
  script: ScriptEtico,
  vars: { nome?: string; empresa?: string; fase?: string; protocolo?: string }
): string {
  return script.texto
    .replace(/\{\{nome\}\}/g, vars.nome || "cliente")
    .replace(/\{\{empresa\}\}/g, vars.empresa || "nossa equipe")
    .replace(/\{\{fase\}\}/g, vars.fase || "")
    .replace(/\{\{protocolo\}\}/g, vars.protocolo || "");
}
