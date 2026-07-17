#!/usr/bin/env node
/**
 * Gera data/processed/metas_mensais_2026_2.json: meta (planejado/projetado)
 * e realizado mês a mês do 2º semestre de 2026, para casas e muros, a
 * partir da aba "GERAL" (resumo) das duas planilhas de controle.
 *
 * Usado na tabela de acompanhamento de desvio mensal na tela Casas.
 *
 * Uso:
 *   node data/scripts/extrair_metas_mensais.mjs "<CONTROLE ... CA - 2026.2.xlsm>" "<CONTROLE ... Muros.xlsm>"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const [fileCasas, fileMuros] = process.argv.slice(2);
if (!fileCasas || !fileMuros) {
  console.error('Uso: node extrair_metas_mensais.mjs "CONTROLE ... CA - 2026.2.xlsm" "CONTROLE ... Muros.xlsm"');
  process.exit(1);
}

const MESES_LABEL = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// linha da aba GERAL -> { meta, realizado }, usando PLANEJADO (col2) quando
// preenchido, senão PROJETADO (col3) — mesma regra em casas e muros.
function lerLinha(row) {
  const meta = typeof row[2] === "number" ? row[2] : (typeof row[3] === "number" ? row[3] : 0);
  const realizado = typeof row[4] === "number" ? row[4] : 0;
  return { meta, realizado };
}

const wbCasas = XLSX.readFile(fileCasas, { cellDates: true });
const wsCasas = wbCasas.Sheets["GERAL 26.2"] || wbCasas.Sheets["GERAL 26.1"];
const rowsCasas = XLSX.utils.sheet_to_json(wsCasas, { header: 1, raw: true, defval: "" });

const wbMuros = XLSX.readFile(fileMuros, { cellDates: true });
const wsMuros = wbMuros.Sheets["GERAL 26.1"] || wbMuros.Sheets["GERAL 26.2"];
const rowsMuros = XLSX.utils.sheet_to_json(wsMuros, { header: 1, raw: true, defval: "" });

// julho a dezembro: linhas 8-13 no bloco de casas, 52-57 no bloco de muros
// (ver cabeçalhos nas linhas 1 e 45 de cada aba).
const meses = [];
for (let mes = 7; mes <= 12; mes++) {
  const linhaCasas = 8 + (mes - 7);
  const linhaMuros = 52 + (mes - 7);
  meses.push({
    mes: `2026-${String(mes).padStart(2, "0")}`,
    label: `${MESES_LABEL[mes]}/2026`,
    casas: lerLinha(rowsCasas[linhaCasas] || []),
    muros: lerLinha(rowsMuros[linhaMuros] || []),
  });
}

writeFileSync(new URL("../processed/metas_mensais_2026_2.json", import.meta.url), JSON.stringify({ meses }, null, 2), "utf8");
console.log(JSON.stringify({ meses }, null, 2));
