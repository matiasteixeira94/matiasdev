// Primitivas de gráfico em SVG puro (sem dependências externas).
// Cobrem os três padrões usados nas telas: linha (evolução temporal),
// barras verticais agrupadas (produção x meta, comparação por grupo) e
// barras horizontais (ranking / índice por obra ou grupo).
"use strict";

const GPCharts = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  function ensureTooltip(host) {
    let tip = host.querySelector(".gp-tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "gp-tooltip";
      tip.setAttribute("role", "tooltip");
      host.style.position = "relative";
      host.appendChild(tip);
    }
    return tip;
  }

  function showTip(host, tip, xPx, yPx, html) {
    tip.innerHTML = html;
    tip.style.opacity = "1";
    const hostRect = host.getBoundingClientRect();
    let left = xPx + 14, top = yPx - 10;
    if (left + 170 > hostRect.width) left = xPx - 170 - 14;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(0, top)}px`;
  }
  function hideTip(tip) { tip.style.opacity = "0"; }

  /* ---------------- Linha / área (evolução temporal) ---------------- */
  function line(host, { labels, series, height = 220, yFormat = (v) => v, yLabel = "" }) {
    host.innerHTML = "";
    const tip = ensureTooltip(host);
    const width = host.clientWidth || 640;
    const pad = { t: 16, r: 16, b: 26, l: 40 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;

    const allVals = series.flatMap((s) => s.values);
    const max = Math.max(...allVals, 1) * 1.15;
    const min = Math.min(0, Math.min(...allVals));
    const xStep = innerW / Math.max(1, labels.length - 1);
    const yScale = (v) => pad.t + innerH - ((v - min) / (max - min)) * innerH;
    const xScale = (i) => pad.l + i * xStep;

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img" });

    // gridlines horizontais
    const ticks = 4;
    let lastYLabel = null;
    for (let i = 0; i <= ticks; i++) {
      const v = min + ((max - min) * i) / ticks;
      const y = yScale(v);
      svg.appendChild(el("line", { x1: pad.l, x2: width - pad.r, y1: y, y2: y, stroke: "var(--chart-grid)", "stroke-width": 1 }));
      const label = yFormat(v);
      if (label !== lastYLabel) {
        const t = el("text", { x: pad.l - 8, y: y + 3, "text-anchor": "end", class: "gp-axis-label" });
        t.textContent = label;
        svg.appendChild(t);
        lastYLabel = label;
      }
    }
    // eixo x (rótulos seletivos, sem sobreposição no fim da série)
    const xStepTicks = Math.max(1, Math.ceil(labels.length / 7));
    let lastShownIndex = -Infinity;
    labels.forEach((lb, i) => {
      const isLast = i === labels.length - 1;
      const isRegular = labels.length <= 8 || i % xStepTicks === 0;
      if (!isRegular && !isLast) return;
      if (isLast && !isRegular && i - lastShownIndex < xStepTicks) return;
      lastShownIndex = i;
      const t = el("text", { x: xScale(i), y: height - 6, "text-anchor": "middle", class: "gp-axis-label" });
      t.textContent = lb;
      svg.appendChild(t);
    });

    series.forEach((s, si) => {
      const color = s.color || "var(--accent)";
      if (s.area) {
        const areaPts = s.values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(" ");
        const path = `M ${xScale(0)},${yScale(min)} L ${areaPts} L ${xScale(s.values.length - 1)},${yScale(min)} Z`;
        svg.appendChild(el("path", { d: path, fill: color, opacity: 0.12, stroke: "none" }));
      }
      const linePts = s.values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(" ");
      svg.appendChild(el("polyline", {
        points: linePts, fill: "none", stroke: color, "stroke-width": 2,
        "stroke-linecap": "round", "stroke-linejoin": "round",
        "stroke-dasharray": s.dashed ? "5,4" : "none",
      }));
      s.values.forEach((v, i) => {
        svg.appendChild(el("circle", { cx: xScale(i), cy: yScale(v), r: si === 0 ? 3 : 2.5, fill: color, class: "gp-pt", "data-i": i, "data-s": si }));
      });
    });

    // crosshair interativo
    const crosshair = el("line", { y1: pad.t, y2: height - pad.b, stroke: "var(--chart-axis)", "stroke-width": 1, opacity: 0 });
    svg.appendChild(crosshair);
    const hitArea = el("rect", { x: pad.l, y: pad.t, width: innerW, height: innerH, fill: "transparent" });
    hitArea.addEventListener("mousemove", (e) => {
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (width / rect.width);
      let i = Math.round((mx - pad.l) / xStep);
      i = Math.max(0, Math.min(labels.length - 1, i));
      crosshair.setAttribute("x1", xScale(i)); crosshair.setAttribute("x2", xScale(i)); crosshair.setAttribute("opacity", 1);
      const rows = series.map((s) => `<div class="gp-tip-row"><span class="gp-tip-dot" style="background:${s.color}"></span>${s.name}<b>${yFormat(s.values[i])}</b></div>`).join("");
      showTip(host, tip, xScale(i), yScale(series[0].values[i]), `<div class="gp-tip-head">${labels[i]}</div>${rows}`);
    });
    hitArea.addEventListener("mouseleave", () => { crosshair.setAttribute("opacity", 0); hideTip(tip); });
    svg.appendChild(hitArea);

    host.appendChild(svg);
    if (series.length > 1 || series[0].name) {
      const legend = document.createElement("div");
      legend.className = "legend";
      legend.style.marginTop = "8px";
      legend.innerHTML = series.map((s) => `<span class="tag-dot" style="color:${s.color}">${s.name}</span>`).join("");
      host.appendChild(legend);
    }
  }

  /* ---------------- Barras verticais agrupadas ---------------- */
  function bars(host, { categories, series, height = 240, yFormat = (v) => v }) {
    host.innerHTML = "";
    const tip = ensureTooltip(host);
    const width = host.clientWidth || 640;
    const pad = { t: 16, r: 12, b: 34, l: 40 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const max = Math.max(...series.flatMap((s) => s.values), 1) * 1.15;
    const yScale = (v) => pad.t + innerH - (v / max) * innerH;

    const groupW = innerW / categories.length;
    const barGap = 6;
    const barW = Math.min(30, (groupW - barGap * (series.length + 1)) / series.length);

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img" });
    const ticks = 4;
    let lastYLabel = null;
    for (let i = 0; i <= ticks; i++) {
      const v = (max * i) / ticks;
      const y = yScale(v);
      svg.appendChild(el("line", { x1: pad.l, x2: width - pad.r, y1: y, y2: y, stroke: "var(--chart-grid)", "stroke-width": 1 }));
      const label = yFormat(v);
      if (label === lastYLabel) continue;
      lastYLabel = label;
      const t = el("text", { x: pad.l - 8, y: y + 3, "text-anchor": "end", class: "gp-axis-label" });
      t.textContent = label;
      svg.appendChild(t);
    }

    categories.forEach((cat, ci) => {
      const groupX = pad.l + ci * groupW;
      series.forEach((s, si) => {
        const v = s.values[ci];
        const x = groupX + barGap + si * (barW + barGap);
        const y = yScale(v);
        const h = pad.t + innerH - y;
        const rect = el("rect", {
          x, y, width: barW, height: Math.max(0, h), rx: 3, fill: s.color, class: "gp-bar",
        });
        rect.addEventListener("mousemove", (e) => {
          const rect2 = svg.getBoundingClientRect();
          showTip(host, tip, (e.clientX - rect2.left) * (width / rect2.width), y,
            `<div class="gp-tip-head">${cat}</div><div class="gp-tip-row"><span class="gp-tip-dot" style="background:${s.color}"></span>${s.name}<b>${yFormat(v)}</b></div>`);
        });
        rect.addEventListener("mouseleave", () => hideTip(tip));
        svg.appendChild(rect);
      });
      const t = el("text", { x: groupX + groupW / 2, y: height - 10, "text-anchor": "middle", class: "gp-axis-label" });
      t.textContent = cat;
      svg.appendChild(t);
    });

    host.appendChild(svg);
    if (series.length > 1) {
      const legend = document.createElement("div");
      legend.className = "legend";
      legend.style.marginTop = "8px";
      legend.innerHTML = series.map((s) => `<span class="tag-dot" style="color:${s.color}">${s.name}</span>`).join("");
      host.appendChild(legend);
    }
  }

  /* ---------------- Barras + linha de evolução (sequência categórica) ---------------- */
  function barsLine(host, { items, height = 240, yFormat = (v) => v, lineColor = "var(--gold)", tooltipLabel = "Produtividade", legendLabel = "Evolução (ordem de execução)", onClick = null }) {
    host.innerHTML = "";
    const tip = ensureTooltip(host);
    const width = host.clientWidth || 640;
    const pad = { t: 20, r: 16, b: 34, l: 44 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const values = items.map((it) => it.value);
    const min = Math.min(0, Math.min(...values));
    const max = Math.max(...values, 1) * 1.12;
    const yScale = (v) => pad.t + innerH - ((v - min) / (max - min)) * innerH;

    const groupW = innerW / items.length;
    const barW = Math.min(64, groupW * 0.46);

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img" });
    const ticks = 4;
    let lastYLabel = null;
    for (let i = 0; i <= ticks; i++) {
      const v = min + ((max - min) * i) / ticks;
      const y = yScale(v);
      svg.appendChild(el("line", { x1: pad.l, x2: width - pad.r, y1: y, y2: y, stroke: "var(--chart-grid)", "stroke-width": 1 }));
      const label = yFormat(v);
      if (label === lastYLabel) continue;
      lastYLabel = label;
      const t = el("text", { x: pad.l - 8, y: y + 3, "text-anchor": "end", class: "gp-axis-label" });
      t.textContent = label;
      svg.appendChild(t);
    }

    // com muitas categorias, mostra só 1 a cada N rótulos pra não sobrepor.
    const passo = Math.max(1, Math.ceil((items.length * 34) / innerW));

    const pontos = [];
    items.forEach((it, i) => {
      const cx = pad.l + i * groupW + groupW / 2;
      const y = yScale(it.value);
      const barX = cx - barW / 2;
      const h = pad.t + innerH - y;
      const rect = el("rect", { x: barX, y, width: barW, height: Math.max(0, h), rx: 4, fill: it.color || "var(--accent)", class: "gp-bar" });
      rect.addEventListener("mousemove", (e) => {
        const rect2 = svg.getBoundingClientRect();
        showTip(host, tip, (e.clientX - rect2.left) * (width / rect2.width), y,
          `<div class="gp-tip-head">${it.label}</div><div class="gp-tip-row"><span class="gp-tip-dot" style="background:${it.color || "var(--accent)"}"></span>${tooltipLabel}<b>${yFormat(it.value)}</b></div>`);
      });
      rect.addEventListener("mouseleave", () => hideTip(tip));
      if (onClick) { rect.style.cursor = "pointer"; rect.addEventListener("click", () => onClick(it, i)); }
      svg.appendChild(rect);
      if (i % passo === 0) {
        const t = el("text", { x: cx, y: height - 10, "text-anchor": "middle", class: "gp-axis-label" });
        t.textContent = it.label;
        svg.appendChild(t);
      }
      pontos.push([cx, y]);
    });

    // linha ligando os pontos, na ordem de execução (ordem de "items").
    // pointer-events:none nos dois — são só decoração; sem isso, quando uma
    // barra é bem baixa (valor perto de 0), o círculo/linha do ponto fica
    // bem em cima dela e rouba o clique que era pra ir pro <rect>.
    svg.appendChild(el("polyline", {
      points: pontos.map(([x, y]) => `${x},${y}`).join(" "),
      fill: "none", stroke: lineColor, "stroke-width": 2.5,
      "stroke-linecap": "round", "stroke-linejoin": "round",
      "pointer-events": "none",
    }));
    pontos.forEach(([x, y], i) => {
      svg.appendChild(el("circle", { cx: x, cy: y, r: 5, fill: lineColor, stroke: "var(--surface-raised)", "stroke-width": 2, "pointer-events": "none" }));
      const label = el("text", { x, y: y - 12, "text-anchor": "middle", class: "gp-axis-label", style: "font-weight:700;", "pointer-events": "none" });
      label.textContent = yFormat(items[i].value);
      svg.appendChild(label);
    });

    host.appendChild(svg);
    const legend = document.createElement("div");
    legend.className = "legend";
    legend.style.marginTop = "8px";
    legend.innerHTML = `<span class="tag-dot" style="color:${lineColor}">${legendLabel}</span>`;
    host.appendChild(legend);
  }

  /* ---------------- Barras horizontais (ranking / progresso) ---------------- */
  function hbars(host, { items, valueFormat = (v) => v, showTarget = true }) {
    host.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.gap = "12px";
    const max = Math.max(...items.map((i) => Math.max(i.value, i.target || 0)), 1);
    items.forEach((item) => {
      const row = document.createElement("div");
      const pct = Math.min(100, (item.value / max) * 100);
      const targetPct = item.target ? Math.min(100, (item.target / max) * 100) : null;
      row.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
          <span style="font-weight:600;">${item.label}</span>
          <span class="footnote" style="font-family:var(--font-mono);">${valueFormat(item.value)}${item.target ? ` / meta ${valueFormat(item.target)}` : ""}</span>
        </div>
        <div class="bar-track" style="position:relative;">
          <div class="bar-fill" style="width:${pct}%; background:${item.color || "var(--accent)"};"></div>
          ${targetPct !== null && showTarget ? `<div style="position:absolute; top:-3px; left:${targetPct}%; width:2px; height:14px; background:var(--ink);"></div>` : ""}
        </div>`;
      wrap.appendChild(row);
    });
    host.appendChild(wrap);
  }

  /* ---------------- Boneco com setas por parte do corpo ---------------- */
  const PONTOS_CORPO = {
    "CABEÇA": [210, 26],
    "OMBRO": [244, 60],
    "COTOVELO": [253, 112],
    "PUNHO/MÃO": [271, 170],
    "COLUNA/TRONCO": [210, 100],
    "JOELHO": [243, 252],
    "MEMBROS SUPERIORES": [231, 88],
    "MEMBROS INFERIORES": [235, 200],
  };

  function bodyMap(host, { items, color = "var(--accent)" }) {
    host.innerHTML = "";
    const height = 380;
    const total = items.reduce((a, i) => a + i.value, 0) || 1;

    const comPonto = [];
    const semPonto = [];
    for (const it of items) {
      const xy = PONTOS_CORPO[it.label.toUpperCase()];
      if (xy) comPonto.push({ ...it, xy });
      else semPonto.push(it);
    }
    comPonto.sort((a, b) => a.xy[1] - b.xy[1]);

    const svg = el("svg", { viewBox: `0 0 420 ${height}`, width: "100%", height, role: "img" });

    const corpo = el("g", { fill: "none", stroke: "var(--border-strong)", "stroke-linecap": "round" });
    corpo.appendChild(el("circle", { cx: 210, cy: 26, r: 16, fill: "var(--border-strong)", stroke: "none" }));
    const membros = [
      [210, 44, 210, 152, 24], // torso
      [210, 56, 168, 112, 14], [168, 112, 150, 170, 12], // braço esquerdo
      [210, 56, 252, 112, 14], [252, 112, 270, 170, 12], // braço direito
      [195, 152, 178, 252, 16], [178, 252, 172, 330, 14], // perna esquerda
      [225, 152, 242, 252, 16], [242, 252, 248, 330, 14], // perna direita
    ];
    for (const [x1, y1, x2, y2, w] of membros) corpo.appendChild(el("line", { x1, y1, x2, y2, "stroke-width": w }));
    svg.appendChild(corpo);

    const n = comPonto.length;
    const padTop = 34, padBottom = 34;
    const rowH = n > 1 ? (height - padTop - padBottom) / (n - 1) : 0;
    comPonto.forEach((it, i) => {
      const [px, py] = it.xy;
      const pct = Math.round((it.value / total) * 1000) / 10;
      const labelY = n > 1 ? padTop + i * rowH : height / 2;
      const labelX = 296;

      svg.appendChild(el("path", {
        d: `M ${px} ${py} L ${labelX - 14} ${labelY}`,
        stroke: color, "stroke-width": 1.5, fill: "none", "stroke-dasharray": "3,3",
      }));
      svg.appendChild(el("circle", { cx: px, cy: py, r: 4.5, fill: color, stroke: "var(--surface-raised)", "stroke-width": 1.5 }));

      const nome = el("text", { x: labelX, y: labelY - 4, class: "gp-axis-label", style: "font-weight:700; font-size:12px; fill:var(--ink);" });
      nome.textContent = it.label;
      svg.appendChild(nome);
      const valor = el("text", { x: labelX, y: labelY + 13, class: "gp-axis-label", style: "font-size:12px;" });
      valor.textContent = `${it.value} (${pct}%)`;
      svg.appendChild(valor);
    });

    host.appendChild(svg);

    if (semPonto.length) {
      const legend = document.createElement("div");
      legend.className = "footnote";
      legend.style.marginTop = "8px";
      const totalSemPonto = semPonto.reduce((a, i) => a + i.value, 0);
      legend.textContent = `Outras categorias (${totalSemPonto}): ` + semPonto.map((it) => `${it.label} — ${it.value} (${Math.round((it.value / total) * 1000) / 10}%)`).join(" · ");
      host.appendChild(legend);
    }
  }

  return { line, bars, hbars, barsLine, bodyMap };
})();
