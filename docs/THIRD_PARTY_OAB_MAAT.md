# Origem e licença — importação assistida por OAB

O recurso `src/lib/oab-discovery.ts` e o fluxo de `src/components/scanner/oab-discovery-panel.tsx` foram adaptados conceitualmente do projeto [MAAT Monitor](https://github.com/Dramorimrodrigues/maat-monitor), especialmente de `maat/descoberta_oab.py` e `maat/cnj.py`. Autor: Márcio Luis Amorim, 2026. Licença MIT.

Diferenças no LexisPredict: o usuário cola resultados de portais oficiais; nenhum CAPTCHA, sessão ou certificado é acessado; números são validados pelo algoritmo CNJ do próprio LexisPredict corrigido para módulo 97; resultados são apenas locais e não são inseridos automaticamente na carteira.

## Aviso de copyright e licença MIT da origem

MIT License

Copyright (c) 2026 Márcio Luis Amorim

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
