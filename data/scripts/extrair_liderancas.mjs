#!/usr/bin/env node
/**
 * Cruza a planilha "Liderança CA.xlsx" (aba "Dados": SUPERVISORES -> SUPERVISOR LÍDER;
 * versões antigas do arquivo usavam a aba "Lideres", ainda aceita como fallback)
 * com a aba CONTROLE da planilha de controle de UGB (cronograma —
 * quantidade de casas que cada supervisor vai executar no semestre) e
 * com data/processed/casas.json (realizado real) pra gerar
 * data/processed/liderancas.json: meta/realizado/faltam de casas por
 * líder (José Pedro, Jucélio Lourenço, Reginaldo Lima) no 2026.2, com o
 * detalhamento mensal (meta/realizado/desvio) por supervisor.
 *
 * A lista de supervisores é a da aba CONTROLE (não a de Liderança CA
 * nem a de casas.json) — confirmado pelo usuário em 2026-07-18 que é
 * ela quem reflete quem está ativo como supervisor no 2026.2 (ex.:
 * Suellen Nathalia e "Jose Pedro" saíram da lista, mas ainda aparecem
 * na planilha Liderança CA como se estivessem ativos).
 *
 * A aba CONTROLE tem 1 linha por casa planejada, com a coluna
 * SUPERVISOR (índice 27) e MÊS (índice 25) — cada linha com "id"
 * (coluna 1) e ANO (índice 26) preenchidos é uma casa real deste
 * semestre (linhas de PULMÃO/FÉRIAS/PARADA não têm id; a fila de
 * placeholders futuros sem data calculada tem ANO = "-").
 *
 * Uso:
 *   node data/scripts/extrair_liderancas.mjs "Liderança CA.xlsx" "CONTROLE DE UGB - CA - 2026.2.xlsm"
 */
import xlsx from "xlsx";
import { readFileSync, writeFileSync } from "fs";

const [fileLideranca, fileControle] = process.argv.slice(2);
if (!fileLideranca || !fileControle) {
  console.error('Uso: node extrair_liderancas.mjs "Liderança CA.xlsx" "CONTROLE DE UGB - CA - 2026.2.xlsm"');
  process.exit(1);
}

