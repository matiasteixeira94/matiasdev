#!/usr/bin/env node
/**
 * Gera data/processed/mapa_lotes.json a partir dos SVGs de implantação de
 * cada condomínio (exportados do DXF do projeto arquitetônico). Cada SVG tem
 * uma camada "Lotes"/"Lote" com um <path class="casa"> por lote e uma camada
 * "Rótulo Lotes" com o número do lote em texto solto — sem nenhum atributo
 * em comum entre as duas, então o casamento é feito por proximidade
 * espacial (emparelhamento guloso rótulo↔centroide do polígono mais próximo).
 *
 * O número do lote (ex.: "127") é o mesmo número que aparece no código da
 * casa nas planilhas de produção (ex.: "RL 127A" -> lote 127), o que permite
 * juntar esse mapa com casas.json em tempo de execução no navegador.
 *
 * Uso:
 *   node data/scripts/gerar_mapa_lotes.mjs "<pasta com Laranjeiras.svg, Cerejeiras.svg, Oliveiras.svg, Amoreiras.svg>"
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const pasta = process.argv[2];
if (!pasta) {
  console.error("Uso: node gerar_mapa_lotes.mjs \"<pasta com os SVGs>\"");
  process.exit(1);
}

const EMPREENDIMENTOS = ["Laranjeiras", "Cerejeiras", "Oliveiras", "Amoreiras"];

function extractLayer(svg, label) {
  const start = svg.indexOf(`inkscape:label="${label}"`);
  if (start === -1) return null;
  const gStart = svg.lastIndexOf("<g", start);
  const nextG = svg.indexOf("<g", start + label.length);
  const closeBefore = svg.lastIndexOf("</g>", nextG === -1 ? svg.length : nextG);
  return svg.slice(gStart, closeBefore);
}

// Parser mínimo de path (M/m, L/l, H/h, V/v, Z/z) — suficiente para os
// polígonos simples exportados do DXF.
function parsePathPoints(d) {
  const tokens = d.trim().match(/[MmLlHhVvZz]|-?[0-9.]+(?:e-?[0-9]+)?/g) || [];
  const pts = [];
  let i = 0, cmd = null, x = 0, y = 0, startX = 0, startY = 0;
  while (i < tokens.length) {
    if (/^[MmLlHhVvZz]$/.test(tokens[i])) { cmd = tokens[i]; i++; }
    switch (cmd) {
      case "M": x = Number(tokens[i++]); y = Number(tokens[i++]); startX = x; startY = y; pts.push([x, y]); cmd = "L"; break;
      case "m": x += Number(tokens[i++]); y += Number(tokens[i++]); startX = x; startY = y; pts.push([x, y]); cmd = "l"; break;
      case "L": x = Number(tokens[i++]); y = Number(tokens[i++]); pts.push([x, y]); break;
      case "l": x += Number(tokens[i++]); y += Number(tokens[i++]); pts.push([x, y]); break;
      case "H": x = Number(tokens[i++]); pts.push([x, y]); break;
      case "h": x += Number(tokens[i++]); pts.push([x, y]); break;
      case "V": y = Number(tokens[i++]); pts.push([x, y]); break;
      case "v": y += Number(tokens[i++]); pts.push([x, y]); break;
      case "Z": case "z": x = startX; y = startY; i++; break;
      default: i++;
    }
  }
  return pts;
}
const centroid = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

const resultado = {};
for (const nome of EMPREENDIMENTOS) {
  const arquivo = join(pasta, `${nome}.svg`);
  const svg = readFileSync(arquivo, "utf8");

  const lotesLayer = extractLayer(svg, "Lotes") || extractLayer(svg, "Lote");
  const casaPaths = [...lotesLayer.matchAll(/<path\s+d="([^"]+)"\s+class="casa"\s+id="([^"]+)"/g)]
    .map((m) => ({ d: m[1], id: m[2] }));
  const casas = casaPaths.map((p) => {
    const pts = parsePathPoints(p.d);
    const [cx, cy] = centroid(pts);
    return { ...p, cx, cy, pts };
  });

  const rotuloLayer = extractLayer(svg, "Rótulo Lotes");
  const labelMatches = [...rotuloLayer.matchAll(/<text[\s\S]*?x="([^"]+)"\s+y="([^"]+)"\s+id="[^"]+">\s*<tspan[^>]*>([^<]+)<\/tspan>/g)];
  const labels = labelMatches
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), text: m[3].trim() }))
    .filter((l) => /^[0-9]+$/.test(l.text));

  // emparelhamento guloso: ordena todos os pares (rótulo, lote) pela
  // distância rótulo->centroide e vai atribuindo os mais próximos primeiro.
  const pares = [];
  for (const l of labels) for (const c of casas) pares.push({ l, c, dist: (c.cx - l.x) ** 2 + (c.cy - l.y) ** 2 });
  pares.sort((a, b) => a.dist - b.dist);
  const labelUsado = new Set(), pathUsado = new Set();
  const numeroPorPath = {};
  for (const par of pares) {
    const lk = `${par.l.text}_${par.l.x}_${par.l.y}`;
    if (labelUsado.has(lk) || pathUsado.has(par.c.id)) continue;
    labelUsado.add(lk); pathUsado.add(par.c.id);
    numeroPorPath[par.c.id] = Number(par.l.text);
  }

  const todosPontos = casas.flatMap((c) => c.pts);
  const xs = todosPontos.map((p) => p[0]), ys = todosPontos.map((p) => p[1]);
  const pad = 8;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - minX + pad, h = Math.max(...ys) - minY + pad;

  // camada de fundo (contorno das quadras), só decorativo — melhor esforço,
  // se a camada não existir ou vier vazia o mapa funciona só com os lotes.
  const quadrasLayer = extractLayer(svg, "Quadras") || extractLayer(svg, "Quadra");
  const contorno = quadrasLayer ? [...quadrasLayer.matchAll(/<path\s+d="([^"]+)"/g)].map((m) => m[1]) : [];

  const lotes = casas
    .filter((c) => numeroPorPath[c.id] != null)
    .map((c) => ({ numero: numeroPorPath[c.id], d: c.d }))
    .sort((a, b) => a.numero - b.numero);

  resultado[nome] = { viewBox: `${minX} ${minY} ${w} ${h}`, lotes, contorno };
  console.log(`${nome}: ${lotes.length} lotes mapeados, ${contorno.length} formas de contorno (quadras).`);
}

writeFileSync(new URL("../processed/mapa_lotes.json", import.meta.url), JSON.stringify(resultado), "utf8");
