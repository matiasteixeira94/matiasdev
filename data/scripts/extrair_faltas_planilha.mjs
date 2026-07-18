#!/usr/bin/env node
/**
 * Extrai as faltas (aba "Base", linhas com Situação = "FALTA MÊS") da
 * planilha matriz de DP, filtradas aos setores Produção, Assistência
 * Técnica e Acabamento (direto + indireto), e gera
 * data/processed/faltas.json.
 *
 * O denominador de colaboradores ativos vem de pessoal_ativos.json,
 * usando o mesmo mapeamento função→frente já usado na tela de Quadro de
 * Pessoal (js/pessoal.js), pra manter as duas telas consistentes.
 *
 * Uso:
 *   node data/scripts/extrair_faltas_planilha.mjs "Planilha DP - CA - BASE MATRIZ.xlsm"
 */
import xlsx from "xlsx";
import { readFileSync, writeFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error('Uso: node extrair_faltas_planilha.mjs "Planilha DP - CA - BASE MATRIZ.xlsm"');
  process.exit(1);
}

const FUNCAO_PARA_FRENTE = {
  "ELETRICISTA": "Acabamento",
  "MARCENEIRO": "Acabamento",
  "OPERADOR DE PRODUÇÃO": "Acabamento",
  "SUPERVISOR DE ACABAMENTO": "Acabamento",
  "SUPERVISOR LIDER DE ACABAMENTO E ASSIST TECNICA": "Acabamento",
  "OPERADOR DE ASSISTENCIA TÉCNICA": "Assistência Técnica",
  "SERVENTE DE ASSISTÊNCIA TÉCNICA": "Assistência Técnica",
  "OPERADOR LÍDER DE ASSISTENCIA TÉCNICA": "Assistência Técnica",
  "SUPERVISOR(A) DE ASSISTENCIA TECNICA": "Assistência Técnica",
  "SERVENTE DE PRODUÇÃO": "Produção",
  "SERVENTE POLIVALENTE DE PRODUÇÃO": "Produção",
  "PEDREIRO DE PRODUÇÃO": "Produção",
  "PEDREIRO LIDER DE PRODUÇÃO": "Produção",
  "SUPERVISOR(A) DE PRODUÇÃO": "Produção",
  "SUPERVISOR(A) DE PRODUÇÃO LIDER": "Produção",
};

const ativos = JSON.parse(readFileSync(new URL("../processed/pessoal_ativos.json", import.meta.url), "utf8"));
const ativosNosSetores = ativos.filter((a) => FUNCAO_PARA_FRENTE[a.funcao]);
const colaboradoresAtivosTotal = ativosNosSetores.length;
const nomesAtivos = new Set(ativosNosSetores.map((a) => a.nome.trim().toUpperCase()));

function setorGrupo(setorBruto) {
  const s = (setorBruto || "").trim().toUpperCase();
  if (s.startsWith("PRODUÇÃO")) return "Produção";
  if (s.startsWith("ASSISTÊNCIA")) return "Assistência Técnica";
  if (s.startsWith("ACABAMENTO")) return "Acabamento";
  return null;
}

function normalizarChave(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
}

