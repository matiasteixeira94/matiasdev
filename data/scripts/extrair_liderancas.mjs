#!/usr/bin/env node
/**
 * Cruza a planilha "Liderança CA.xlsx" (aba Lideres: Supervisor -> Líder)
 * com data/processed/casas.json e metas_2026_2.json pra gerar
 * data/processed/liderancas.json: meta/realizado/faltam de casas por
 * líder (José Pedro, Jucélio Lourenço, Reginaldo Lima) no 2026.2, e o
 * detalhamento por supervisor dentro de cada liderança.
 *
 * A meta 2026.2 da empresa (metas_2026_2.json) não vem quebrada por
 * líder na planilha-fonte — aqui ela é distribuída proporcionalmente ao
 * volume de casas ainda pendentes de cada liderança (quem tem mais casa
 * pra terminar puxa uma fatia maior da meta do semestre).
 *
 * Uso:
 *   node data/scripts/extrair_liderancas.mjs "Liderança CA.xlsx"
 */
import xlsx from "xlsx";
import { readFileSync, writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_liderancas.mjs "Liderança CA.xlsx"');
  process.exit(1);
}

function normalizar(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
}

const FOTOS = {
  [normalizar("José Pedro")]: "assets/images/lideres/jose-pedro.jpg",
  [normalizar("Jucélio Lourenço")]: "assets/images/lideres/jucelio-lourenco.jpg",
  [normalizar("Reginaldo Lima")]: "assets/images/lideres/reginaldo-lima.jpg",
};
function nomeProprio(texto) {
  return (texto || "").trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

const wb = xlsx.readFile(file);
const rows = xlsx.utils.sheet_to_json(wb.Sheets["Lideres"], { header: 1, defval: "", raw: false });
const mapa = new Map(); // supervisor normalizado -> { liderNome, liderChave }
for (const [supervisor, lider] of rows.slice(1)) {
  if (!supervisor || !lider) continue;
  mapa.set(normalizar(supervisor), { liderNome: nomeProprio(lider), liderChave: normalizar(lider) });
}

const casas = JSON.parse(readFileSync(new URL("../processed/casas.json", import.meta.url), "utf8"));
const metas = JSON.parse(readFileSync(new URL("../processed/metas_2026_2.json", import.meta.url), "utf8"));

const INICIO_SEMESTRE = "2026-07-01", FIM_SEMESTRE = "2026-12-31";
function dataConclusao(casa) {
  return casa.etapas?.acab1?.data ?? null;
}
function concluidaNoSemestre(casa) {
  const d = dataConclusao(casa);
  return casa.status === "concluida" && d && d >= INICIO_SEMESTRE && d <= FIM_SEMESTRE;
}

const grupos = new Map(); // liderChave -> { liderNome, casas: [], supervisores: Map }
for (const casa of casas) {
  const info = mapa.get(normalizar(casa.supervisor));
  if (!info) continue;
  grupos.set(info.liderChave, grupos.get(info.liderChave) ?? { liderNome: info.liderNome, casas: [], supervisores: new Map() });
  const grupo = grupos.get(info.liderChave);
  grupo.casas.push(casa);
  const supNome = nomeProprio(casa.supervisor);
  grupo.supervisores.set(supNome, grupo.supervisores.get(supNome) ?? []);
  grupo.supervisores.get(supNome).push(casa);
}

const totalPendentesGeral = [...grupos.values()].reduce((a, g) => a + g.casas.filter((c) => c.status !== "concluida").length, 0);

const liderancas = [...grupos.entries()].map(([liderChave, grupo]) => {
  const pendentes = grupo.casas.filter((c) => c.status !== "concluida").length;
  const concluidasTotal = grupo.casas.filter((c) => c.status === "concluida").length;
  const realizado = grupo.casas.filter(concluidaNoSemestre).length;
  const meta = totalPendentesGeral ? Math.round((pendentes / totalPendentesGeral) * metas.casas.meta) : 0;

  const supervisores = [...grupo.supervisores.entries()].map(([nome, lista]) => {
    const conc = lista.filter((c) => c.status === "concluida").length;
    const prods = lista.map((c) => c.produtividade_total).filter((v) => typeof v === "number");
    return {
      nome,
      total_casas: lista.length,
      concluidas: conc,
      pendentes: lista.length - conc,
      pct_concluido: lista.length ? Math.round((conc / lista.length) * 1000) / 10 : 0,
      produtividade_media: prods.length ? Math.round((prods.reduce((a, v) => a + v, 0) / prods.length) * 10) / 10 : null,
    };
  }).sort((a, b) => b.total_casas - a.total_casas);

  return {
    nome: grupo.liderNome,
    foto: FOTOS[liderChave] ?? null,
    total_casas: grupo.casas.length,
    concluidas_total: concluidasTotal,
    pendentes,
    meta_2026_2: meta,
    realizado_2026_2: realizado,
    faltam_2026_2: Math.max(0, meta - realizado),
    supervisores,
  };
}).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

// ajusta o arredondamento pra soma das metas bater exatamente com a meta
// geral da empresa — a diferença vai pra liderança com mais casas pendentes.
const diff = metas.casas.meta - liderancas.reduce((a, l) => a + l.meta_2026_2, 0);
if (diff !== 0) {
  const maior = liderancas.slice().sort((a, b) => b.pendentes - a.pendentes)[0];
  maior.meta_2026_2 += diff;
  maior.faltam_2026_2 = Math.max(0, maior.meta_2026_2 - maior.realizado_2026_2);
}

const resultado = {
  atualizado_em: new Date().toISOString().slice(0, 10),
  periodo: metas.periodo,
  liderancas,
};

writeFileSync(new URL("../processed/liderancas.json", import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
for (const l of liderancas) {
  console.log(`${l.nome}: meta ${l.meta_2026_2}, realizado ${l.realizado_2026_2}, faltam ${l.faltam_2026_2} (${l.supervisores.length} supervisores, ${l.total_casas} casas)`);
}
