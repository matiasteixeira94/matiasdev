#!/usr/bin/env node
/**
 * Extrai o checklist de acabamento (relatório ChecklistVMC.csv) das 4 obras
 * atuais e gera data/processed/checklist_acabamento.json.
 *
 * O CSV só registra itens REPROVADOS (não existe linha "Aprovado") — cada
 * vistoria gera uma linha por problema encontrado. Não dá pra usar
 * "apareceu no CSV" como sinônimo de "ainda com pendência", porque uma
 * recontagem 100% limpa não gera nenhuma linha nova pra provar que foi
 * corrigido.
 *
 * O que resolve isso: a coluna "Tipo" tem um checklist específico —
 * "Checklist Final de Entrega" — que é o portão final antes da entrega,
 * feito DEPOIS do "Checklist da Casa Acabada" (que é o checklist de
 * trabalho, com bem mais itens). Quando o "Checklist Final de Entrega"
 * mais recente de uma casa não tem nenhum problema anotado, a casa está
 * liberada (sem pendência). Cada casa entra em 1 de 3 baldes:
 *   - "sem_pendencia": Checklist Final de Entrega mais recente sem problema.
 *   - "com_pendencia": tem alguma linha no checklist, mas o Final de Entrega
 *     mais recente ainda tem problema (ou a casa nunca teve um Final de
 *     Entrega, só Casa Acabada com problemas em aberto).
 *   - sem entrada no resultado: casa nunca apareceu no checklist (ainda não
 *     chegou nessa fase de vistoria) — a tela trata isso como "sem dados".
 *
 * O índice de problemas por tipo usa o histórico completo (todas as
 * vistorias, todos os tipos), pra mostrar o que mais apareceu ao longo do
 * tempo, não só o estado atual.
 *
 * Uso:
 *   node data/scripts/extrair_checklist_acabamento.mjs "ChecklistVMC.csv"
 */
import { readFileSync, writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_checklist_acabamento.mjs "ChecklistVMC.csv"');
  process.exit(1);
}

function parseCsvLine(line) {
  const out = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ";") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const rawLines = text.split(/\r?\n/);
  const rows = [];
  let buffer = "";
  for (const rl of rawLines) {
    buffer = buffer ? buffer + "\n" + rl : rl;
    if (((buffer.match(/"/g) || []).length) % 2 === 0) { rows.push(buffer); buffer = ""; }
  }
  if (buffer) rows.push(buffer);
  return rows.filter((r) => r.trim()).map(parseCsvLine);
}

const VILA_PARA_EMPREENDIMENTO = {
  "CONDOMINIO LARANJEIRAS": "Laranjeiras",
  "CONDOMINIO CEREJEIRAS": "Cerejeiras",
  "CONDOMINIO OLIVEIRAS": "Oliveiras",
  "CONDOMINIO AMOREIRAS": "Amoreiras",
};
const EMPREENDIMENTOS = ["Laranjeiras", "Cerejeiras", "Oliveiras", "Amoreiras"];
const FINAL_ENTREGA = "Checklist Final de Entrega";

const rows = parseCsv(readFileSync(file, "utf8"));
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const data = rows.slice(1).filter((r) => VILA_PARA_EMPREENDIMENTO[r[idx.Vila]]);

function numeroDoLote(casaCodigo) {
  const m = (casaCodigo || "").trim().match(/(\d+)[A-Z]*\s*$/);
  return m ? Number(m[1]) : null;
}

const porLote = {};
for (const emp of EMPREENDIMENTOS) porLote[emp] = {};
for (const r of data) {
  const emp = VILA_PARA_EMPREENDIMENTO[r[idx.Vila]];
  const numero = numeroDoLote(r[idx.Casa]);
  if (numero == null) continue;
  porLote[emp][numero] ??= [];
  porLote[emp][numero].push({
    data: (r[idx.DataVistoria] || "").slice(0, 10),
    tipo: r[idx.Tipo],
    problema: (r[idx.Problema] || "").trim(),
  });
}

const resultado = { empreendimentos: {}, indice_problemas: {}, atualizado_em: new Date().toISOString().slice(0, 10) };

for (const emp of EMPREENDIMENTOS) {
  const lotes = porLote[emp];
  const semPendencia = [];
  const comPendencia = [];
  const indiceEmp = {};

  for (const [numeroStr, visitas] of Object.entries(lotes)) {
    const numero = Number(numeroStr);
    for (const v of visitas) if (v.problema) indiceEmp[v.problema] = (indiceEmp[v.problema] || 0) + 1;

    const finaisEntrega = visitas.filter((v) => v.tipo === FINAL_ENTREGA);
    if (finaisEntrega.length) {
      const maxData = finaisEntrega.reduce((a, v) => (v.data > a ? v.data : a), "");
      const naUltima = finaisEntrega.filter((v) => v.data === maxData);
      if (naUltima.every((v) => !v.problema)) { semPendencia.push({ numero, data: maxData }); continue; }
    }

    // ainda com pendência: usa os problemas da vistoria (de qualquer tipo)
    // mais recente pra listar o que falta.
    const maxData = visitas.reduce((a, v) => (v.data > a ? v.data : a), "");
    const problemasAtuais = [...new Set(visitas.filter((v) => v.data === maxData && v.problema).map((v) => v.problema))];
    comPendencia.push({ numero, data: maxData, problemas: problemasAtuais });
  }

  resultado.empreendimentos[emp] = {
    lotes_sem_pendencia: semPendencia.sort((a, b) => a.numero - b.numero),
    lotes_com_pendencia: comPendencia.sort((a, b) => a.numero - b.numero),
  };
  resultado.indice_problemas[emp] = Object.fromEntries(Object.entries(indiceEmp).sort((a, b) => b[1] - a[1]));
}

const indiceGeral = {};
for (const emp of EMPREENDIMENTOS) {
  for (const [tipo, n] of Object.entries(resultado.indice_problemas[emp])) indiceGeral[tipo] = (indiceGeral[tipo] || 0) + n;
}
resultado.indice_problemas.Geral = Object.fromEntries(Object.entries(indiceGeral).sort((a, b) => b[1] - a[1]));

writeFileSync(new URL("../processed/checklist_acabamento.json", import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
for (const emp of EMPREENDIMENTOS) {
  const e = resultado.empreendimentos[emp];
  console.log(`${emp}: ${e.lotes_sem_pendencia.length} sem pendência, ${e.lotes_com_pendencia.length} com pendência`);
}
console.log("Índice geral (top 5):", Object.entries(resultado.indice_problemas.Geral).slice(0, 5));
