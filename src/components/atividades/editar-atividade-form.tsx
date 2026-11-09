import { editarTarefaRealizadaAction } from "@/app/actions/tarefas-realizadas-actions";
import { CATEGORIAS_TAREFAS_REALIZADAS } from "@/lib/tarefas-realizadas";

type AtividadeEditavel = {
  id: string | number;
  titulo: string | null;
  descricao: string | null;
  categoria: string | null;
  data_realizacao: string | null;
  protocolo_ref: string | null;
  contato_cliente_confirmado?: boolean | null;
};

export function EditarAtividadeForm({
  atividade, destino, pagina = 1, atividadesPagina = 1,
}: {
  atividade: AtividadeEditavel;
  destino: "minhas-atividades" | "analises-internas";
  pagina?: number;
  atividadesPagina?: number;
}) {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  return (
    <details className="mt-4 rounded-xl border border-border bg-card/70 open:p-4">
      <summary className="cursor-pointer select-none p-3 text-sm font-semibold text-primary open:p-0">
        Editar atividade
      </summary>
      <form action={editarTarefaRealizadaAction} className="mt-4 grid gap-3 text-sm">
        <input type="hidden" name="id" value={String(atividade.id)} />
        <input type="hidden" name="destino" value={destino} />
        <input type="hidden" name="pagina" value={pagina} />
        <input type="hidden" name="atividadesPagina" value={atividadesPagina} />
        <label className="block font-semibold">
          Título *
          <input name="titulo" required minLength={4} maxLength={180} defaultValue={atividade.titulo || ""}
            className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-normal" />
        </label>
        <label className="block font-semibold">
          Categoria *
          <select name="categoria" defaultValue={atividade.categoria || "outro"}
            className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-normal">
            {CATEGORIAS_TAREFAS_REALIZADAS.map(([valor, titulo]) =>
              <option key={valor} value={valor}>{titulo}</option>)}
          </select>
        </label>
        <label className="block font-semibold">
          Data real de execução *
          <input type="date" name="data_realizacao" required min="2020-01-01" max={hoje}
            defaultValue={String(atividade.data_realizacao || "").slice(0, 10)}
            className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-normal" />
        </label>
        <label className="block font-semibold">
          CNJ (opcional)
          <input name="protocolo_ref" defaultValue={atividade.protocolo_ref || ""}
            placeholder="0000000-00.2026.8.26.0000"
            className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-normal" />
        </label>
        <label className="block font-semibold">
          Descrição / resultado
          <textarea name="descricao" rows={4} maxLength={4000} defaultValue={atividade.descricao || ""}
            className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-normal" />
        </label>
        <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs">
          <input type="checkbox" name="contato_confirmado" value="sim"
            defaultChecked={Boolean(atividade.contato_cliente_confirmado)} />
          <span>Houve contato real com o cliente. Marque somente para Atendimento e quando houver comprovação.</span>
        </label>
        <p className="text-xs text-muted-foreground">
          O responsável original e a data de cadastro serão preservados.
        </p>
        <button type="submit" className="rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">
          Salvar alterações
        </button>
      </form>
    </details>
  );
}
