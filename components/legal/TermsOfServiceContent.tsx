import React from 'react';

export function TermsOfServiceContent() {
  return (
    <div className="space-y-6 text-sm text-foreground/80 leading-relaxed font-sans max-h-[60vh] overflow-auto pr-4 scrollbar-thin">
      <h2 className="text-lg font-black uppercase tracking-tighter text-foreground">TERMO DE USO, LICENÇA DE SOFTWARE E LIMITAÇÃO DE RESPONSABILIDADE</h2>
      <p className="text-[10px] font-bold text-muted-foreground uppercase">LexisPredict — W1 Capital | Última atualização: 24 de julho de 2026</p>

      <section className="space-y-3">
        <p><strong>Licenciante:</strong> W1 Capital Assessoria Financeira Ltda. e/ou Davi Alves Figueredo (“W1”).</p>
        <p><strong>Contato:</strong> w1capitalassessoria@protonmail.com</p>
        <p><strong>Licenciado:</strong> quem cria conta ou usa o LexisPredict (“Você”).</p>
      </section>

      <p className="p-3 bg-secondary/30 border-l-4 border-primary font-bold text-xs uppercase">
        Ao marcar “Li e aceito” ou usar o serviço, Você concorda com este Termo. Se não concordar, não utilize.
      </p>

      <div className="space-y-4">
        <p><strong>1. DEFINIÇÕES</strong><br />
        1.1 Software/LexisPredict: app, módulos, código, UI, marca, documentação.<br />
        1.2 Conteúdo do Usuário: dados, PDFs, planilhas, observações inseridas por Você.<br />
        1.3 Conta: credenciais de acesso.<br />
        1.4 Serviço: SaaS conforme plano.<br />
        1.5 Indicadores automatizados: scores, probabilidade, alertas — natureza auxiliar e estimativa.</p>

        <p><strong>2. OBJETO</strong><br />
        2.1 Ferramenta de apoio operacional (carteira, retornos, documentos assistidos).<br />
        2.2 Não é advocacia, consultoria vinculante, garantia de êxito, certidão de tribunal nem substituto do dever de diligência.<br />
        2.3 Decisões são exclusivas do Usuário e profissionais habilitados.</p>

        <p><strong>3. PROPRIEDADE INTELECTUAL</strong><br />
        3.1 Titularidade exclusiva W1 / Davi Alves Figueredo.<br />
        3.2 Licença limitada, revogável, não exclusiva, intransferível, não sublicenciável. Sem transferência de propriedade.<br />
        3.3 Vedado: copiar, modificar, engenharia reversa, remover avisos, revender, white-label sem contrato, copiar fluxos para concorrente, compartilhar senhas.<br />
        3.4 Uso não autorizado pode gerar medidas cíveis e criminais.</p>

        <p><strong>4. CONTA E SEGURANÇA</strong><br />
        4.1 Dados de cadastro verdadeiros.<br />
        4.2 Você é responsável por senha, token e ações na Conta (inclusive de prepostos).<br />
        4.3 W1 pode suspender por risco, abuso ou violação.<br />
        4.4 W1 pode recusar ou encerrar cadastros por uso indevido ou inadimplemento.</p>

        <p><strong>6. DADOS E LGPD</strong><br />
        6.1 Você titular do Conteúdo do Usuário.<br />
        6.2 Licença à W1 só para hospedar/processar o necessário ao Serviço.<br />
        6.3 Você garante base legal para dados de terceiros (LGPD).<br />
        6.4 Usuário/empresa é controlador operacional da carteira; W1 prestadora técnica, salvo acordo escrito.<br />
        6.5 Proibido conteúdo ilícito.<br />
        6.6 Mantenha backups próprios. W1 não é único repositório legítimo.</p>

        <p className="bg-red-50 dark:bg-red-950/30 p-4 border-2 border-red-100 dark:border-red-900/30 text-red-900 dark:text-red-200">
          <strong>7. PRAZOS (CLÁUSULA ESSENCIAL)</strong><br />
          7.1 Controle de prazos é dever EXCLUSIVO do Usuário.<br />
          7.2 Datas/alertas/filas baseiam-se em dados fornecidos e podem falhar.<br />
          7.3 W1 NÃO responde por perda de prazo, preclusão, multa, prejuízo processual ou falha de contato.<br />
          7.4 Você deve conferir tribunais e fontes oficiais; não confiar só no Software.
        </p>

        <p><strong>11. LIMITAÇÃO DE RESPONSABILIDADE</strong><br />
        11.1 Sem responsabilidade por danos indiretos, lucros cessantes, perda de chance (na máxima extensão legal).<br />
        11.2 Salvo dolo/culpa grave ou vedação legal, teto: valores pagos nos últimos 12 meses ou R$ 500,00 (o maior).<br />
        11.3 Correção de bug não admite culpa por prazos.</p>
      </div>

      <p className="text-[10px] uppercase font-black opacity-40 pt-6">W1 Capital / Davi Alves Figueredo — LexisPredict — w1capitalassessoria@protonmail.com</p>
    </div>
  );
}
