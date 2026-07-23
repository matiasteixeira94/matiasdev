#!/usr/bin/env node
/**
 * Gera data/processed/metas_2026_1.json ou metas_2026_2.json com a meta e o
 * realizado do semestre para casas e muros, a partir da aba "GERAL" (resumo
 * mensal PLANEJADO/PROJETADO/REALIZADO) das duas planilhas de controle.
 *
 * A meta de muros do 2026.2 (404) é a informada pela gestão — a aba GERAL da
 * planilha de muros do 2026.2 só tem a projeção (402), desatualizada. Pro
 * 2026.1 (semestre já fechado) usa o valor "META MUROS" que já está na
 * própria aba, porque não tem override informado pra esse período.
 *
 * Uso:
 *   node data/scripts/extrair_metas_semestre.mjs 2026.1 "<CONTROLE ... CA - 2026.1.xlsm>" "<CONTROLE ... Muros.xlsm>"
 *   node data/scripts/extrair_metas_semestre.mjs 2026.2 "<CONTROLE ... CA - 2026.2.xlsm>" "<CONTROLE ... Muros.xlsm>"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const [semestre, fileCasas, fileMuros] = process.argv.slice(2);
const SEMESTRES = {
  "2026.1": { linhaInicioCasas: 2, linhaInicioMuros: 46, metaMurosOverride: null, periodo: "2026.1 (janeiro a junho de 2026)" },
  "2026.2": { linhaInicioCasas: 8, linhaInicioMuros: 52, metaMurosOverride: 404, periodo: "2026.2 (julho a dezembro de 2026)" },
};
if (!SEMESTRES[semestre] || !fileCasas || !fileMuros) {
  console.error('Uso: node extrair_metas_semestre.mjs "2026.1|2026.2" "CONTROLE ... CA - <semestre>.xlsm" "CONTROLE ... Muros.xlsm"');
  process.exit(1);
}
const { linhaInicioCasas, linhaInicioMuros, metaMurosOverride, periodo } = SEMESTRES[semestre];

// Soma PLANEJADO e REALIZADO das 6 linhas do semestre (colunas 2 e 4 da aba GERAL).
function somaSemestre(sheetRows, linhaInicio) {
  let planejado = 0, realizado = 0;
  for (let r = linhaInicio; r < linhaInicio + 6; r++) {
    const row = sheetRows[r];
    if (!row) continue;
    if (typeof row[2] === "number") planejado += row[2];
    if (typeof row[4] === "number") realizado += row[4];
  }
  return { planejado, realizado };
}

const wbCasas = XLSX.readFile(fileCasas, { cellDates: true });
const wsCasas = wbCasas.Sheets[`GERAL 26.${semestre.slice(-1)}`] || wbCasas.Sheets["GERAL 26.2"] || wbCasas.Sheets["GERAL 26.1"];
const rowsCasas = XLSX.utils.sheet_to_json(wsCasas, { header: 1, raw: true, defval: "" });
const casasSemestre = somaSemestre(rowsCasas, linhaInicioCasas);

const wbMuros = XLSX.readFile(fileMuros, { cellDates: true });
const wsMuros = wbMuros.Sheets[`GERAL 26.${semestre.slice(-1)}`] || wbMuros.Sheets["GERAL 26.1"] || wbMuros.Sheets["GERAL 26.2"];
const rowsMuros = XLSX.utils.sheet_to_json(wsMuros, { header: 1, raw: true, defval: "" });
const murosSemestre = somaSemestre(rowsMuros, linhaInicioMuros);
// "META MUROS" fica na linha logo acima do cabeçalho da tabela, coluna 8.
const metaMurosDaAba = rowsMuros[linhaInicioMuros - 2]?.[8];
const metaMuros = metaMurosOverride ?? (typeof metaMurosDaAba === "number" ? metaMurosDaAba : murosSemestre.planejado);

const resultado = {
  periodo,
  casas: { meta: casasSemestre.planejado, realizado: casasSemestre.realizado },
  muros: { meta: metaMuros, realizado: murosSemestre.realizado },
};

const chaveArquivo = semestre.replace(".", "_");
writeFileSync(new URL(`../processed/metas_${chaveArquivo}.json`, import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
console.log(JSON.stringify(resultado, null, 2));
