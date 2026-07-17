#!/usr/bin/env node
/**
 * Marca manualmente um ou mais lotes como "muro concluído" em
 * data/processed/muros.json — para quando a equipe informa que terminou
 * um muro antes de isso aparecer na próxima planilha de controle.
 *
 * Uso:
 *   node data/scripts/marcar_muro_concluido.mjs <Empreendimento> <lotes> [data=AAAA-MM-DD] [ga="Nome"] [supervisor="Nome"]
 *
 * <lotes> aceita um intervalo ("130-137") ou uma lista separada por vírgula
 * ("130,131,137"). Empreendimento: Laranjeiras | Cerejeiras | Oliveiras | Amoreiras.
 *
 * Exemplo:
 *   node data/scripts/marcar_muro_concluido.mjs Amoreiras 130-137
 */
import { readFileSync, writeFileSync } from "fs";

const [empreendimento, faixa, ...resto] = process.argv.slice(2);
if (!empreendimento || !faixa) {
  console.error('Uso: node marcar_muro_concluido.mjs <Empreendimento> <130-137 ou 130,131,137> [data=AAAA-MM-DD] [ga="Nome"] [supervisor="Nome"]');
  process.exit(1);
}

const opts = {};
for (const arg of resto) {
  const [chave, ...valor] = arg.split("=");
  opts[chave] = valor.join("=");
}
const data = opts.data || new Date().toISOString().slice(0, 10);
const ga = opts.ga || null;
const supervisor = opts.supervisor || null;

let numeros;
if (faixa.includes("-")) {
  const [ini, fim] = faixa.split("-").map(Number);
  numeros = Array.from({ length: fim - ini + 1 }, (_, i) => ini + i);
} else {
  numeros = faixa.split(",").map(Number);
}

const PATH = new URL("../processed/muros.json", import.meta.url);
const muros = JSON.parse(readFileSync(PATH, "utf8"));
if (!muros[empreendimento]) {
  console.error(`Empreendimento "${empreendimento}" não encontrado em muros.json.`);
  process.exit(1);
}

const existentes = new Set(muros[empreendimento].lotes.map((l) => l.numero));
let adicionados = 0;
for (const numero of numeros) {
  if (existentes.has(numero)) { console.log(`Lote ${numero}: já estava marcado como concluído — ignorado.`); continue; }
  muros[empreendimento].lotes.push({ empreendimento, numero, ga, supervisor, data });
  adicionados++;
}
muros[empreendimento].lotes.sort((a, b) => a.numero - b.numero);
muros[empreendimento].concluidos = muros[empreendimento].lotes.length;

writeFileSync(PATH, JSON.stringify(muros, null, 2), "utf8");
console.log(`${empreendimento}: ${adicionados} lote(s) marcado(s) como muro concluído (${data}). Total agora: ${muros[empreendimento].concluidos}.`);
