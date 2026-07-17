#!/usr/bin/env node
/**
 * Extrai a lista de colaboradores ATIVOS da aba "Quadro Geral" da planilha
 * "Gestão Pessoal - Produção.xls" e grava data/processed/pessoal_ativos.json.
 *
 * Importante: este repositório é público no GitHub. Por decisão explícita
 * (2026-07-17), a lista pública traz nome + função/setor/tipo/tempo de
 * empresa — mas NUNCA CPF, PIS, data de nascimento ou idade, que continuam
 * só na planilha de origem.
 *
 * Uso:
 *   npm install xlsx
 *   node data/scripts/extrair_pessoal_ativos.mjs "Gestão Pessoal - Produção.xls"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_pessoal_ativos.mjs "Gestão Pessoal - Produção.xls"');
  process.exit(1);
}

const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets["Quadro Geral"];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

// linha 5 (índice) = cabeçalho: NOME, CHAPA, TEMPO DE EMPRESA, DATA ADMISSAO,
// SETOR, FUNCAO, TIPO, CODSITUACAO, ANIVERSARIO, DATA HOJE, IDADE, CPF, PIS
const COL = { nome: 0, tempoEmpresa: 2, dataAdmissao: 3, setor: 4, funcao: 5, tipo: 6, situacao: 7 };

function toIso(v) {
  return v instanceof Date && !isNaN(v) ? v.toISOString().slice(0, 10) : null;
}

const data = rows.slice(6).filter((r) => (r[COL.nome] || "").toString().trim());
const ativos = data
  .filter((r) => (r[COL.situacao] || "").toString().trim() === "Ativo")
  .map((r) => ({
    nome: r[COL.nome].toString().trim(),
    funcao: (r[COL.funcao] || "").toString().trim(),
    setor: (r[COL.setor] || "").toString().trim(),
    tipo: (r[COL.tipo] || "").toString().trim(),
    data_admissao: toIso(r[COL.dataAdmissao]),
    tempo_empresa_anos: typeof r[COL.tempoEmpresa] === "number" ? Math.round(r[COL.tempoEmpresa] * 10) / 10 : null,
  }))
  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

writeFileSync(new URL("../processed/pessoal_ativos.json", import.meta.url), JSON.stringify(ativos, null, 2), "utf8");
console.log(`${ativos.length} colaboradores ativos gravados em pessoal_ativos.json`);
