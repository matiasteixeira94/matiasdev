#!/usr/bin/env node
/**
 * Gera data/processed/celula_feminina.json com os dados gerais do
 * "Relatório Quinzenal 03 — 2026.1" da Célula Feminina (UGB Caruaru),
 * transcritos manualmente do relatório em Canva (não há planilha-fonte
 * pra esse relatório — ele é só um documento visual).
 *
 * Escopo deliberadamente reduzido: o relatório original também traz,
 * por colaboradora, comentários nominais sobre saúde (inclusive
 * diagnósticos e tratamentos), situações pessoais graves (luto,
 * problemas psicológicos) e o relato detalhado de uma apuração de
 * conduta inadequada entre colaboradores. Nada disso entra aqui — só os
 * indicadores gerais (motivação, absenteísmo, produtividade por
 * atividade) e o organograma (nome + função + selos), decisão tomada em
 * 2026-07-18 (ver [[privacidade_repo_publico]]).
 *
 * Uso: node data/scripts/gerar_celula_feminina.mjs
 */
import { writeFileSync } from "fs";

const ATIVIDADES = ["PVC", "Cerâmica", "Rejunte", "Alvenaria", "Reboco", "Massa Fina"];

const colaboradoras = [
  { nome: "Edna Trajano", destaqueProdutividade: true, motivacao: [100, 100], absenteismo: [2, 2], produtividade: [38, 53, 80, 15, 33, 50] },
  { nome: "Clecia Albino", destaqueProdutividade: true, motivacao: [100, 100], absenteismo: [1, 2], produtividade: [38, 33, 40, 5, 25, 45] },
  { nome: "Adriana Bezerra", motivacao: [90, 100], absenteismo: [4, 3], produtividade: [83, 33, 60, 0, 16, 25] },
  { nome: "Rosângela Oliveira", pontoAtencao: true, motivacao: [100, 30], absenteismo: [11, 10], produtividade: [44, 60, 80, 45, 30, 45] },
  { nome: "Cristiane Maria", destaqueCultura: true, destaqueProdutividade: true, motivacao: [100, 100], absenteismo: [8, 8], produtividade: [67, 82, 80, 49, 40, 65] },
  { nome: "Maria Jucilene", destaqueCultura: true, destaqueProdutividade: true, motivacao: [100, 100], absenteismo: [3, 3], produtividade: [28, 34, 80, 49, 33, 45] },
  { nome: "Camila Pereira", pontoAtencao: true, motivacao: [75, 90], absenteismo: [9, 7], produtividade: [33, 33, 60, 15, 15, 30] },
  { nome: "Erlaine Conceição", motivacao: [100, 100], absenteismo: [4, 5], produtividade: [55, 27, 80, 0, 20, 45] },
  { nome: "Aline Santos", motivacao: [null, 50], absenteismo: [18, 16], produtividade: [0, 0, 80, 0, 0, 0] },
  { nome: "Geise Kelly", motivacao: [null, 50], absenteismo: [3, 2], produtividade: [28, 20, 80, 0, 0, 38] },
];

const resultado = {
  atualizado_em: new Date().toISOString().slice(0, 10),
  periodo: "Relatório Quinzenal 03 — 2026.1",
  origem: "UGB Caruaru · Produção",
  rotina_acompanhamento: "Segunda, terça e sexta, de 6:30h às 7h",
  motivacao_media_pct: 79,
  absenteismo_medio_pct: 6,
  funcao_padrao: "Servente Jr.",
  colaboradoras: colaboradoras.map((c) => ({
    nome: c.nome,
    funcao: "Servente Jr.",
    destaque_cultura: !!c.destaqueCultura,
    destaque_produtividade: !!c.destaqueProdutividade,
    ponto_atencao: !!c.pontoAtencao,
    motivacao_maio: c.motivacao[0],
    motivacao_junho: c.motivacao[1],
    absenteismo_maio: c.absenteismo[0],
    absenteismo_junho: c.absenteismo[1],
    produtividade: c.produtividade ? Object.fromEntries(ATIVIDADES.map((a, i) => [a, c.produtividade[i]])) : null,
  })),
};

writeFileSync(new URL("../processed/celula_feminina.json", import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
console.log("Colaboradoras:", resultado.colaboradoras.length);
console.log("Motivação média:", resultado.motivacao_media_pct + "%", "| Absenteísmo médio:", resultado.absenteismo_medio_pct + "%");
