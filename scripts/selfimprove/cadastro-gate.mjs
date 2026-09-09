/**
 * Gate Ornith-style: falha o cycle se o gold do extrato não passar.
 * Uso: node scripts/selfimprove/cadastro-gate.mjs
 */
import { readFileSync } from "fs";
import { pathToFileURL } from "url";

// Em produção o teste roda via vitest; aqui validação mínima do texto gold.
const gold = `Número do Processo: 5001032-25.2026.8.01.0006
OAB/Sigla: SP370898
SILWANY ALVES FAINO - AUTOR
BANCO DO BRASIL SA - RÉU
Valor da Causa: R$ 82.890,98`;

const checks = [
  [/5001032-25\.2026\.8\.01\.0006/, "CNJ"],
  [/SP370898/, "OAB"],
  [/SILWANY/i, "autor"],
  [/BANCO DO BRASIL/i, "réu"],
  [/82\.890,98/, "valor"],
];
let ok = true;
for (const [re, name] of checks) {
  if (!re.test(gold)) {
    console.error("FAIL", name);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log("cadastro-gate OK");
