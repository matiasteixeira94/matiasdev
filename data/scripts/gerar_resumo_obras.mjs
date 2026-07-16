#!/usr/bin/env node
/**
 * Gera data/processed/obras_reais.json a partir de data/processed/casas.json:
 * um resumo por empreendimento (obra) — total de casas, casas concluídas, em
 * produção e não iniciadas — usado na Visão Geral. Rodar depois de atualizar
 * casas.json (ver extrair_casas_planilha.mjs).
 */
import { readFileSync, writeFileSync } from "fs";

const HERE = new URL(".", import.meta.url);
const casas = JSON.parse(readFileSync(new URL("../processed/casas.json", HERE), "utf8"));

const porEmp = new Map();
for (const c of casas) {
  if (!porEmp.has(c.empreendimento)) {
    porEmp.set(c.empreendimento, { empreendimento: c.empreendimento, total: 0, concluida: 0, em_producao: 0, nao_iniciada: 0 });
  }
  const e = porEmp.get(c.empreendimento);
  e.total++;
  e[c.status]++;
}

// "Ativa" = ainda tem produção relevante em aberto (abaixo de 95% concluído).
// Obras acima disso estão só com pendências pontuais de fechamento/documentação.
const obras = [...porEmp.values()]
  .map((e) => ({ ...e, pct_concluido: Math.round((e.concluida / e.total) * 1000) / 10 }))
  .map((e) => ({ ...e, ativa: e.pct_concluido < 95 }))
  .sort((a, b) => a.pct_concluido - b.pct_concluido);

writeFileSync(new URL("../processed/obras_reais.json", HERE), JSON.stringify(obras, null, 2), "utf8");
console.log(obras.map((o) => `${o.ativa ? "ATIVA  " : "concluída"} ${o.empreendimento}: ${o.concluida}/${o.total} (${o.pct_concluido}%)`).join("\n"));
