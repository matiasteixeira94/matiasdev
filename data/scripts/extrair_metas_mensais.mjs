#!/usr/bin/env node
/**
 * Gera data/processed/metas_mensais_2026_1.json ou metas_mensais_2026_2.json:
 * meta (planejado/projetado) e realizado mês a mês do semestre, para casas e
 * muros, a partir da aba "GERAL" (resumo) das duas planilhas de controle.
 *
 * Usado na tabela de acompanhamento de desvio mensal na tela Casas.
 *
 * Uso:
 *   node data/scripts/extrair_metas_mensais.mjs 2026.1 "<CONTROLE ... CA - 2026.1.xlsm>" "<CONTROLE ... Muros.xlsm>"
 *   node data/scripts/extrair_metas_mensais.mjs 2026.2 "<CONTROLE ... CA - 2026.2.xlsm>" "<CONTROLE ... Muros.xlsm>"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const [semestre, fileCasas, fileMuros] = process.argv.slice(2);
const SEMESTRES = {
  "2026.1": { mesInicio: 1, linhaInicioCasas: 2, linhaInicioMuros: 46 },
  "2026.2": { mesInicio: 7, linhaInicioCasas: 8, linhaInicioMuros: 52 },
};
if (!SEMESTRES[semestre] || !fileCasas || !fileMuros) {
  console.error('Uso: node extrair_metas_mensais.mjs "2026.1|2026.2" "CONTROLE ... CA - <semestre>.xlsm" "CONTROLE ... Muros.xlsm"');
  process.exit(1);
}
const { mesInicio, linhaInicioCasas, linhaInicioMuros } = SEMESTRES[semestre];

const MESES_LABEL = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// linha da aba GERAL -> { meta, realizado }, usando PLANEJADO (col2) quando
// preenchido, senão PROJETADO (col3) — mesma regra em casas e muros.
function lerLinha(row) {
  const meta = typeof row[2] === "number" ? row[2] : (typeof row[3] === "number" ? row[3] : 0);
  const realizado = typeof row[4] === "number" ? row[4] : 0;
  return { meta, realizado };
}

const wbCasas = XLSX.readFile(fileCasas, { cellDates: true });
const wsCasas = wbCasas.Sheets[`GERAL 26.${semestre.slice(-1)}`] || wbCasas.Sheets["GERAL 26.2"] || wbCasas.Sheets["GERAL 26.1"];
const rowsCasas = XLSX.utils.sheet_to_json(wsCasas, { header: 1, raw: true, defval: "" });

const wbMuros = XLSX.readFile(fileMuros, { cellDates: true });
const wsMuros = wbMuros.Sheets[`GERAL 26.${semestre.slice(-1)}`] || wbMuros.Sheets["GERAL 26.1"] || wbMuros.Sheets["GERAL 26.2"];
const rowsMuros = XLSX.utils.sheet_to_json(wsMuros, { header: 1, raw: true, defval: "" });

// 6 meses do semestre: linhaInicioCasas/linhaInicioMuros é a linha do 1º mês
// (ver cabeçalhos 1 linha acima de cada bloco).
const meses = [];
for (let mes = mesInicio; mes <= mesInicio + 5; mes++) {
  const linhaCasas = linhaInicioCasas + (mes - mesInicio);
  const linhaMuros = linhaInicioMuros + (mes - mesInicio);
  meses.push({
    mes: `2026-${String(mes).padStart(2, "0")}`,
    label: `${MESES_LABEL[mes]}/2026`,
    casas: lerLinha(rowsCasas[linhaCasas] || []),
    muros: lerLinha(rowsMuros[linhaMuros] || []),
  });
}

const chaveArquivo = semestre.replace(".", "_");
writeFileSync(new URL(`../processed/metas_mensais_${chaveArquivo}.json`, import.meta.url), JSON.stringify({ meses }, null, 2), "utf8");
console.log(JSON.stringify({ meses }, null, 2));
