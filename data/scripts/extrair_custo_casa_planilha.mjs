#!/usr/bin/env node
/**
 * Extrai o grupo de conta "CUSTO CASA" (01.05) e seus 4 subitens (MATERIAL,
 * SERVIÇO, PESSOAL, OUTROS CUSTOS) das abas RL/RC/RO/RA da planilha
 * "PROVISÕES CUSTO GLOBAL - AAAA.MM.xlsb", comparando o primeiro orçamento
 * registrado (baseline) com o snapshot mais recente disponível em cada aba,
 * e calcula o custo por casa (valor / lotes) em cada ponto.
 *
 * Cada aba tem uma "fotografia" do orçamento lançada periodicamente numa
 * nova coluna (P0, R1, R2, ... "FOTOGRAFIA dd/mm"); a linha 4 (índice 4,
 * zero-based) marca com uma data/rótulo a primeira coluna de cada fotografia
 * — por isso ela é usada aqui para localizar as colunas de valor de forma
 * robusta, já que o layout de colunas não é idêntico entre as abas.
 *
 * Uso:
 *   npm install xlsx
 *   node data/scripts/extrair_custo_casa_planilha.mjs "<planilha .xlsb>"
 */
import XLSX from "xlsx";
import { readFileSync, writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_custo_casa_planilha.mjs "PROVISÕES CUSTO GLOBAL - AAAA.MM.xlsb"');
  process.exit(1);
}

const SHEETS = { RL: "Laranjeiras", RC: "Cerejeiras", RO: "Oliveiras", RA: "Amoreiras" };
const SUBCONTAS = ["MATERIAL", "SERVIÇO", "PESSOAL", "OUTROS CUSTOS"];

// A contagem de lotes lançada no cabeçalho de cada aba desta planilha às
// vezes está desatualizada/errada (ex.: aba RA dizia 503 quando o
// empreendimento tem 505 casas cadastradas de fato). obras_reais.json vem da
// planilha DADOS CASA (ver extrair_casas_planilha.mjs) e é a fonte confiável
// da contagem real — tem prioridade sobre o rótulo da aba de custo.
const OUT_DIR = new URL("../processed/", import.meta.url);
let lotesReais = {};
try {
  const obrasReais = JSON.parse(readFileSync(new URL("obras_reais.json", OUT_DIR), "utf8"));
  lotesReais = Object.fromEntries(obrasReais.map((o) => [o.empreendimento, o.total]));
} catch { /* segue sem override se o arquivo não existir */ }

const wb = XLSX.readFile(file, { cellDates: true });
const resultado = {};

for (const [aba, nomeObra] of Object.entries(SHEETS)) {
  const ws = wb.Sheets[aba];
  if (!ws) { console.warn(`Aba "${aba}" não encontrada.`); continue; }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

  const lotesAba = Number(rows[2]?.[1]) || null;
  const lotes = lotesReais[nomeObra] ?? lotesAba;
  if (lotesReais[nomeObra] != null && lotesAba != null && lotesReais[nomeObra] !== lotesAba) {
    console.warn(`${nomeObra}: aba de custo diz ${lotesAba} lotes, usando ${lotes} (obras_reais.json).`);
  }

  const row4 = rows[4] || [];
  const valCols = [];
  for (let c = 8; c < row4.length; c++) if (String(row4[c]).trim() !== "") valCols.push(c);
  const colBaseline = valCols[0];
  const colAtual = valCols[valCols.length - 1];

  const custoCasaIdx = rows.findIndex((r) => /^CUSTO CASA$/i.test(String(r[2]).trim()) && String(r[8]).toUpperCase() === "SINTÉTICO");
  if (custoCasaIdx === -1) { console.warn(`"CUSTO CASA" não encontrado na aba ${aba}.`); continue; }
  const codigo = rows[custoCasaIdx][1];

  function valores(row) {
    const baseline = Number(row[colBaseline]) || 0;
    const atual = Number(row[colAtual]) || 0;
    return {
      baseline: Math.round(baseline),
      atual: Math.round(atual),
      custo_por_casa_baseline: lotes ? Math.round((baseline / lotes) * 100) / 100 : null,
      custo_por_casa_atual: lotes ? Math.round((atual / lotes) * 100) / 100 : null,
      variacao_pct: baseline ? Math.round(((atual - baseline) / baseline) * 1000) / 10 : null,
    };
  }

  const subcontas = {};
  for (const sub of SUBCONTAS) {
    const r = rows.find((row) => String(row[1]).startsWith(codigo + ".") && new RegExp(sub, "i").test(String(row[2])));
    if (r) subcontas[sub] = valores(r);
  }

  resultado[nomeObra] = {
    lotes,
    total: valores(rows[custoCasaIdx]),
    subcontas,
  };
}

const OUT = new URL("../processed/custo_casa.json", import.meta.url);
writeFileSync(OUT, JSON.stringify(resultado, null, 2), "utf8");
for (const [nome, d] of Object.entries(resultado)) {
  console.log(`${nome}: total ${GPBRL(d.total.atual)} | custo/casa ${d.total.custo_por_casa_atual} (${d.total.variacao_pct > 0 ? "+" : ""}${d.total.variacao_pct}% vs baseline)`);
}
function GPBRL(n) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n); }
