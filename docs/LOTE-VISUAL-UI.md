# Lote visual — 14/09/2026

Base: W1CAPITAL/LexisPredict, commit 4990d653eb01b156a3257bfb84a7b6411a951438.

## Aplicação

Extraia na raiz de uma branch de revisão, preservando as pastas. O ZIP contém apenas oito arquivos alterados e este documento. Se os mesmos arquivos mudaram depois dessa base, mescle as diferenças. Revise o diff e execute npm run build em Node 24 antes de publicar. Não houve push nem deploy. Nenhuma dependência, migração ou variável de ambiente nova.

## Alterações

- Cores semânticas configuradas no Tailwind e modo escuro pela classe do tema.
- Retiradas regras globais que forçavam fundo branco, verde fixo e sombras em qualquer caixa arredondada.
- Cards compartilhados sem deslocamento no hover, títulos mais sóbrios, tabelas compactas e campos com 44 px no celular.
- Configurações com cabeçalho compacto, busca identificada, sem atalhos duplicados e melhor aproveitamento da largura.
- Planos em uma coluna nas telas estreitas e duas no desktop, benefícios legíveis e plano atual visível.
- Mensal/anual acessível, equivalente anual com centavos e troca entre Financeiro e Operacional identificada como troca de pacotes.
- Operadores só consultam; ação de alteração e autorização do servidor preservadas.
- Retiradas promessas incorretas de auditoria no Essencial e relatório financeiro no Operacional.

## Preços e escopo

Preços cadastrados preservados: Essencial R$ 197/mês e R$ 1.970/ano; Operacional R$ 397/mês e R$ 3.970/ano; Financeiro R$ 297/mês e R$ 2.970/ano; Máximo R$ 597/mês e R$ 5.970/ano. Não foi informada uma nova tabela comercial. Faturamento real não foi validado.

Menu horizontal opcional preservado. A remoção do OmniRoute, revisão específica de painel/filas/scanner e correções operacionais ficam para lotes seguintes. Alterações temporárias anteriores não estão neste pacote.

## Verificação

Este pacote foi recriado após expirar o ambiente temporário. TypeScript e ESLint dos arquivos alterados passaram novamente; 86 testes passaram em 15 arquivos.

Na verificação anterior do mesmo desenho, componentes reais de planos, cards, campo e tabela foram renderizados no Chromium com dados e ações simulados. Em 390, 768 e 1440 px: sem overflow horizontal da página, botões dos planos com pelo menos 44 px e temas claro/escuro e alternância anual funcionando. A verificação de navegador não foi repetida na recriação.

Não foi validado login, cobrança real, toda a aplicação autenticada ou build de produção no Vercel. A verificação usou Node 20; o deploy deve usar Node 24 conforme package.json.

## Arquivos e SHA-256

- src/app/globals-lexis-premium.css: 71834c3e1f16d4d92b554fde32ca91be99257ba227f68dbdc4415f3d5dfc60a5
- src/app/settings/page.tsx: 7bce378ef7825b6cc10637fda4d36ccf39a46eb6387cf3fd17beea951cd03d45
- src/components/settings/planos-empresa-panel.tsx: 8fef11b0e16ee1b26df92b4ec9d87be962f31f56a5eed781f071641796f9d1a7
- src/components/ui/card.tsx: 9fe706a45e91fa09c64ce87a554d0c784c5d2f4a9402b9e1daf1922b7c9981a5
- src/components/ui/input.tsx: f2f64eef321777b3e635e53e948703f2335ff575e690976dde390ea4bcc91485
- src/components/ui/table.tsx: c616d29178186577cc2bcc913c34af9e9bafbaa884f9c72191455111e5074545
- src/lib/planos-precos.ts: b0e9ba4ca9d974b4dbfe19ec0551d2878af3c377db12f2e89a8de629901ece52
- tailwind.config.ts: 042bd4ba68d8b11f057cfb38322df089b3101d77b4d09549db0a8ad799ce14a6
