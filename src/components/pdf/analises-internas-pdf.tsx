import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export type AnalisePdfRow = {
  id: string;
  protocolo_ref: string | null;
  categoria: string | null;
  descricao: string | null;
  origem: string | null;
  data_atividade: string | null;
  nivel_conferencia: string | null;
};
export type AtividadePdfRow = {
  id: string;
  titulo: string | null;
  categoria: string | null;
  descricao: string | null;
  data_realizacao: string | null;
  protocolo_ref: string | null;
};
export type AcaoPdfRow = {
  id: string;
  action: string;
  created_at: string | null;
  protocolo_ref: string | null;
};
export type AnalisesPessoaisPdfData = {
  nome: string;
  geradoEm: string;
  filtros: { busca: string; categoria: string };
  paginas: { analises: number; atividades: number; acoes: number };
  totais: { analises: number; atividades: number; acoes: number; documentais: number };
  analises: AnalisePdfRow[];
  atividades: AtividadePdfRow[];
  acoes: AcaoPdfRow[];
};

const C = {
  navy: "#101C34", navy2: "#1D3152", purple: "#8057C8", blue: "#3475D8",
  cyan: "#61BCCC", green: "#149889", ink: "#24324C", muted: "#64748B",
  border: "#DAE3EF", bg: "#F4F7FC", white: "#FFFFFF", rose: "#C35785",
};

const s = StyleSheet.create({
  cover: { backgroundColor: C.white, fontFamily: "Helvetica", color: C.ink, paddingBottom: 50 },
  coverHero: { backgroundColor: C.navy, paddingTop: 48, paddingBottom: 42, paddingHorizontal: 42 },
  topMark: { fontSize: 10, fontWeight: 700, letterSpacing: 2.1, color: C.cyan, marginBottom: 19 },
  heroTitle: { fontSize: 32, fontWeight: 700, color: C.white, lineHeight: 1.12 },
  heroSubtitle: { fontSize: 12, color: "#D4E1F6", marginTop: 13, lineHeight: 1.5 },
  chipRow: { flexDirection: "row", marginTop: 23 },
  chip: { paddingVertical: 7, paddingHorizontal: 10, backgroundColor: C.navy2, borderRadius: 6, marginRight: 7 },
  chipText: { fontSize: 8, color: C.white, fontWeight: 700 },
  coverBody: { paddingHorizontal: 42, paddingTop: 31 },
  eyebrow: { fontSize: 8, fontWeight: 700, letterSpacing: 1.8, color: C.purple, marginBottom: 6 },
  heading: { fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 5 },
  paragraph: { fontSize: 9, color: C.muted, lineHeight: 1.5 },
  kpis: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 20 },
  kpi: { width: "48.5%", backgroundColor: C.bg, borderColor: C.border, borderWidth: 1, borderRadius: 9, padding: 14, marginBottom: 9, borderLeftWidth: 4 },
  kpiNumber: { fontSize: 25, fontWeight: 700, color: C.navy },
  kpiLabel: { fontSize: 8, color: C.muted, marginTop: 6, lineHeight: 1.3 },
  section: { marginTop: 21 },
  trackRow: { flexDirection: "row", alignItems: "center", marginTop: 11 },
  trackLabel: { width: 105, fontSize: 8, color: C.ink },
  track: { flex: 1, height: 8, backgroundColor: "#DFE7F2", borderRadius: 5, overflow: "hidden" },
  trackCount: { width: 42, textAlign: "right", fontSize: 8, color: C.ink, fontWeight: 700 },
  note: { backgroundColor: "#F1F0FB", borderLeftWidth: 3, borderLeftColor: C.purple, borderRadius: 6, padding: 12, marginTop: 19 },
  noteText: { fontSize: 8.5, lineHeight: 1.5, color: C.ink },
  detailsPage: { backgroundColor: C.white, fontFamily: "Helvetica", color: C.ink, paddingHorizontal: 40, paddingTop: 84, paddingBottom: 56 },
  detailBanner: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: C.navy, height: 64, paddingTop: 23, paddingHorizontal: 40, flexDirection: "row", justifyContent: "space-between" },
  bannerBrand: { color: C.white, fontSize: 10, fontWeight: 700, letterSpacing: 1 },
  bannerTag: { color: "#C3D5EA", fontSize: 8 },
  sectionHeader: { paddingTop: 13, borderTopWidth: 1, borderTopColor: C.border, marginTop: 16, marginBottom: 13 },
  sectionNumber: { fontSize: 8, letterSpacing: 1.5, color: C.purple, fontWeight: 700 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: C.navy, marginTop: 4 },
  sectionDesc: { fontSize: 8.5, color: C.muted, marginTop: 5, lineHeight: 1.45 },
  card: { borderWidth: 1, borderColor: C.border, borderRadius: 7, padding: 12, marginBottom: 9, backgroundColor: "#FAFCFF" },
  meta: { fontSize: 7.5, color: C.purple, fontWeight: 700, marginBottom: 5 },
  recordTitle: { fontSize: 10.5, fontWeight: 700, lineHeight: 1.33, color: C.navy },
  desc: { fontSize: 8.5, lineHeight: 1.5, color: "#46566B", marginTop: 6 },
  small: { fontSize: 7.5, color: C.muted, marginTop: 6 },
  empty: { fontSize: 9, color: C.muted, padding: 12, backgroundColor: C.bg, borderRadius: 7 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 18, flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  footerText: { fontSize: 7, color: "#7B8AA0" },
});
const fmt = (x: number) => x.toLocaleString("pt-BR");
const cat = (x: string | null) => String(x || "outro").replace(/_/g, " ");
const day = (x: string | null) => x && /^\d{4}-\d{2}-\d{2}/.test(x)
  ? x.slice(8, 10) + "/" + x.slice(5, 7) + "/" + x.slice(0, 4) : "Data não informada";
