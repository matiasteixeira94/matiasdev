#!/usr/bin/env node
/**
 * Extrai um RESUMO AGREGADO da aba "Quadro Geral" da planilha de gestão de
 * pessoal ("Gestão Pessoal - Produção.xls") e grava data/processed/pessoal_resumo.json.
 *
 * Importante: este script NUNCA grava nome, CPF, PIS ou a situação
 * individual de cada colaborador — só contagens agregadas (total de
 * ativos, direto/indireto). Dados de identificação/documento de
 * colaboradores não devem ir para um repositório público.
 *
 * Uso:
 *   npm install xlsx
 *   node data/scripts/extrair_pessoal_planilha.mjs "Gestão Pessoal - Produção.xls"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_pessoal_planilha.mjs "Gestão Pessoal - Produção.xls"');
  process.exit(1);
}

const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets["Quadro Geral"];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

// linha 5 (índice) = cabeçalho: NOME, CHAPA, TEMPO DE EMPRESA, DATA ADMISSAO,
// SETOR, FUNCAO, TIPO, CODSITUACAO, ANIVERSARIO, DATA HOJE, IDADE, CPF, PIS
const COL = { setor: 4, funcao: 5, tipo: 6, situacao: 7 };
const data = rows.slice(6).filter((r) => (r[0] || "").toString().trim());

let ativos = 0;
let outrasSituacoes = 0;
let direto = 0;
let indireto = 0;
const porFuncao = {};

for (const r of data) {
  const situacao = (r[COL.situacao] || "").toString().trim();
  const tipo = (r[COL.tipo] || "").toString().trim();
  const funcao = (r[COL.funcao] || "").toString().trim();
  if (situacao === "Ativo") ativos++; else outrasSituacoes++;
  if (tipo === "DIRETO") direto++; else if (tipo === "INDIRETO") indireto++;
  if (situacao === "Ativo" && funcao) porFuncao[funcao] = (porFuncao[funcao] || 0) + 1;
}

const resumo = {
  total: data.length,
  ativos,
  outras_situacoes: outrasSituacoes,
  direto,
  indireto,
  por_funcao: Object.fromEntries(Object.entries(porFuncao).sort((a, b) => b[1] - a[1])),
  atualizado_em: new Date().toISOString().slice(0, 10),
};

const OUT = new URL("../processed/pessoal_resumo.json", import.meta.url);
writeFileSync(OUT, JSON.stringify(resumo, null, 2), "utf8");
console.log(resumo);
