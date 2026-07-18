#!/usr/bin/env node
/**
 * Cruza a planilha "Liderança CA.xlsx" (aba Lideres: Supervisor -> Líder)
 * com a aba CONTROLE da planilha de controle de UGB (cronograma —
 * quantidade de casas que cada supervisor vai executar no semestre) e
 * com data/processed/casas.json (realizado real) pra gerar
 * data/processed/liderancas.json: meta/realizado/faltam de casas por
 * líder (José Pedro, Jucélio Lourenço, Reginaldo Lima) no 2026.2, com o
 * detalhamento mensal (meta/realizado/desvio) por supervisor.
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

const FOTOS = {
  [normalizar("José Pedro")]: "assets/images/lideres/jose-pedro.jpg",
  [normalizar("Jucélio Lourenço")]: "assets/images/lideres/jucelio-lourenco.jpg",
  [normalizar("Reginaldo Lima")]: "assets/images/lideres/reginaldo-lima.jpg",
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
const rowsLid = xlsx.utils.sheet_to_json(wbLid.Sheets["Lideres"], { header: 1, defval: "", raw: false });
const mapa = new Map(); // supervisor normalizado -> { liderNome, liderChave }
for (const [supervisor, lider] of rowsLid.slice(1)) {
  if (!supervisor || !lider) continue;
  mapa.set(normalizar(supervisor), { liderNome: nomeProprio(lider), liderChave: normalizar(lider) });
}

// Correção manual confirmada pelo usuário em 2026-07-18: a planilha
// Liderança CA lista Geovane Lima como supervisor de José Pedro, mas na
// prática ele é supervisor de Reginaldo Lima.
mapa.set(normalizar("Geovane Lima"), { liderNome: "Reginaldo Lima", liderChave: normalizar("Reginaldo Lima") });

// Aba CONTROLE: header na linha 6 (0-based), dados a partir da linha 7.
// Coluna 1 = id da casa, 25 = mês, 26 = ano de término, 27 = supervisor.
const wbControle = xlsx.readFile(fileControle);
const rowsControle = xlsx.utils.sheet_to_json(wbControle.Sheets["CONTROLE"], { header: 1, defval: "", raw: false });
const linhasControle = rowsControle.slice(7).filter((r) => r[1] && r[27] && r[26] && r[26] !== "-");

const metaPorSupervisor = new Map(); // supervisor normalizado -> { total, nomeBruto, porMes: Map<mes,count> }
for (const r of linhasControle) {
  const key = normalizar(r[27]);
  const atual = metaPorSupervisor.get(key) ?? { total: 0, nomeBruto: r[27], porMes: new Map() };
  atual.total += 1;
  const mesInfo = MESES.find((m) => m.controleMes === String(r[25]).trim());
  if (mesInfo) atual.porMes.set(mesInfo.mes, (atual.porMes.get(mesInfo.mes) || 0) + 1);
  metaPorSupervisor.set(key, atual);
}

const casas = JSON.parse(readFileSync(new URL("../processed/casas.json", import.meta.url), "utf8"));

// Agrupa por líder — um supervisor entra no grupo se aparecer em
// casas.json (histórico) OU na aba CONTROLE (planejado pro semestre).
// Chave sempre normalizada (sem acento/maiúsculo), pra não duplicar o
// mesmo supervisor com grafias diferentes vindas de fontes diferentes.
const grupos = new Map(); // liderChave -> { liderNome, supervisores: Map<supChave, {nome, casasHist:[]}> }
function grupoDoSupervisor(supervisorBruto) {
  const supChave = normalizar(supervisorBruto);
  const info = mapa.get(supChave);
  if (!info) return null;
  grupos.set(info.liderChave, grupos.get(info.liderChave) ?? { liderNome: info.liderNome, supervisores: new Map() });
  const grupo = grupos.get(info.liderChave);
  if (!grupo.supervisores.has(supChave)) {
    grupo.supervisores.set(supChave, { nome: nomeProprio(supervisorBruto), casasHist: [] });
  }
  return grupo.supervisores.get(supChave);
}

for (const casa of casas) {
  const sup = grupoDoSupervisor(casa.supervisor);
  if (sup) sup.casasHist.push(casa);
}
for (const { nomeBruto } of metaPorSupervisor.values()) {
  // garante que supervisores que só aparecem no CONTROLE (ainda sem
  // histórico em casas.json) também entrem no grupo do líder.
  grupoDoSupervisor(nomeBruto);
}

const liderancas = [...grupos.entries()].map(([liderChave, grupo]) => {
  const supervisores = [...grupo.supervisores.entries()].map(([supChave, s]) => {
    const metaInfo = metaPorSupervisor.get(supChave);
    const porMes = MESES.map(({ mes, label }) => {
      const meta = metaInfo?.porMes.get(mes) || 0;
      const realizado = s.casasHist.filter((c) => c.status === "concluida" && (c.etapas?.acab1?.data ?? "").slice(0, 7) === mes).length;
      return { mes, label, meta, realizado, desvio: realizado - meta };
    });
    return {
      nome: s.nome,
      meta_2026_2: metaInfo?.total || 0,
      realizado_2026_2: porMes.reduce((a, m) => a + m.realizado, 0),
      por_mes: porMes,
    };
  }).sort((a, b) => b.meta_2026_2 - a.meta_2026_2);

  const meta = supervisores.reduce((a, s) => a + s.meta_2026_2, 0);
  const realizado = supervisores.reduce((a, s) => a + s.realizado_2026_2, 0);

  return {
    nome: grupo.liderNome,
    foto: FOTOS[liderChave] ?? null,
    meta_2026_2: meta,
    realizado_2026_2: realizado,
    faltam_2026_2: Math.max(0, meta - realizado),
    supervisores,
  };
}).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

const resultado = {
  atualizado_em: new Date().toISOString().slice(0, 10),
  periodo: "2026.2 (julho a dezembro de 2026)",
  fonte_meta: "Aba CONTROLE (cronograma) da planilha CONTROLE DE UGB - CA - 2026.2 — 1 linha por casa planejada",
  liderancas,
};

writeFileSync(new URL("../processed/liderancas.json", import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
for (const l of liderancas) {
  console.log(`${l.nome}: meta ${l.meta_2026_2}, realizado ${l.realizado_2026_2}, faltam ${l.faltam_2026_2} (${l.supervisores.length} supervisores)`);
}
