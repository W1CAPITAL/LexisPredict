const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error("LexisPredict Commercial: variáveis ausentes:", missing.join(", "));
  process.exit(1);
}
if (String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").startsWith("ey") === false) {
  console.warn("Aviso: confira se SUPABASE_SERVICE_ROLE_KEY é a chave correta do projeto.");
}
console.log("LexisPredict Commercial: configuração mínima OK.");