function normalizar(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
}
function nomeProprio(texto) {
  return (texto || "").trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

const FOTOS_LIDERES = {
  [normalizar("José Pedro")]: "assets/images/lideres/jose-pedro.jpg",
  [normalizar("Jucélio Lourenço")]: "assets/images/lideres/jucelio-lourenco.jpg",
  [normalizar("Reginaldo Lima")]: "assets/images/lideres/reginaldo-lima.jpg",
};

// Só os supervisores com foto real no organograma (os demais mostram as
// iniciais do nome — ver GP.initials no front-end).
const FOTOS_SUPERVISORES = {
  [normalizar("Girlando João")]: "assets/images/supervisores/girlando-joao.jpg",
  [normalizar("Caio Cesar")]: "assets/images/supervisores/caio-cesar.jpg",
  [normalizar("Geovane Lima")]: "assets/images/supervisores/geovane-lima.jpg",
  [normalizar("João Vinicius")]: "assets/images/supervisores/joao-vinicius.jpg",
};

const MESES = [
  { mes: "2026-07", label: "Julho/2026", controleMes: "7" },
  { mes: "2026-08", label: "Agosto/2026", controleMes: "8" },
  { mes: "2026-09", label: "Setembro/2026", controleMes: "9" },
  { mes: "2026-10", label: "Outubro/2026", controleMes: "10" },
  { mes: "2026-11", label: "Novembro/2026", controleMes: "11" },
  { mes: "2026-12", label: "Dezembro/2026", controleMes: "12" },
];

const wbLid = xlsx.readFile(fileLideranca);
const abaLideranca = wbLid.Sheets["Dados"] ?? wbLid.Sheets["Lideres"];
const rowsLid = xlsx.utils.sheet_to_json(abaLideranca, { header: 1, defval: "", raw: false });
const mapa = new Map(); // supervisor normalizado -> { liderNome, liderChave }
for (const [supervisor, lider] of rowsLid.slice(1)) {
  if (!supervisor || !lider) continue;
  mapa.set(normalizar(supervisor), { liderNome: nomeProprio(lider), liderChave: normalizar(lider) });
}

// Aba CONTROLE: header na linha 6 (0-based), dados a partir da linha 7.
// Coluna 1 = id da casa, 25 = mês, 26 = ano de término, 27 = supervisor.
// É a fonte da VERDADE de quem está ativo como supervisor este semestre.
const wbControle = xlsx.readFile(fileControle);
const rowsControle = xlsx.utils.sheet_to_json(wbControle.Sheets["CONTROLE"], { header: 1, defval: "", raw: false });
const todasLinhas = rowsControle.slice(7).filter((r) => r[1] && r[27]);

const metaPorSupervisor = new Map(); // supervisor normalizado -> { total, nomeBruto, porMes: Map<mes,count>, semData }
for (const r of todasLinhas) {
  const key = normalizar(r[27]);
  const atual = metaPorSupervisor.get(key) ?? { total: 0, nomeBruto: r[27], porMes: new Map(), semData: 0 };
  atual.total += 1;
  const temAno = r[26] && r[26] !== "-";
  const mesInfo = temAno ? MESES.find((m) => m.controleMes === String(r[25]).trim()) : null;
  if (mesInfo) atual.porMes.set(mesInfo.mes, (atual.porMes.get(mesInfo.mes) || 0) + 1);
  // Linhas sem ANO calculado normalmente são fila de pipeline futuro (fora
  // do horizonte deste semestre) e ficam de fora — MAS se um supervisor não
  // tem NENHUMA linha com data (ex.: Josenildo Milanez, confirmado pelo
  // usuário em 2026-07-18), a planilha não tem como informar o mês, então
  // as casas dele entram mesmo assim, marcadas como "sem mês definido".
  else if (!temAno) atual.semData += 1;
  metaPorSupervisor.set(key, atual);
}
for (const [key, info] of metaPorSupervisor) {
  const totalComData = [...info.porMes.values()].reduce((a, v) => a + v, 0);
  if (totalComData === 0 && info.semData === 0) metaPorSupervisor.delete(key);
  else if (totalComData > 0) info.semData = 0; // tem data pra pelo menos uma parte: ignora o resto (fila futura normal)
}

const casas = JSON.parse(readFileSync(new URL("../processed/casas.json", import.meta.url), "utf8"));
const casasPorSupervisor = new Map(); // supervisor normalizado -> casas.json[]
for (const casa of casas) {
  const key = normalizar(casa.supervisor);
  if (!casasPorSupervisor.has(key)) casasPorSupervisor.set(key, []);
  casasPorSupervisor.get(key).push(casa);
}

// Agrupa por líder — a lista de supervisores é exatamente a da aba
// CONTROLE (quem tem pelo menos 1 casa real planejada este semestre).
const grupos = new Map(); // liderChave -> { liderNome, supervisores: [] }
for (const [supChave, info] of metaPorSupervisor.entries()) {
  const liderInfo = mapa.get(supChave);
  if (!liderInfo) {
    console.warn("Supervisor sem líder mapeado em Liderança CA, ignorado:", info.nomeBruto);
    continue;
  }
  grupos.set(liderInfo.liderChave, grupos.get(liderInfo.liderChave) ?? { liderNome: liderInfo.liderNome, supervisores: [] });
  const casasHist = casasPorSupervisor.get(supChave) ?? [];
  // porMes cobre só os 6 meses do semestre com data calculada — a fila sem
  // data (info.semData) fica de fora da meta_2026_2 (ver backlogSemData
  // abaixo), porque essas casas não têm confirmação de que saem neste
  // semestre; contá-las como "meta 2026.2" inflava a soma dos líderes bem
  // acima da meta oficial do semestre (718 vs 348 — ver metas_2026_2.json).
  const porMes = MESES.map(({ mes, label }) => {
    const meta = info.porMes.get(mes) || 0;
    const realizado = casasHist.filter((c) => c.status === "concluida" && (c.etapas?.acab1?.data ?? "").slice(0, 7) === mes).length;
    return { mes, label, meta, realizado, desvio: realizado - meta };
  });
  grupos.get(liderInfo.liderChave).supervisores.push({
    nome: nomeProprio(info.nomeBruto),
    foto: FOTOS_SUPERVISORES[supChave] ?? null,
    meta_2026_2: porMes.reduce((a, m) => a + m.meta, 0),
    realizado_2026_2: porMes.reduce((a, m) => a + m.realizado, 0),
    backlog_sem_data: info.semData,
    por_mes: porMes,
  });
}

const liderancas = [...grupos.entries()].map(([liderChave, grupo]) => {
  const supervisores = grupo.supervisores.slice().sort((a, b) => b.meta_2026_2 - a.meta_2026_2);
  const meta = supervisores.reduce((a, s) => a + s.meta_2026_2, 0);
  const realizado = supervisores.reduce((a, s) => a + s.realizado_2026_2, 0);
  const backlogSemData = supervisores.reduce((a, s) => a + s.backlog_sem_data, 0);
  return {
    nome: grupo.liderNome,
    foto: FOTOS_LIDERES[liderChave] ?? null,
    meta_2026_2: meta,
    realizado_2026_2: realizado,
    faltam_2026_2: Math.max(0, meta - realizado),
    backlog_sem_data: backlogSemData,
    supervisores,
  };
}).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

const resultado = {
  atualizado_em: new Date().toISOString().slice(0, 10),
  periodo: "2026.2 (julho a dezembro de 2026)",
  fonte_meta: "Aba CONTROLE (cronograma) da planilha CONTROLE DE UGB - CA - 2026.2 — 1 linha por casa planejada; lista de supervisores = quem tem casas nessa aba. meta_2026_2 conta só linhas com mês/ano calculado (soma bate com a meta oficial do semestre); casas na fila sem data ainda entram em backlog_sem_data, à parte.",
  liderancas,
};

writeFileSync(new URL("../processed/liderancas.json", import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
for (const l of liderancas) {
  console.log(`${l.nome}: meta ${l.meta_2026_2}, realizado ${l.realizado_2026_2}, faltam ${l.faltam_2026_2} (${l.supervisores.length} supervisores)`);
}
