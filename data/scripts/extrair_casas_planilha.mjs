#!/usr/bin/env node
/**
 * Extrai a aba "DADOS CASA" de uma ou mais planilhas de controle de produção
 * (formato "CONTROLE DE UGB - CA - AAAA.S.xlsm") e gera:
 *   data/processed/casas.json       — uma casa por linha, com as 5 macroetapas
 *   data/processed/casas_meta.json  — empreendimentos, equipes (GA) e supervisores
 *
 * Uso:
 *   npm install xlsx
 *   node data/scripts/extrair_casas_planilha.mjs "<planilha 1.xlsm>" ["<planilha 2.xlsm>" ...]
 *
 * Quando mais de um arquivo é passado (ex.: semestres diferentes do mesmo
 * controle), as casas são casadas por (empreendimento + código da casa) e,
 * em caso de conflito, fica a versão com mais macroetapas concluídas.
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Uso: node extrair_casas_planilha.mjs <planilha1.xlsm> [planilha2.xlsm ...]");
  process.exit(1);
}

function toIso(v) {
  return v instanceof Date && !isNaN(v) ? v.toISOString().slice(0, 10) : null;
}

// Colunas da aba DADOS CASA (linha 0 = título, linha 1 = cabeçalho, linha 2+ = dados)
const COL = {
  ga: 1, projeto: 2, empreendimento: 3, supervisor: 4, casa: 5, pacote: 6,
  dia: 8, mes: 9, ano: 10, produtividade: 12, // coluna M — produtividade total da casa
  radierData: 14, radierProd: 16,
  alvenariaData: 17, alvenariaProd: 19,
  acab2Data: 20, acab2Prod: 22,
  rebocoData: 23, rebocoProd: 25,
  acab1Data: 26, acab1Prod: 28,
};

const all = [];
for (const file of files) {
  const wb = XLSX.readFile(file, { cellDates: true });
  const ws = wb.Sheets["DADOS CASA"];
  if (!ws) { console.warn(`Aba "DADOS CASA" não encontrada em ${file}`); continue; }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const casa = (r[COL.casa] || "").toString().trim();
    const ga = (r[COL.ga] || "").toString().trim();
    if (!casa || !ga) continue;
    // A coluna PACOTE às vezes traz uma célula vazia formatada como data
    // (o serial zero do Excel, 1899-12-30) em vez de texto — nesse caso não
    // é uma data de fato, então descartamos.
    const pacoteRaw = r[COL.pacote];
    const pacote = pacoteRaw instanceof Date ? "" : (pacoteRaw || "").toString().trim();
    all.push({
      ga,
      projeto: (r[COL.projeto] || "").toString().trim(),
      empreendimento: (r[COL.empreendimento] || "").toString().trim(),
      supervisor: (r[COL.supervisor] || "").toString().trim(),
      casa,
      pacote,
      data_inicio: toIso(r[COL.dia]),
      mes: r[COL.mes] || null,
      ano: r[COL.ano] || null,
      produtividade_total: typeof r[COL.produtividade] === "number" ? r[COL.produtividade] : null,
      etapas: {
        radier: { data: toIso(r[COL.radierData]), producao: typeof r[COL.radierProd] === "number" ? r[COL.radierProd] : null },
        alvenaria: { data: toIso(r[COL.alvenariaData]), producao: typeof r[COL.alvenariaProd] === "number" ? r[COL.alvenariaProd] : null },
        acab2_coberta: { data: toIso(r[COL.acab2Data]), producao: typeof r[COL.acab2Prod] === "number" ? r[COL.acab2Prod] : null },
        reboco_int_ext: { data: toIso(r[COL.rebocoData]), producao: typeof r[COL.rebocoProd] === "number" ? r[COL.rebocoProd] : null },
        acab1: { data: toIso(r[COL.acab1Data]), producao: typeof r[COL.acab1Prod] === "number" ? r[COL.acab1Prod] : null },
      },
    });
  }
}

const completude = (r) => Object.values(r.etapas).filter((e) => e.data).length;
const byKey = new Map();
for (const r of all) {
  const k = `${r.empreendimento}__${r.casa}`;
  const existing = byKey.get(k);
  if (!existing || completude(r) > completude(existing)) byKey.set(k, r);
}
const deduped = [...byKey.values()];

// Algumas linhas ficam sem EMP. preenchido na planilha de origem; o prefixo
// do código da casa (ex.: "XXIII 12K" -> "XXIII") identifica o empreendimento
// de forma inequívoca nas demais linhas, então usamos isso para completar.
const prefixo = (casa) => casa.split(/[0-9]/)[0].trim();
const empreendimentoPorPrefixo = new Map();
for (const r of deduped) {
  if (r.empreendimento) empreendimentoPorPrefixo.set(prefixo(r.casa), r.empreendimento);
}
for (const r of deduped) {
  if (!r.empreendimento) r.empreendimento = empreendimentoPorPrefixo.get(prefixo(r.casa)) || "";
}

const ORDEM = ["radier", "alvenaria", "acab2_coberta", "reboco_int_ext", "acab1"];
for (const r of deduped) {
  let concluidas = 0;
  for (const et of ORDEM) { if (r.etapas[et].data) concluidas++; else break; }
  r.macroetapas_concluidas = concluidas;
  r.status = concluidas === 5 ? "concluida" : concluidas === 0 ? "nao_iniciada" : "em_producao";
  r.etapa_atual = concluidas === 5 ? "entregue" : ORDEM[concluidas];
}

const empreendimentos = [...new Set(deduped.map((r) => r.empreendimento).filter(Boolean))].sort();
const equipes = [...new Set(deduped.map((r) => r.ga).filter(Boolean))].sort();
const supervisorPorEquipe = {};
deduped.forEach((r) => { if (r.ga && r.supervisor) supervisorPorEquipe[r.ga] = r.supervisor; });

const OUT = new URL("../processed/", import.meta.url);
writeFileSync(new URL("casas.json", OUT), JSON.stringify(deduped, null, 2), "utf8");
writeFileSync(new URL("casas_meta.json", OUT), JSON.stringify({ empreendimentos, equipes, supervisorPorEquipe }, null, 2), "utf8");

console.log(`Casas: ${deduped.length} | Empreendimentos: ${empreendimentos.length} | Equipes: ${equipes.length}`);
console.log({
  concluida: deduped.filter((r) => r.status === "concluida").length,
  em_producao: deduped.filter((r) => r.status === "em_producao").length,
  nao_iniciada: deduped.filter((r) => r.status === "nao_iniciada").length,
});
