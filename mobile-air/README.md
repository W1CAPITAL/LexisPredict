# LexisPredict Android AIR

Cliente Android ARM64 do LexisPredict, baseado na arquitetura AIR + ANE usada no port movel do Naruto Online.

## Como funciona

- AIR 51.3.x com runtime cativo.
- ANE Android proprio com WebView nativo.
- Cookies, sessao, localStorage e cache permanecem no aparelho.
- O APK nao contem .env, chave Supabase, service role, token de IA, WA.Auto ou Evolution.
- O APK conhece somente a URL publica do LexisPredict.
- Server Actions, APIs, banco, IA e integracoes continuam executando no backend hospedado.
- Links externos sao encaminhados ao aplicativo Android apropriado.
- Downloads usam o DownloadManager do Android.
- O botao Voltar navega o historico do app antes de fechar.
- Erro de rede mostra uma tela offline dentro do proprio aplicativo.

## Build

O workflow .github/workflows/build-lexispredict-apk.yml gera:

LexisPredict_AIR_ARM64_1.0.0.apk

O certificado deste prototipo e criado no build, seguindo a mesma estrategia do Naruto AIR. Para distribuicao permanente, usar um keystore persistente guardado apenas no CI.
