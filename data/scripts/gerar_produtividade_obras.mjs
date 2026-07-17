#!/usr/bin/env node
/**
 * Gera data/processed/produtividade_obras.json: produtividade média mensal
 * (campo "producao" de cada macroetapa concluída, na aba DADOS CASA) por
 * condomínio — usado no gráfico de evolução da Visão Geral.
 *
 * Cada condomínio foi construído em sequência (não em paralelo — as datas
 * de cada um praticamente não se sobrepõem), então o resultado é uma série
 * por obra, cada uma com sua própria janela de meses, em vez de um único
 * eixo temporal compartilhado.
 *
 * Rodar depois de atualizar casas.json (ver extrair_casas_planilha.mjs).
 */
import { readFileSync, writeFileSync } from "fs";

const HERE = new URL(".", import.meta.url);
const casas = JSON.parse(readFileSync(new URL("../processed/casas.json", HERE), "utf8"));

const NOME_CANONICO = {
  "Rec. Laranjeiras": "Laranjeiras",
  "Rec. Cerejeiras": "Cerejeiras",
  "CONDOMINIO CEREJEIRAS": "Cerejeiras",
  "CONDOMINIO OLIVEIRAS": "Oliveiras",
  "CONDOMINIO AMOREIRAS": "Amoreiras",
};
const ETAPAS = ["radier", "alvenaria", "acab2_coberta", "reboco_int_ext", "acab1"];

const acumulador = {}; // nome -> { "2026-01": { soma, qtd } }
for (const c of casas) {
  const nome = NOME_CANONICO[c.empreendimento];
  if (!nome) continue;
  for (const et of ETAPAS) {
    const e = c.etapas[et];
    if (!e.data || typeof e.producao !== "number") continue;
    const mes = e.data.slice(0, 7);
    acumulador[nome] ??= {};
    acumulador[nome][mes] ??= { soma: 0, qtd: 0 };
    acumulador[nome][mes].soma += e.producao;
    acumulador[nome][mes].qtd += 1;
  }
}

const resultado = {};
for (const [nome, porMes] of Object.entries(acumulador)) {
  const meses = Object.keys(porMes).sort();
  resultado[nome] = {
    meses,
    valores: meses.map((m) => Math.round((porMes[m].soma / porMes[m].qtd) * 100) / 100),
  };
}

const ORDEM = ["Amoreiras", "Oliveiras", "Cerejeiras", "Laranjeiras"];
const ordenado = Object.fromEntries(ORDEM.filter((n) => resultado[n]).map((n) => [n, resultado[n]]));

writeFileSync(new URL("../processed/produtividade_obras.json", HERE), JSON.stringify(ordenado, null, 2), "utf8");
for (const [nome, d] of Object.entries(ordenado)) {
  console.log(`${nome}: ${d.meses.length} meses, ${d.meses[0]} a ${d.meses[d.meses.length - 1]}, média geral ${(d.valores.reduce((a, v) => a + v, 0) / d.valores.length).toFixed(2)}`);
}
