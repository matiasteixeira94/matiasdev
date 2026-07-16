#!/usr/bin/env node
/**
 * Gera data/processed/saude_ocupacional_resumo.json a partir da planilha de
 * Restrições e Queixas de saúde ocupacional.
 *
 * ATENÇÃO — dado sensível (LGPD art. 5º/11): a planilha de origem tem nome,
 * diagnóstico e histórico clínico individual de cada colaborador. Este
 * script NUNCA grava nome, cargo+condição, texto de histórico clínico ou
 * qualquer coluna que permita religar uma condição de saúde a uma pessoa
 * identificável — só contagens agregadas por categoria. Não altere este
 * script para exportar linhas individuais.
 *
 * Uso:
 *   npm install xlsx
 *   node data/scripts/extrair_saude_planilha.mjs "<planilha .xlsx>"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_saude_planilha.mjs "saude.xlsx"');
  process.exit(1);
}

const wb = XLSX.readFile(file, { cellDates: true });

function rowsOf(sheetName) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  return rows.slice(1).filter((r) => (r[0] || "").toString().trim() || (r[1] || "").toString().trim());
}

function bucketParteCorpo(texto) {
  const t = (texto || "").toString().toUpperCase();
  if (!t) return "Não informado";
  if (t.includes("OMBRO")) return "Ombro";
  if (t.includes("COLUNA") || t.includes("LOMBAR") || t.includes("TRONCO")) return "Coluna/Tronco";
  if (t.includes("JOELHO")) return "Joelho";
  if (t.includes("PUNHO") || t.includes("MÃO") || t.includes("MAO")) return "Punho/Mão";
  if (t.includes("COTOVELO")) return "Cotovelo";
  if (t.includes("MEMBROS SUPERIORES")) return "Membros superiores";
  if (t.includes("MEMBROS INFERIORES") || t.includes("TORNOZELO") || t.includes("PÉ") || t.includes("PE ")) return "Membros inferiores";
  if (t.includes("MÚLTIPLAS") || t.includes("MULTIPLAS")) return "Partes múltiplas";
  return "Outro";
}

function count(rows, mapper) {
  const out = {};
  for (const r of rows) {
    const k = mapper(r);
    if (k === null || k === undefined) continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// ---- Restrição ----
const restricao = rowsOf("Restrição");
// COL: 0 nome, 1 impedimento, 3 cargo, 4 setor, 6 parte do corpo, 7 tipo restrição, 9 status colaborador
const nomesUnicos = new Set(restricao.map((r) => (r[0] || "").toString().trim().toUpperCase()));

const restricaoResumo = {
  total_registros: restricao.length,
  colaboradores_unicos: nomesUnicos.size,
  por_status: count(restricao, (r) => (r[9] || "Não informado").toString().trim() || "Não informado"),
  por_tipo: count(restricao, (r) => (r[7] || "Não informado").toString().trim() || "Não informado"),
  por_parte_corpo: count(restricao, (r) => bucketParteCorpo(r[6])),
  com_impedimento_formal: restricao.filter((r) => {
    const v = (r[1] || "").toString().trim().toUpperCase();
    return v && v !== "NÃO";
  }).length,
};

// ---- Queixas ----
const queixas = rowsOf("Queixas");
// COL: 9 parte do corpo, 10 solicitou tratamento?, 14 consulta médico trabalho?,
// 16 possui restrição?, 20 data conclusão queixa, 23 observações (às vezes tem o status textual)
const queixasResumo = {
  total_registros: queixas.length,
  solicitaram_tratamento: queixas.filter((r) => (r[10] || "").toString().trim().toUpperCase() === "SIM").length,
  geraram_restricao: queixas.filter((r) => (r[16] || "").toString().trim().toUpperCase() === "SIM").length,
  por_parte_corpo: count(queixas, (r) => bucketParteCorpo(r[9])),
  status: count(queixas, (r) => {
    const concluida = (r[20] || "").toString().trim();
    if (concluida) return "Concluída";
    const obs = (r[23] || "").toString().trim().toUpperCase();
    if (obs.includes("AGUARDANDO")) return "Em acompanhamento";
    return "Não informado";
  }),
};

const resumo = {
  restricoes: restricaoResumo,
  queixas: queixasResumo,
  atualizado_em: new Date().toISOString().slice(0, 10),
};

const OUT = new URL("../processed/saude_ocupacional_resumo.json", import.meta.url);
writeFileSync(OUT, JSON.stringify(resumo, null, 2), "utf8");
console.log(JSON.stringify(resumo, null, 2));
