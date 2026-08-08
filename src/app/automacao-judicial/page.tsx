import { redirect } from "next/navigation";

/** Alias legado → Cadastro unificado (antiga Sincronia IA · DataJud · DJEN) */
export default function AutomacaoJudicialRedirect() {
  redirect("/ia-sync");
}
