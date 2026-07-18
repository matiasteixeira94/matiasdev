#!/usr/bin/env node
/**
 * Cruza a planilha "Liderança CA.xlsx" (aba Lideres: Supervisor -> Líder)
 * com a aba CONTROLE da planilha de controle de UGB (cronograma —
 * quantidade de casas que cada supervisor vai executar no semestre) e
 * com data/processed/casas.json (realizado real) pra gerar
 * data/processed/liderancas.json: meta/realizado/faltam de casas por
 * líder (José Pedro, Jucélio Lourenço, Reginaldo Lima) no 2026.2, e o
 * detalhamento por supervisor dentro de cada liderança.
 *
 * A aba CONTROLE tem 1 linha por casa planejada, com a coluna
 * SUPERVISOR (índice 27) — cada linha com "id" (coluna 1) preenchido é
 * uma casa real (linhas de PULMÃO/FÉRIAS/PARADA não têm id). A meta de
 * cada supervisor/líder é a contagem dessas linhas — não uma
 * distribuição proporcional.
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

const wbLid = xlsx.readFile(fileLideranca);
const rowsLid = xlsx.utils.sheet_to_json(wbLid.Sheets["Lideres"], { header: 1, defval: "", raw: false });
const mapa = new Map(); // supervisor normalizado -> { liderNome, liderChave }
for (const [supervisor, lider] of rowsLid.slice(1)) {
  if (!supervisor || !lider) continue;
  mapa.set(normalizar(supervisor), { liderNome: nomeProprio(lider), liderChave: normalizar(lider) });
}

// Aba CONTROLE: 1 linha por casa planejada pro semestre; header na linha 6
// (0-based), dados a partir da linha 7. Coluna 1 = id da casa, 26 = ano de
// término, 27 = supervisor. Além das casas já com lote real, a aba também
// lista uma fila de casas-placeholder ("CASA12", "CASA11"...) que ainda não
// têm data de término calculada (ANO = "-") — são projeção de pipeline além
// do horizonte atual, não meta deste semestre, então ficam de fora.
const wbControle = xlsx.readFile(fileControle);
const rowsControle = xlsx.utils.sheet_to_json(wbControle.Sheets["CONTROLE"], { header: 1, defval: "", raw: false });
const metaPorSupervisor = new Map(); // supervisor normalizado -> { count, nomeBruto }
for (const r of rowsControle.slice(7)) {
  if (!r[1] || !r[27]) continue;
  if (!r[26] || r[26] === "-") continue;
  const key = normalizar(r[27]);
  const atual = metaPorSupervisor.get(key) ?? { count: 0, nomeBruto: r[27] };
  atual.count += 1;
  metaPorSupervisor.set(key, atual);
}

const casas = JSON.parse(readFileSync(new URL("../processed/casas.json", import.meta.url), "utf8"));

const INICIO_SEMESTRE = "2026-07-01", FIM_SEMESTRE = "2026-12-31";
function concluidaNoSemestre(casa) {
  const d = casa.etapas?.acab1?.data ?? null;
  return casa.status === "concluida" && d && d >= INICIO_SEMESTRE && d <= FIM_SEMESTRE;
}

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
    const conc = s.casasHist.filter((c) => c.status === "concluida").length;
    const prods = s.casasHist.map((c) => c.produtividade_total).filter((v) => typeof v === "number");
    return {
      nome: s.nome,
      meta_2026_2: metaPorSupervisor.get(supChave)?.count || 0,
      total_casas: s.casasHist.length,
      concluidas: conc,
      pendentes: s.casasHist.length - conc,
      pct_concluido: s.casasHist.length ? Math.round((conc / s.casasHist.length) * 1000) / 10 : 0,
      produtividade_media: prods.length ? Math.round((prods.reduce((a, v) => a + v, 0) / prods.length) * 10) / 10 : null,
    };
  }).sort((a, b) => b.meta_2026_2 - a.meta_2026_2);

  const todasCasasHist = [...grupo.supervisores.values()].flatMap((s) => s.casasHist);
  const meta = supervisores.reduce((a, s) => a + s.meta_2026_2, 0);
  const realizado = todasCasasHist.filter(concluidaNoSemestre).length;

  return {
    nome: grupo.liderNome,
    foto: FOTOS[liderChave] ?? null,
    total_casas: todasCasasHist.length,
    concluidas_total: todasCasasHist.filter((c) => c.status === "concluida").length,
    pendentes: todasCasasHist.filter((c) => c.status !== "concluida").length,
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
