#!/usr/bin/env node
/**
 * Completa data/processed/casas.json com casas que já começaram a construção
 * mas ainda não têm linha na aba "DADOS CASA" (que só recebe um lançamento
 * quando a casa tem alguma macroetapa concluída) — usando a aba "CONTROLE"
 * (cronograma corrente) da planilha "CONTROLE DE UGB - CA - AAAA.S.xlsm"
 * como fonte da informação mais recente de quais casas já foram iniciadas.
 *
 * Cada linha da aba CONTROLE é uma casa (coluna B/"id") com datas de início
 * (colunas "IN. ALV. D", "USO.RADIER S", "IN.CASA S"); casas ainda não
 * atribuídas usam um código genérico ("CASA12" etc.) em vez do código real
 * (ex. "RA 477R") — só as linhas com código real são usadas aqui, porque só
 * elas casam com o número de lote do mapa/planilha de custo.
 *
 * Isso é um "patch" pontual sobre casas.json — uma fotografia do cronograma
 * no momento em que a planilha foi enviada; rodar de novo quando quiser
 * atualizar com um cronograma mais recente (idempotente: casas que já
 * existem em casas.json, com qualquer status, não são sobrescritas).
 *
 * Uso:
 *   node data/scripts/atualizar_em_producao_controle.mjs "<CONTROLE DE UGB - CA - AAAA.S.xlsm>"
 */
import XLSX from "xlsx";
import { readFileSync, writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node atualizar_em_producao_controle.mjs "CONTROLE DE UGB - CA - AAAA.S.xlsm"');
  process.exit(1);
}

const HERE = new URL(".", import.meta.url);
const CASAS_PATH = new URL("../processed/casas.json", HERE);
const casas = JSON.parse(readFileSync(CASAS_PATH, "utf8"));
const existentes = new Set(casas.map((c) => `${c.empreendimento}__${c.casa}`));

// Só Amoreiras tem esse gap hoje; o prefixo do código indica o empreendimento
// (mesmo esquema de extrair_casas_planilha.mjs / gerar_mapa_lotes.mjs).
const EMPREENDIMENTO_POR_PREFIXO = { RL: "Rec. Laranjeiras", RC: "Rec. Cerejeiras", RO: "CONDOMINIO OLIVEIRAS", RA: "CONDOMINIO AMOREIRAS" };

function toIso(v) {
  return v instanceof Date && !isNaN(v) ? v.toISOString().slice(0, 10) : null;
}

const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets["CONTROLE"];
if (!ws) { console.error('Aba "CONTROLE" não encontrada.'); process.exit(1); }
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

// linha 6 (0-based) é o cabeçalho da aba CONTROLE.
const header = rows[6];
const idx = {};
header.forEach((h, i) => { if (h !== "") idx[h] = i; });

let adicionadas = 0, jaExistiam = 0, ignoradas = 0;
for (const r of rows.slice(9)) {
  const casaCode = String(r[idx["id"]] || "").trim();
  const m = casaCode.match(/^(R[LCOA])\s/);
  if (!m) { ignoradas++; continue; }
  const empreendimento = EMPREENDIMENTO_POR_PREFIXO[m[1]];
  const key = `${empreendimento}__${casaCode}`;
  if (existentes.has(key)) { jaExistiam++; continue; }

  const inCasaS = r[idx["IN.CASA S"]];
  const inAlvD = r[idx["IN. ALV. D"]];
  const usoRadierS = r[idx["USO.RADIER S"]];
  const dataInicio = toIso(inCasaS) || toIso(inAlvD);
  if (!dataInicio) { ignoradas++; continue; } // sem data de início real = ainda não começou de fato

  const radierFeito = usoRadierS instanceof Date && !isNaN(usoRadierS);
  casas.push({
    ga: String(r[idx["GA"]] || "").trim(),
    projeto: String(r[idx["PROJ"]] || "").trim(),
    empreendimento,
    supervisor: String(r[idx["SUPERVISOR"]] || "").trim(),
    casa: casaCode,
    pacote: "",
    data_inicio: dataInicio,
    mes: r[idx["MÊS"]] || null,
    ano: r[idx["ANO"]] || null,
    produtividade_total: null,
    etapas: {
      radier: { data: radierFeito ? toIso(usoRadierS) : null, producao: null },
      alvenaria: { data: null, producao: null },
      acab2_coberta: { data: null, producao: null },
      reboco_int_ext: { data: null, producao: null },
      acab1: { data: null, producao: null },
    },
    macroetapas_concluidas: radierFeito ? 1 : 0,
    status: "em_producao",
    etapa_atual: radierFeito ? "alvenaria" : "radier",
    _origem: "CONTROLE (cronograma em andamento, sem lançamento ainda em DADOS CASA)",
  });
  existentes.add(key);
  adicionadas++;
}

writeFileSync(CASAS_PATH, JSON.stringify(casas, null, 2), "utf8");
console.log(`Casas adicionadas (em produção, via CONTROLE): ${adicionadas}`);
console.log(`Já existiam em casas.json: ${jaExistiam} | Ignoradas (sem código real ou sem data de início): ${ignoradas}`);
