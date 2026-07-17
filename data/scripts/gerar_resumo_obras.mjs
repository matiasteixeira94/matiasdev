#!/usr/bin/env node
/**
 * Gera data/processed/obras_reais.json a partir de data/processed/casas.json:
 * um resumo por condomínio — total de casas planejado, casas concluídas e o
 * percentual de conclusão — usado no cartão "Obras" da Visão Geral.
 *
 * Só os 4 condomínios entregues pela UGB Caruaru entram nesse resumo (as
 * frentes Xique-xique ficam de fora, por instrução explícita). Nomes vindos
 * da planilha com grafias diferentes para o mesmo condomínio (ex.: "Rec.
 * Cerejeiras" e "CONDOMINIO CEREJEIRAS") são somados em uma única linha.
 *
 * Rodar depois de atualizar casas.json (ver extrair_casas_planilha.mjs).
 */
import { readFileSync, writeFileSync } from "fs";

const HERE = new URL(".", import.meta.url);
const casas = JSON.parse(readFileSync(new URL("../processed/casas.json", HERE), "utf8"));

// Mapeia as grafias da planilha para o nome canônico do condomínio; tudo que
// não está aqui (as frentes Xique-xique) fica de fora do resumo.
const NOME_CANONICO = {
  "Rec. Laranjeiras": "Laranjeiras",
  "Rec. Cerejeiras": "Cerejeiras",
  "CONDOMINIO CEREJEIRAS": "Cerejeiras",
  "CONDOMINIO OLIVEIRAS": "Oliveiras",
  "CONDOMINIO AMOREIRAS": "Amoreiras",
};

// Total de casas contratado/planejado por condomínio, quando maior que o que
// a planilha "DADOS CASA" rastreia linha a linha (ex.: Amoreiras tem 505
// casas no total, mas só 189 aparecem detalhadas nessa aba).
const TOTAL_PLANEJADO_OVERRIDE = {
  Amoreiras: 505,
};

// Condomínios confirmados como 100% concluídos (todas as casas entregues),
// mesmo quando a aba "DADOS CASA" não tem todas as linhas marcadas como
// concluídas — a planilha de origem não é a fonte definitiva de conclusão
// para essas obras.
const CONCLUIDO_OVERRIDE = new Set(["Laranjeiras", "Oliveiras"]);

const porObra = new Map();
for (const c of casas) {
  const nome = NOME_CANONICO[c.empreendimento];
  if (!nome) continue;
  if (!porObra.has(nome)) porObra.set(nome, { empreendimento: nome, total_rastreado: 0, concluida: 0 });
  const o = porObra.get(nome);
  o.total_rastreado++;
  if (c.status === "concluida") o.concluida++;
}

const ORDEM = ["Amoreiras", "Oliveiras", "Cerejeiras", "Laranjeiras"];
const obras = ORDEM.map((nome) => {
  const o = porObra.get(nome) ?? { empreendimento: nome, total_rastreado: 0, concluida: 0 };
  const total = TOTAL_PLANEJADO_OVERRIDE[nome] ?? o.total_rastreado;
  const concluida = CONCLUIDO_OVERRIDE.has(nome) ? total : o.concluida;
  return {
    empreendimento: nome,
    total,
    concluida,
    pct_concluido: Math.round((concluida / total) * 1000) / 10,
  };
});

writeFileSync(new URL("../processed/obras_reais.json", HERE), JSON.stringify(obras, null, 2), "utf8");
console.log(obras.map((o) => `${o.empreendimento}: ${o.concluida}/${o.total} (${o.pct_concluido}%)`).join("\n"));