function dataIso(dataBr) {
  // formato "m/d/yy"
  const m = (dataBr || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!m) return null;
  const [, mes, dia, ano2] = m;
  return `20${ano2}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

const wb = xlsx.readFile(file);
const ws = wb.Sheets["Base"];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
const data = rows.slice(14).filter((r) => r[1]);

const faltas = [];
for (const r of data) {
  if (r[0] !== "FALTA MÊS") continue;
  const grupo = setorGrupo(r[27]);
  if (!grupo) continue;
  const iso = dataIso(r[2]);
  if (!iso) continue;
  faltas.push({
    nome: r[1],
    data: iso,
    ano: iso.slice(0, 4),
    mes: iso.slice(0, 7),
    dia: Number(iso.slice(8, 10)),
    cargo: r[26],
    setor: grupo,
    classificacao: r[4] || "Não informada",
    motivo: r[7] || "Não informado",
  });
}

const porAno = {};
const porAnoMes = {};
const porMesDia = {};
const porColaborador = {};
const porSetor = {};
const porClassificacao = {};
const porMotivo = {};
const detalheColaborador = {};

function acumularMotivo(mapa, motivoBruto) {
  // Motivos com grafia divergente só por acento (SAIDA/SAÍDA,
  // DECLARAÇAO/DECLARAÇÃO...) são a mesma causa real — agrupa por uma
  // chave sem acento, mas mantém como rótulo a grafia mais frequente.
  const chave = normalizarChave(motivoBruto);
  mapa[chave] ??= { label: motivoBruto, total: 0, porGrafia: {} };
  mapa[chave].total += 1;
  mapa[chave].porGrafia[motivoBruto] = (mapa[chave].porGrafia[motivoBruto] || 0) + 1;
  if (mapa[chave].porGrafia[motivoBruto] > (mapa[chave].porGrafia[mapa[chave].label] || 0)) {
    mapa[chave].label = motivoBruto;
  }
}

function ordenarMotivos(mapa) {
  return Object.fromEntries(Object.values(mapa).sort((a, b) => b.total - a.total).map((m) => [m.label, m.total]));
}

for (const f of faltas) {
  porAno[f.ano] = (porAno[f.ano] || 0) + 1;

  porAnoMes[f.ano] ??= {};
  porAnoMes[f.ano][f.mes] = (porAnoMes[f.ano][f.mes] || 0) + 1;

  porMesDia[f.mes] ??= {};
  porMesDia[f.mes][f.dia] = (porMesDia[f.mes][f.dia] || 0) + 1;

  porColaborador[f.nome] ??= { nome: f.nome, cargo: f.cargo, setor: f.setor, total: 0, ativo: nomesAtivos.has(f.nome.trim().toUpperCase()) };
  porColaborador[f.nome].total += 1;

  porSetor[f.setor] = (porSetor[f.setor] || 0) + 1;
  porClassificacao[f.classificacao] = (porClassificacao[f.classificacao] || 0) + 1;
  acumularMotivo(porMotivo, f.motivo);

  detalheColaborador[f.nome] ??= { por_classificacao: {}, por_motivo: {} };
  detalheColaborador[f.nome].por_classificacao[f.classificacao] = (detalheColaborador[f.nome].por_classificacao[f.classificacao] || 0) + 1;
  acumularMotivo(detalheColaborador[f.nome].por_motivo, f.motivo);
}

for (const nome of Object.keys(detalheColaborador)) {
  detalheColaborador[nome].por_motivo = ordenarMotivos(detalheColaborador[nome].por_motivo);
}

const ranking = Object.values(porColaborador).sort((a, b) => b.total - a.total);
const motivoOrdenado = ordenarMotivos(porMotivo);
const colaboradoresAtivosComFalta = ranking.filter((r) => r.ativo).length;

const resultado = {
  atualizado_em: new Date().toISOString().slice(0, 10),
  total_faltas: faltas.length,
  colaboradores_com_falta: ranking.length,
  colaboradores_ativos_total: colaboradoresAtivosTotal,
  colaboradores_ativos_com_falta: colaboradoresAtivosComFalta,
  pct_ativos_com_falta: colaboradoresAtivosTotal ? Math.round((colaboradoresAtivosComFalta / colaboradoresAtivosTotal) * 1000) / 10 : 0,
  anos: Object.keys(porAno).sort(),
  por_ano: porAno,
  por_ano_mes: porAnoMes,
  por_mes_dia: porMesDia,
  ranking,
  por_setor: porSetor,
  por_classificacao: porClassificacao,
  por_motivo: motivoOrdenado,
  detalhe_colaborador: detalheColaborador,
};

writeFileSync(new URL("../processed/faltas.json", import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
console.log("Total de faltas:", resultado.total_faltas);
console.log("Colaboradores com falta (histórico):", resultado.colaboradores_com_falta);
console.log("Ativos hoje nos 3 setores:", resultado.colaboradores_ativos_total, "| dos quais já faltaram:", resultado.colaboradores_ativos_com_falta, `(${resultado.pct_ativos_com_falta}%)`);
console.log("Por ano:", resultado.por_ano);
console.log("Top 5 ranking:", resultado.ranking.slice(0, 5).map((r) => `${r.nome} (${r.total})`));
