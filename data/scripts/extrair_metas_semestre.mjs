#!/usr/bin/env node
/**
 * Gera data/processed/metas_2026_2.json com a meta e o realizado do 2º
 * semestre de 2026 para casas e muros, a partir da aba "GERAL" (resumo
 * mensal PLANEJADO/PROJETADO/REALIZADO) das duas planilhas de controle.
 *
 * A meta de muros (404) é a informada pela gestão — a aba GERAL da
 * planilha de muros só tem a projeção (402), desatualizada.
 *
 * Uso:
 *   node data/scripts/extrair_metas_semestre.mjs "<CONTROLE ... CA - 2026.2.xlsm>" "<CONTROLE ... Muros.xlsm>"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const [fileCasas, fileMuros] = process.argv.slice(2);
if (!fileCasas || !fileMuros) {
  console.error('Uso: node extrair_metas_semestre.mjs "CONTROLE ... CA - 2026.2.xlsm" "CONTROLE ... Muros.xlsm"');
  process.exit(1);
}

const META_MUROS_INFORMADA = 404;

// Soma PLANEJADO e REALIZADO de julho a dezembro (colunas 2 e 4 da aba
// GERAL) nas linhas do 2º semestre.
function somaSemestre(sheetRows, linhaInicio, linhaFim) {
  let planejado = 0, realizado = 0;
  for (let r = linhaInicio; r <= linhaFim; r++) {
    const row = sheetRows[r];
    if (!row) continue;
    if (typeof row[2] === "number") planejado += row[2];
    if (typeof row[4] === "number") realizado += row[4];
  }
  return { planejado, realizado };
}

const wbCasas = XLSX.readFile(fileCasas, { cellDates: true });
const wsCasas = wbCasas.Sheets["GERAL 26.2"] || wbCasas.Sheets["GERAL 26.1"];
const rowsCasas = XLSX.utils.sheet_to_json(wsCasas, { header: 1, raw: true, defval: "" });
// linhas 8-13 = julho a dezembro de 2026 (ver cabeçalho na linha 1).
const casasSemestre = somaSemestre(rowsCasas, 8, 13);

const wbMuros = XLSX.readFile(fileMuros, { cellDates: true });
const wsMuros = wbMuros.Sheets["GERAL 26.1"] || wbMuros.Sheets["GERAL 26.2"];
const rowsMuros = XLSX.utils.sheet_to_json(wsMuros, { header: 1, raw: true, defval: "" });
// bloco de muros começa na linha 44; julho a dezembro = linhas 52-57.
const murosSemestre = somaSemestre(rowsMuros, 52, 57);

const resultado = {
  periodo: "2026.2 (julho a dezembro de 2026)",
  casas: { meta: casasSemestre.planejado, realizado: casasSemestre.realizado },
  muros: { meta: META_MUROS_INFORMADA, realizado: murosSemestre.realizado },
};

writeFileSync(new URL("../processed/metas_2026_2.json", import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
console.log(JSON.stringify(resultado, null, 2));
