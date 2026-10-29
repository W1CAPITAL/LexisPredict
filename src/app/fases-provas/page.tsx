import FasesProvasClient from "./fases-provas-client";
// Não bloqueia o primeiro paint consultando milhares de processos em série.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default function FasesProcessuaisPage() { return <FasesProvasClient />; }