const clip = (x: string | null, size = 850) => {
  const v = String(x || "").replace(/\s+/g, " ").trim();
  return v.length > size ? v.slice(0, size).trim() + "… (descrição continua no LexisPredict)" : v;
};
function Footer() {
  return <View fixed style={s.footer}>
    <Text style={s.footerText}>LEXISPREDICT  /  HISTÓRICO PESSOAL  •  USO INTERNO</Text>
    <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>;
}
function RecordSection({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  return <View style={s.sectionHeader} wrap={false}>
    <Text style={s.sectionNumber}>{id}  /  HISTÓRICO INDIVIDUAL</Text>
    <Text style={s.sectionTitle}>{title}</Text>
    <Text style={s.sectionDesc}>{subtitle}</Text>
  </View>;
}
function Meter({ title, count, total, color }: { title: string; count: number; total: number; color: string }) {
  return <View style={s.trackRow}>
    <Text style={s.trackLabel}>{title}</Text>
    <View style={s.track}><View style={{ height: 8, backgroundColor: color, borderRadius: 5, width: (total ? Math.max(count > 0 ? 2 : 0, count / total * 100) : 0) + "%" }} /></View>
    <Text style={s.trackCount}>{fmt(count)}</Text>
  </View>;
}
export function AnalisesPessoaisPdf({ data }: { data: AnalisesPessoaisPdfData }) {
  const { totais } = data;
  const max = Math.max(1, totais.analises, totais.atividades, totais.acoes);
  const filters = [data.filtros.busca ? `Busca: ${data.filtros.busca}` : "Todos os CNJs",
    data.filtros.categoria ? `Categoria: ${cat(data.filtros.categoria)}` : "Todas as categorias"];
  return <Document title="LexisPredict - Análises e atividades pessoais"
    author="LexisPredict" subject="Exportação individual protegida da carteira jurídica">
    <Page size="A4" style={s.cover}>
      <View style={s.coverHero}>
        <Text style={s.topMark}>L E X I S P R E D I C T    /    I N S I G H T S</Text>
        <Text style={s.heroTitle}>Minhas análises{"\n"}e atividades</Text>
        <Text style={s.heroSubtitle}>Relatório pessoal de produção, auditorias e ações registradas.{"\n"}Dados extraídos exclusivamente da conta autenticada.</Text>
        <View style={s.chipRow}>
          <View style={s.chip}><Text style={s.chipText}>{data.nome}</Text></View>
          <View style={s.chip}><Text style={s.chipText}>{day(data.geradoEm)}</Text></View>
        </View>
      </View>
      <View style={s.coverBody}>
        <Text style={s.eyebrow}>01  /  VISÃO EXECUTIVA</Text>
        <Text style={s.heading}>Seu histórico em números</Text>
        <Text style={s.paragraph}>Os indicadores abaixo representam tipos distintos de registro. As ações técnicas não são classificadas como análises jurídicas e tampouco comprovam contato humano.</Text>
        <View style={s.kpis}>
          {[
            { label: "Análises documentadas no filtro", value: totais.analises, color: C.purple },
            { label: "Atividades manuais registradas", value: totais.atividades, color: C.blue },
            { label: "Ações operacionais (edição/atendimento)", value: totais.acoes, color: C.cyan },
            { label: "Auditorias documentais atribuídas", value: totais.documentais, color: C.green },
          ].map(k => <View key={k.label} style={[s.kpi, { borderLeftColor: k.color }]}>
            <Text style={s.kpiNumber}>{fmt(k.value)}</Text><Text style={s.kpiLabel}>{k.label}</Text>
          </View>)}
        </View>
        <View style={s.section}>
          <Text style={s.eyebrow}>02  /  DISTRIBUIÇÃO DAS FONTES</Text>
          <Text style={s.heading}>Origem dos registros</Text>
          <Meter title="Análises" count={totais.analises} total={max} color={C.purple} />
          <Meter title="Atividades" count={totais.atividades} total={max} color={C.blue} />
          <Meter title="Ações operacionais" count={totais.acoes} total={max} color={C.cyan} />
        </View>
        <View style={s.note}>
          <Text style={s.noteText}>ESCOPO DO DOCUMENTO • {filters.join(" • ")}. Este PDF contém as páginas selecionadas no LexisPredict: análises {data.paginas.analises}, atividades {data.paginas.atividades} e ações {data.paginas.acoes}. Os totais representam os filtros, enquanto as listas detalhadas correspondem somente às páginas indicadas.</Text>
        </View>
      </View>
      <Footer />
    </Page>
    <Page size="A4" style={s.detailsPage} wrap>
      <View fixed style={s.detailBanner}><Text style={s.bannerBrand}>LEXISPREDICT  /  EVIDÊNCIAS</Text><Text style={s.bannerTag}>HISTÓRICO PESSOAL</Text></View>
      <RecordSection id="03" title="Análises documentadas"
        subtitle="Trabalho analítico registrado explicitamente na conta. Não equivale a resultado judicial definitivamente confirmado." />
      {data.analises.length ? data.analises.map((row, i) =>
        <View key={row.id || String(i)} style={s.card} wrap={false}>
          <Text style={s.meta}>{day(row.data_atividade)}  ·  {cat(row.categoria)}  ·  {cat(row.nivel_conferencia)}</Text>
          <Text style={s.recordTitle}>{row.protocolo_ref || "Projeto ou investigação sem CNJ"}</Text>
          {row.descricao ? <Text style={s.desc}>{clip(row.descricao)}</Text> : null}
          {row.origem ? <Text style={s.small}>Fonte: {clip(row.origem, 150)}</Text> : null}
        </View>
      ) : <Text style={s.empty}>Nenhuma análise documentada nesta página ou seleção.</Text>}
      <RecordSection id="04" title="Atividades registradas"
        subtitle="Atividades lançadas manualmente, preservando sua categoria original. Um atendimento não é contado automaticamente como análise." />
      {data.atividades.length ? data.atividades.map((row, i) =>
        <View key={row.id || String(i)} style={s.card} wrap={false}>
          <Text style={s.meta}>{day(row.data_realizacao)}  ·  {cat(row.categoria)}  ·  registro manual</Text>
          <Text style={s.recordTitle}>{clip(row.titulo || "Atividade sem título", 190)}</Text>
          {row.descricao ? <Text style={s.desc}>{clip(row.descricao)}</Text> : null}
          {row.protocolo_ref ? <Text style={s.small}>CNJ: {row.protocolo_ref}</Text> : null}
        </View>
      ) : <Text style={s.empty}>Nenhuma atividade manual nesta página ou seleção.</Text>}
      <RecordSection id="05" title="Ações operacionais"
        subtitle="Ações técnicas atribuídas à conta: edições e registros de atendimento. Não são certificações de atos jurídicos." />
      {data.acoes.length ? data.acoes.map((row, i) =>
        <View key={row.id || String(i)} style={s.card} wrap={false}>
          <Text style={s.meta}>{row.created_at ? new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Data indisponível"}</Text>
          <Text style={s.recordTitle}>{row.action === "edicao" ? "Edição no aplicativo" : "Atendimento registrado"}</Text>
          <Text style={s.small}>Processo: {row.protocolo_ref || "sem CNJ vinculado"}</Text>
        </View>
      ) : <Text style={s.empty}>Nenhuma ação operacional nesta página ou seleção.</Text>}
      <View style={s.note} wrap={false}>
        <Text style={s.noteText}>METODOLOGIA • Apenas registros vinculados à empresa e à identidade autenticada do colaborador. Nenhum dado de outra pessoa foi incluído. Descrições extensas podem ser abreviadas para leitura; consulte o histórico no sistema para o texto integral. Os totais não equivalem a quantidade de processos únicos.</Text>
      </View>
      <Footer />
    </Page>
  </Document>;
}
