#!/usr/bin/env node
/**
 * Gera data/processed/assistencia_tecnica.json a partir dos dois relatórios de
 * assistência técnica publicados em dados.vianaemoura.com.br:
 *   - chamadosAssistenciaTecnica3.csv    (1 linha por item/problema relatado num chamado)
 *   - historicoChamadosAssistenciaTecnica.csv (1 linha por mudança de status de um chamado)
 *
 * ATENÇÃO — mesmo critério de privacidade da saúde ocupacional e das não
 * conformidades de segurança: a planilha de origem tem nome do cliente
 * (Solicitante) e texto livre da avaliação de campo (Avaliacao/Problema com
 * detalhe do imóvel). Este script NUNCA grava nome de cliente nem texto
 * livre — só contagens e médias agregadas. "Usuário" no histórico é da
 * equipe interna (quem atendeu o chamado), não do cliente — mantido, no
 * mesmo espírito de liderancas.json (ranking de desempenho interno já
 * exibido no site).
 *
 * Uso:
 *   node data/scripts/extrair_assistencia_tecnica.mjs
 *   node data/scripts/extrair_assistencia_tecnica.mjs chamados.csv historico.csv   # a partir de arquivos já baixados
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const URL_CHAMADOS = "https://dados.vianaemoura.com.br/s3/VMC/Obra/chamadosAssistenciaTecnica3.csv/dI5sHbHXI";
const URL_HISTORICO = "https://dados.vianaemoura.com.br/s3/VMC/Obra/historicoChamadosAssistenciaTecnica.csv/dI5sHbHXI";

const [argChamados, argHistorico] = process.argv.slice(2);

async function baixarCsv(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (extrair_assistencia_tecnica.mjs)" } });
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
  return res.text();
}

function lerCsvTexto(texto) {
  const wb = XLSX.read(texto, { type: "string", raw: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
}

async function lerCsv(caminhoLocal, url) {
  if (caminhoLocal) {
    const { readFileSync } = await import("fs");
    return lerCsvTexto(readFileSync(caminhoLocal, "utf8"));
  }
  return lerCsvTexto(await baixarCsv(url));
}

function col(header, nome) {
  const i = header.indexOf(nome);
  if (i === -1) throw new Error(`Coluna "${nome}" não encontrada`);
  return i;
}

function dataValida(s) {
  const v = String(s ?? "").trim();
  if (!v || v === "0000-00-00") return null;
  return v; // já vem em ISO (YYYY-MM-DD) na planilha
}
function diffDias(deIso, ateIso) {
  const a = new Date(`${deIso}T00:00:00`), b = new Date(`${ateIso}T00:00:00`);
  return Math.round((b - a) / 86400000);
}
function media(nums) {
  return nums.length ? Math.round((nums.reduce((a, v) => a + v, 0) / nums.length) * 10) / 10 : null;
}
function pct(num, den) {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}

const STATUS_CONCLUIDO = "Realizado";
const STATUS_NAO_PROCEDENTE = "Finalizado Não Procedente";
const STATUS_CANCELADO = new Set(["Cancelado", "Excluído"]);

const rowsChamados = await lerCsv(argChamados, URL_CHAMADOS);
const rowsHistorico = await lerCsv(argHistorico, URL_HISTORICO);

const H1 = rowsChamados[0];
const C = {
  id: col(H1, "ID"), tipo: col(H1, "Tipo"), tipoChamado: col(H1, "Tipo Chamado"), ugb: col(H1, "UGB"),
  problema: col(H1, "Problema"), status: col(H1, "Status"), procedente: col(H1, "Procedente"),
  gravidade: col(H1, "Gravidade"), dataAbertura: col(H1, "DataAberturaChamado"),
  prazoCombAval: col(H1, "PrazoCombAvaliacao"), prazoMaxAval: col(H1, "PrazoMaxAvaliacao"),
  dataAval: col(H1, "DataAvaliaçãoChamado"), prazoCombTermino: col(H1, "PrazoCombTermino"),
  prazoMaxTermino: col(H1, "PrazoMaxTermino"), dataTermino: col(H1, "DataTerminoChamado"),
};
// Escopo: só a UGB Caruaru (código "CA" na planilha — inclui a variante
// "CA01(2)"), que é a unidade que o restante do site cobre (ver
// gerar_resumo_obras.mjs: "Só os 4 condomínios entregues pela UGB Caruaru").
// As demais UGBs (GA, IG, SC, BJ, ITA) são outras unidades da Viana & Moura,
// fora do escopo deste site.
const itens = rowsChamados.slice(1).filter((r) => String(r[C.id] ?? "").trim() && String(r[C.ugb]).trim().toUpperCase().startsWith("CA"));

const H2 = rowsHistorico[0];
const HC = { id: col(H2, "ID"), data: col(H2, "Data"), status: col(H2, "Status"), usuario: col(H2, "Usuário") };
const idsCaruaru = new Set(itens.map((r) => String(r[C.id]).trim()));
const eventos = rowsHistorico.slice(1).filter((r) => String(r[HC.id] ?? "").trim() && idsCaruaru.has(String(r[HC.id]).trim()));

// ---------- Totais e período ----------
const idsUnicos = new Set(itens.map((r) => String(r[C.id]).trim()));
const datasAbertura = itens.map((r) => dataValida(r[C.dataAbertura])).filter(Boolean).sort();

const emAberto = itens.filter((r) => {
  const s = String(r[C.status]).trim();
  return s !== STATUS_CONCLUIDO && s !== STATUS_NAO_PROCEDENTE && !STATUS_CANCELADO.has(s);
});
const concluidos = itens.filter((r) => String(r[C.status]).trim() === STATUS_CONCLUIDO);
const naoProcedentesStatus = itens.filter((r) => String(r[C.status]).trim() === STATUS_NAO_PROCEDENTE);
const cancelados = itens.filter((r) => STATUS_CANCELADO.has(String(r[C.status]).trim()));

const avaliados = itens.filter((r) => ["Procedente", "Nao Procedente", "Sem Acordo"].includes(String(r[C.procedente]).trim()));
const procedentes = avaliados.filter((r) => String(r[C.procedente]).trim() === "Procedente");

// "Tipo" distingue chamados de casa (produção) dos de infraestrutura do
// empreendimento (ruas, calçadas, áreas comuns — não ligados a uma casa
// específica de um cliente).
const idsInfra = new Set(itens.filter((r) => String(r[C.tipo]).trim() === "Infra").map((r) => String(r[C.id]).trim()));

const temposAtendimento = concluidos
  .map((r) => {
    const de = dataValida(r[C.dataAbertura]), ate = dataValida(r[C.dataTermino]);
    return de && ate ? diffDias(de, ate) : null;
  })
  .filter((d) => d !== null && d >= 0 && d <= 730);

const totais = {
  itens_relatados: itens.length,
  chamados_unicos: idsUnicos.size,
  em_aberto: emAberto.length,
  concluidos: concluidos.length,
  nao_procedentes: naoProcedentesStatus.length,
  cancelados: cancelados.length,
  chamados_infra: idsInfra.size,
  taxa_procedencia_pct: pct(procedentes.length, avaliados.length),
  tempo_medio_atendimento_dias: media(temposAtendimento),
};

// ---------- Por status ----------
const contagemStatus = new Map();
for (const r of itens) {
  const s = String(r[C.status]).trim() || "Outros";
  contagemStatus.set(s, (contagemStatus.get(s) || 0) + 1);
}
const porStatus = [...contagemStatus.entries()].map(([status, total]) => ({ status, total })).sort((a, b) => b.total - a.total);

// ---------- Por categoria de problema ----------
const porCategoriaMap = new Map();
for (const r of itens) {
  const bruto = String(r[C.problema] ?? "");
  const cat = bruto.split(">")[0].trim() || "Não informado";
  porCategoriaMap.set(cat, (porCategoriaMap.get(cat) || 0) + 1);
}
const categoriasOrdenadas = [...porCategoriaMap.entries()].sort((a, b) => b[1] - a[1]);
const TOP_CATEGORIAS = 12;
const porCategoria = categoriasOrdenadas.slice(0, TOP_CATEGORIAS).map(([categoria, total]) => ({ categoria, total }));
const restoCategorias = categoriasOrdenadas.slice(TOP_CATEGORIAS).reduce((a, [, v]) => a + v, 0);
if (restoCategorias > 0) porCategoria.push({ categoria: "Outras categorias", total: restoCategorias });

// ---------- Por gravidade ----------
const porGravidadeMap = new Map();
for (const r of itens) {
  const g = String(r[C.gravidade]).trim();
  const label = g === "1.0" ? "1 (mais urgente)" : g === "2.0" ? "2" : g === "3.0" ? "3" : "Não informada";
  porGravidadeMap.set(label, (porGravidadeMap.get(label) || 0) + 1);
}
const porGravidade = [...porGravidadeMap.entries()].map(([gravidade, total]) => ({ gravidade, total }));

// ---------- Evolução mensal ----------
const porMesMap = new Map();
for (const iso of datasAbertura) {
  const mes = iso.slice(0, 7);
  porMesMap.set(mes, (porMesMap.get(mes) || 0) + 1);
}
const evolucaoMensal = [...porMesMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, total]) => ({ mes, total }));

// ---------- SLA ----------
function slaPct(itensFiltro, dataCol, prazoCol) {
  const validos = itensFiltro
    .map((r) => ({ data: dataValida(r[dataCol]), prazo: dataValida(r[prazoCol]) }))
    .filter((x) => x.data && x.prazo);
  const noPrazo = validos.filter((x) => x.data <= x.prazo).length;
  return { pct: pct(noPrazo, validos.length), amostra: validos.length };
}
const slaAvalComb = slaPct(itens, C.dataAval, C.prazoCombAval);
const slaAvalMax = slaPct(itens, C.dataAval, C.prazoMaxAval);
const slaTerminoComb = slaPct(concluidos, C.dataTermino, C.prazoCombTermino);
const slaTerminoMax = slaPct(concluidos, C.dataTermino, C.prazoMaxTermino);

// ---------- Tempos médios por etapa (histórico) ----------
const eventosPorId = new Map();
for (const r of eventos) {
  const id = String(r[HC.id]).trim();
  if (!eventosPorId.has(id)) eventosPorId.set(id, []);
  eventosPorId.get(id).push({ status: String(r[HC.status]).trim(), data: dataValida(r[HC.data]), usuario: String(r[HC.usuario] ?? "").trim() });
}
function primeiraData(lista, status) {
  const datas = lista.filter((e) => e.status === status && e.data).map((e) => e.data).sort();
  return datas[0] ?? null;
}
const diffsInseridoAgendado = [], diffsAgendadoAvaliado = [], diffsAvaliadoRealizado = [];
let realizadosComHistorico = 0, realizadosComPesquisa = 0;
const realizadosPorTecnico = new Map();
for (const [, lista] of eventosPorId) {
  const dIns = primeiraData(lista, "Inserido");
  const dAge = primeiraData(lista, "Agendado");
  const dAva = primeiraData(lista, "Avaliado");
  const dRea = primeiraData(lista, "Realizado");
  if (dIns && dAge && dAge >= dIns) diffsInseridoAgendado.push(diffDias(dIns, dAge));
  if (dAge && dAva && dAva >= dAge) diffsAgendadoAvaliado.push(diffDias(dAge, dAva));
  if (dAva && dRea && dRea >= dAva) diffsAvaliadoRealizado.push(diffDias(dAva, dRea));
  if (dRea) {
    realizadosComHistorico += 1;
    if (lista.some((e) => e.status === "Pesquisa Realizada")) realizadosComPesquisa += 1;
    const tecnico = lista.find((e) => e.status === "Realizado" && e.usuario)?.usuario;
    if (tecnico) realizadosPorTecnico.set(tecnico, (realizadosPorTecnico.get(tecnico) || 0) + 1);
  }
}
const porTecnico = [...realizadosPorTecnico.entries()]
  .map(([nome, realizados]) => ({ nome, realizados }))
  .sort((a, b) => b.realizados - a.realizados)
  .slice(0, 10);

const resultado = {
  atualizado_em: new Date().toISOString().slice(0, 10),
  fonte: "chamadosAssistenciaTecnica3.csv + historicoChamadosAssistenciaTecnica.csv (dados.vianaemoura.com.br) — agregado, sem nome de cliente",
  escopo: "UGB Caruaru (CA)",
  periodo: { de: datasAbertura[0] ?? null, ate: datasAbertura[datasAbertura.length - 1] ?? null },
  totais,
  por_status: porStatus,
  por_categoria: porCategoria,
  por_gravidade: porGravidade,
  evolucao_mensal: evolucaoMensal,
  sla: {
    avaliacao_no_prazo_combinado_pct: slaAvalComb.pct, avaliacao_no_prazo_combinado_amostra: slaAvalComb.amostra,
    avaliacao_no_prazo_maximo_pct: slaAvalMax.pct, avaliacao_no_prazo_maximo_amostra: slaAvalMax.amostra,
    termino_no_prazo_combinado_pct: slaTerminoComb.pct, termino_no_prazo_combinado_amostra: slaTerminoComb.amostra,
    termino_no_prazo_maximo_pct: slaTerminoMax.pct, termino_no_prazo_maximo_amostra: slaTerminoMax.amostra,
  },
  tempos_medios_dias: {
    abertura_ate_agendamento: media(diffsInseridoAgendado),
    agendamento_ate_avaliacao: media(diffsAgendadoAvaliado),
    avaliacao_ate_realizado: media(diffsAvaliadoRealizado),
  },
  pesquisa_satisfacao: { respondida_pct: pct(realizadosComPesquisa, realizadosComHistorico), amostra: realizadosComHistorico },
  por_tecnico: porTecnico,
};

const OUT = new URL("../processed/assistencia_tecnica.json", import.meta.url);
writeFileSync(OUT, JSON.stringify(resultado, null, 2), "utf8");
console.log(`Itens: ${totais.itens_relatados} | Chamados únicos: ${totais.chamados_unicos} | Em aberto: ${totais.em_aberto} | Concluídos: ${totais.concluidos}`);
console.log(`Taxa de procedência: ${totais.taxa_procedencia_pct}% | Tempo médio de atendimento: ${totais.tempo_medio_atendimento_dias} dias`);
console.log(`Gravado em ${OUT.pathname}`);
