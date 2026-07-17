#!/usr/bin/env node
/**
 * Gera data/processed/seguranca_nao_conformidades.json a partir da planilha
 * "CONTROLE RECOMENDAÇÕES" (aba "Segurança") — não conformidades de
 * segurança observadas em campo e a medida disciplinar recomendada.
 *
 * ATENÇÃO — mesmo critério de privacidade da saúde ocupacional: a planilha
 * de origem tem nome do colaborador, descrição da não conformidade e quem
 * aplicou a medida. Este script NUNCA grava nome, descrição textual da
 * ocorrência ou quem aplicou — só contagens agregadas por categoria.
 *
 * Uso:
 *   npm install xlsx
 *   node data/scripts/extrair_seguranca_planilha.mjs "CONTROLE RECOMENDAÇÕES - REV. 1.0.xlsm"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_seguranca_planilha.mjs "CONTROLE RECOMENDAÇÕES - REV. 1.0.xlsm"');
  process.exit(1);
}

const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets["Segurança"];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

// linha 2 (índice) = cabeçalho: DATA, UGB, CHAPA, Coluna1(nome), SETOR, GA,
// LÍDER, NÃO CONFORMIDADE IDENTIFICADA, MEDIDA DISCIPLINAR RECOMENDADA,
// DIAS SUSPENSO, SITUAÇÃO SANADA?, RECOMENDAÇÃO, TST QUE APLICOU
const COL = { data: 1, setor: 5, medida: 9, diasSuspenso: 10, sanada: 11 };
const data = rows.slice(3).filter((r) => (r[COL.data] instanceof Date) || (r[COL.medida] || "").toString().trim());

function count(mapper) {
  const out = {};
  for (const r of data) {
    const k = mapper(r);
    if (k == null) continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// Normaliza grafias/erros de digitação repetidos na planilha de origem.
function normalizaMedida(texto) {
  const t = (texto || "").toString().trim().toUpperCase();
  if (!t) return "Não informada";
  if (t.includes("ESCRITA")) return "Advertência escrita";
  if (t.includes("VERBAL")) return "Advertência verbal";
  if (t.includes("RETREINAMENTO")) return "Retreinamento";
  if (t.includes("TREINAMENTO")) return "Treinamento";
  if (t.includes("SUSPENS")) return "Suspensão";
  return "Outra";
}

function normalizaSanada(texto) {
  const t = (texto || "").toString().trim().toUpperCase();
  if (t === "SANADA" || t === "SANADO") return "Sanada";
  if (t === "PENDENTE") return "Pendente";
  return "Não informado";
}

const porAno = count((r) => (r[COL.data] instanceof Date ? r[COL.data].getFullYear() : null));

const resumo = {
  total_registros: data.length,
  por_setor: count((r) => (r[COL.setor] || "Não informado").toString().trim() || "Não informado"),
  por_medida: count((r) => normalizaMedida(r[COL.medida])),
  sanada: count((r) => normalizaSanada(r[COL.sanada])),
  por_ano: Object.fromEntries(Object.entries(porAno).sort((a, b) => a[0] - b[0])),
  atualizado_em: new Date().toISOString().slice(0, 10),
};

const OUT = new URL("../processed/seguranca_nao_conformidades.json", import.meta.url);
writeFileSync(OUT, JSON.stringify(resumo, null, 2), "utf8");
console.log(JSON.stringify(resumo, null, 2));
