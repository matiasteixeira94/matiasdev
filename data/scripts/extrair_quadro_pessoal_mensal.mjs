#!/usr/bin/env node
/**
 * Extrai o quadro de pessoal planejado x realizado, mês a mês, da aba
 * "PREVISTO DE PESSOAL" da planilha "Boletim mensal CA - ....xlsx" e
 * grava data/processed/quadro_pessoal_mensal.json.
 *
 * A aba é uma árvore (categoria -> cargos): linhas de categoria (ex.
 * "ACABAMENTO (Diretos)", "MURO E CISTERNA") já são a soma dos cargos
 * dentro delas. Para não contar duas vezes, o total mensal é a soma só
 * das linhas de CARGO (coluna "NÍVEL" preenchida) — as linhas de
 * categoria/subtotal, que têm "NÍVEL" vazio, são ignoradas.
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

const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets["PREVISTO DE PESSOAL"];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

// linha 5 (índice) em diante = dados; coluna 1 = nome do cargo/categoria,
// coluna 2 = NÍVEL (só preenchida em linha de cargo individual); colunas
// 6..29 = 12 pares (Planejado, Realizado), um par por mês, Jan a Dez.
const linhasCargo = rows.slice(5).filter((r) => (r[2] || "").toString().trim() && (r[1] || "").toString().trim());

const meses = [];
for (let i = 0; i < 12; i++) {
  const colP = 6 + i * 2, colR = 7 + i * 2;
  let planejado = 0, realizado = 0;
  for (const r of linhasCargo) {
    if (typeof r[colP] === "number") planejado += r[colP];
    if (typeof r[colR] === "number") realizado += r[colR];
  }
  meses.push({ mes: `2026-${String(i + 1).padStart(2, "0")}`, label: `${MESES_LABEL[i]}/2026`, planejado, realizado });
}

writeFileSync(new URL("../processed/quadro_pessoal_mensal.json", import.meta.url), JSON.stringify({ meses }, null, 2), "utf8");
console.log(JSON.stringify({ meses }, null, 2));
