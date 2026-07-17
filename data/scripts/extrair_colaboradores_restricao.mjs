#!/usr/bin/env node
/**
 * Gera data/processed/colaboradores_restricao.json: nome, função, tipo de
 * restrição e há quanto tempo cada colaborador está em restrição.
 *
 * Diferente de extrair_saude_planilha.mjs (que só grava contagens
 * agregadas), este script grava nome — decisão explícita do usuário em
 * 2026-07-17, ciente de que liga uma condição de saúde a uma pessoa
 * identificável e de que o repositório é público no GitHub (confirmado:
 * "esse repositório vai ser visualizado só pela gestão"). NÃO adicione
 * aqui a parte do corpo, o detalhamento da restrição ou qualquer outro
 * campo clínico — só nome, função e tempo.
 *
 * Uso:
 *   npm install xlsx
 *   node data/scripts/extrair_colaboradores_restricao.mjs "<planilha .xlsx>"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_colaboradores_restricao.mjs "saude.xlsx"');
  process.exit(1);
}

const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets["Restrição"];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

// COL: 0 nome, 3 cargo, 5 data abertura, 7 tipo restrição
const COL = { nome: 0, cargo: 3, data: 5, tipo: 7 };
const data = rows.slice(1).filter((r) => (r[COL.nome] || "").toString().trim());

const HOJE = new Date();
function diasDesde(d) {
  return d instanceof Date && !isNaN(d) ? Math.round((HOJE - d) / 86400000) : null;
}

// Um colaborador pode ter mais de uma linha (restrições lançadas em datas
// diferentes) — fica a mais recente.
const porNome = new Map();
for (const r of data) {
  const nome = r[COL.nome].toString().trim();
  const dias = diasDesde(r[COL.data]);
  const atual = porNome.get(nome);
  if (!atual || (dias != null && (atual.dias == null || dias < atual.dias))) {
    porNome.set(nome, {
      nome,
      funcao: (r[COL.cargo] || "").toString().trim(),
      tipo: (r[COL.tipo] || "").toString().trim(),
      dias,
    });
  }
}

const lista = [...porNome.values()]
  .map((c) => ({ ...c, dias: c.dias ?? 0 }))
  .sort((a, b) => b.dias - a.dias);

writeFileSync(new URL("../processed/colaboradores_restricao.json", import.meta.url), JSON.stringify(lista, null, 2), "utf8");
console.log(`${lista.length} colaboradores com restrição gravados em colaboradores_restricao.json`);
