#!/usr/bin/env node
/**
 * Extrai a aba "DADOS MURO" da planilha "CONTROLE DE UGB - CA - AAAA.S -
 * Muros.xlsm" e gera data/processed/muros.json: quais lotes de cada
 * condomínio já têm o muro (ou cisterna) construído.
 *
 * O código da casa nessa aba não segue o mesmo padrão da aba DADOS CASA:
 *   "M 137B"        -> Laranjeiras, lote 137 (não leva o prefixo do condomínio)
 *   "M RC 191S"     -> Cerejeiras, lote 191 (RC/RO/RA = prefixo do condomínio)
 * Cada linha é o lançamento de um lote com muro/cisterna já construído —
 * não há linha para lotes ainda pendentes, então "tem linha" = concluído.
 *
 * Uso:
 *   npm install xlsx
 *   node data/scripts/extrair_muros_planilha.mjs "<CONTROLE ... Muros.xlsm>"
 */
import XLSX from "xlsx";
import { writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_muros_planilha.mjs "CONTROLE DE UGB - CA - AAAA.S - Muros.xlsm"');
  process.exit(1);
}

const PREFIXO_EMPREENDIMENTO = { L: "Laranjeiras", C: "Cerejeiras", O: "Oliveiras", A: "Amoreiras" };

function toIso(v) {
  return v instanceof Date && !isNaN(v) ? v.toISOString().slice(0, 10) : null;
}

// "M 137B" (Laranjeiras, sem prefixo) ou "M RC 191S" / "M RC410Q" (com prefixo,
// às vezes sem o espaço entre o prefixo e o número).
function parseCasaMuro(valor) {
  const s = String(valor || "").trim();
  let m = s.match(/^M\s+R([LCOA])\s*0*([0-9]+)/i);
  if (m) return { empreendimento: PREFIXO_EMPREENDIMENTO[m[1].toUpperCase()], numero: Number(m[2]) };
  m = s.match(/^M\s+0*([0-9]+)[A-Z]*\s*$/i);
  if (m) return { empreendimento: "Laranjeiras", numero: Number(m[1]) };
  return null;
}

const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets["DADOS MURO"];
if (!ws) { console.error('Aba "DADOS MURO" não encontrada.'); process.exit(1); }
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

// linha 0 = título, linha 1 = cabeçalho, linha 2+ = dados.
const COL = { ga: 1, supervisor: 4, casa: 5, dia: 8, mes: 9, ano: 10 };

const porLote = {}; // "<empreendimento>_<numero>" -> registro (fica o mais recente em caso de mais de uma linha)
for (const r of rows.slice(2)) {
  const parsed = parseCasaMuro(r[COL.casa]);
  if (!parsed) continue;
  const key = `${parsed.empreendimento}_${parsed.numero}`;
  const data = toIso(r[COL.dia]);
  const existente = porLote[key];
  if (existente && existente.data && data && existente.data >= data) continue;
  porLote[key] = {
    empreendimento: parsed.empreendimento,
    numero: parsed.numero,
    ga: String(r[COL.ga] || "").trim() || null,
    supervisor: String(r[COL.supervisor] || "").trim() || null,
    data,
  };
}

const EMPREENDIMENTOS = ["Laranjeiras", "Cerejeiras", "Oliveiras", "Amoreiras"];
const resultado = {};
for (const emp of EMPREENDIMENTOS) {
  const lotes = Object.values(porLote).filter((r) => r.empreendimento === emp).sort((a, b) => a.numero - b.numero);
  resultado[emp] = { concluidos: lotes.length, lotes };
}

writeFileSync(new URL("../processed/muros.json", import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
for (const [emp, d] of Object.entries(resultado)) console.log(`${emp}: ${d.concluidos} lotes com muro/cisterna concluído`);
