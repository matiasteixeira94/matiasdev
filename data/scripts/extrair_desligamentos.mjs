#!/usr/bin/env node
/**
 * Gera data/processed/desligamentos.json a partir da aba "Desligamentos"
 * da planilha "Gestão Pessoal - Produção.xls": quantidade de desligamentos
 * mês a mês e por função — sempre agregado, nunca nome ou motivo
 * individual do desligamento (dado sensível de RH).
 *
 * Uso:
 *   npm install xlsx
 *   node data/scripts/extrair_desligamentos.mjs "Gestão Pessoal - Produção.xls"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_desligamentos.mjs "Gestão Pessoal - Produção.xls"');
  process.exit(1);
}

const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets["Desligamentos"];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

// linha 1 (índice) = cabeçalho: Nomes, Função, (?), Data de admissão,
// Data do desligamento, setor, solicitação, Término de contrato,
// Término de Experiência, Desligamento empresa, Desligamento acordo,
// Justa causa, Falecimento
const COL = { funcao: 1, dataDesligamento: 4 };
const data = rows.slice(2).filter((r) => (r[0] || "").toString().trim());

const porMes = {};
const porFuncao = {};
for (const r of data) {
  const funcao = (r[COL.funcao] || "Não informada").toString().trim() || "Não informada";
  porFuncao[funcao] = (porFuncao[funcao] || 0) + 1;

  const d = r[COL.dataDesligamento];
  if (d instanceof Date && !isNaN(d)) {
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    porMes[chave] = (porMes[chave] || 0) + 1;
  }
}

const meses = Object.keys(porMes).sort();
const resumo = {
  total_registros: data.length,
  periodo: meses.length ? `${meses[0]} a ${meses[meses.length - 1]}` : null,
  por_mes: Object.fromEntries(meses.map((m) => [m, porMes[m]])),
  por_funcao: Object.fromEntries(Object.entries(porFuncao).sort((a, b) => b[1] - a[1])),
  atualizado_em: new Date().toISOString().slice(0, 10),
};

writeFileSync(new URL("../processed/desligamentos.json", import.meta.url), JSON.stringify(resumo, null, 2), "utf8");
console.log(JSON.stringify(resumo, null, 2));
