#!/usr/bin/env node
/**
 * Extrai o quadro de pessoal planejado x realizado, mês a mês, da aba
 * "PREVISTO DE PESSOAL" da planilha "Boletim mensal CA - ....xlsx" e
 * grava data/processed/quadro_pessoal_mensal.json — total geral e
 * também separado nas 5 frentes usadas na tela: Acabamento, Assistência
 * Técnica, Produção, Aprendiz e Muro (as três primeiras e a última somam
 * diretos + indiretos internamente).
 *
 * A aba é uma árvore (categoria -> cargos): linhas de categoria (ex.
 * "ACABAMENTO (Diretos)", "MURO E CISTERNA") já são a soma dos cargos
 * dentro delas. Para não contar duas vezes, cada mês é a soma só das
 * linhas de CARGO (coluna "NÍVEL" preenchida); a frente de cada cargo é
 * decidida acompanhando o cabeçalho de categoria mais recente acima dele.
 *
 * Uso:
 *   npm install xlsx
 *   node data/scripts/extrair_quadro_pessoal_mensal.mjs "Boletim mensal CA - ....xlsx"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_quadro_pessoal_mensal.mjs "Boletim mensal CA - ....xlsx"');
  process.exit(1);
}

const MESES_LABEL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const FRENTES = ["Acabamento", "Assistência Técnica", "Produção", "Aprendiz", "Muro"];

const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets["PREVISTO DE PESSOAL"];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

// Decide a frente de cada linha acompanhando o cabeçalho de categoria mais
// recente (col2/NÍVEL vazio) — "MURO" antes de "PRODUÇÃO" porque a
// categoria "PRODUÇÃO (MURO)" contém as duas palavras.
function frenteDaCategoria(texto) {
  const t = texto.toUpperCase();
  if (t.includes("MURO")) return "Muro";
  if (t.includes("ACABAMENTO")) return "Acabamento";
  if (t.includes("ASSIST")) return "Assistência Técnica";
  if (t.includes("PRODUÇÃO")) return "Produção";
  return null;
}

let frenteAtual = null;
const linhasPorFrente = Object.fromEntries(FRENTES.map((f) => [f, []]));
for (const r of rows.slice(5)) {
  const col1 = (r[1] || "").toString().trim();
  const col2 = (r[2] || "").toString().trim();
  if (!col1) continue;
  if (!col2) {
    // linha de categoria/subtotal — só atualiza o estado, não soma (os
    // cargos dentro dela já cobrem o valor).
    const f = frenteDaCategoria(col1);
    if (f) frenteAtual = f;
    continue;
  }
  const frente = col1.toUpperCase() === "APRENDIZ" ? "Aprendiz" : frenteAtual;
  if (frente) linhasPorFrente[frente].push(r);
}

function somaMeses(linhas) {
  const meses = [];
  for (let i = 0; i < 12; i++) {
    const colP = 6 + i * 2, colR = 7 + i * 2;
    let planejado = 0, realizado = 0;
    for (const r of linhas) {
      if (typeof r[colP] === "number") planejado += r[colP];
      if (typeof r[colR] === "number") realizado += r[colR];
    }
    meses.push({ mes: `2026-${String(i + 1).padStart(2, "0")}`, label: `${MESES_LABEL[i]}/2026`, planejado, realizado });
  }
  return meses;
}

const todasLinhas = FRENTES.flatMap((f) => linhasPorFrente[f]);
const resultado = {
  meses: somaMeses(todasLinhas),
  frentes: Object.fromEntries(FRENTES.map((f) => [f, { meses: somaMeses(linhasPorFrente[f]) }])),
};

writeFileSync(new URL("../processed/quadro_pessoal_mensal.json", import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
console.log("Total geral (Jan):", resultado.meses[0]);
for (const f of FRENTES) console.log(f, "(Jan):", resultado.frentes[f].meses[0]);
