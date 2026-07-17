"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "muros",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Muros",
  });
  if (!session) return;

  const [muros, mapaLotes, metas, metasMensais] = await Promise.all([
    GP.loadJSON("muros.json"), GP.loadJSON("mapa_lotes.json"), GP.loadJSON("metas_2026_2.json"), GP.loadJSON("metas_mensais_2026_2.json"),
  ]);

  const ORDEM_EXECUCAO = ["Laranjeiras", "Cerejeiras", "Oliveiras", "Amoreiras"];
  const OBRA_COR = { Amoreiras: "var(--cat-alvenaria)", Oliveiras: "var(--cat-acabamento)", Cerejeiras: "var(--cat-estrutura)", Laranjeiras: "var(--cat-administrativo)" };

  // Total de lotes de cada obra vem da planta (mapa_lotes.json) — é a mesma
  // contagem usada na tela Casas e na Visão Geral.
  const totalLotes = Object.fromEntries(ORDEM_EXECUCAO.map((e) => [e, mapaLotes[e]?.lotes.length ?? 0]));

  // Obras 100% entregues — o muro/cisterna dessas obras já está todo
  // concluído na prática, mesmo que a aba DADOS MURO ainda não tenha
  // lançamento pra todo lote (mesmo critério já usado para casas).
  const CONCLUIDO_OVERRIDE = new Set(["Laranjeiras", "Cerejeiras", "Oliveiras"]);
  const concluidoPorLote = {};
  for (const emp of ORDEM_EXECUCAO) {
    concluidoPorLote[emp] = {};
    for (const l of muros[emp]?.lotes ?? []) concluidoPorLote[emp][l.numero] = l;
    if (CONCLUIDO_OVERRIDE.has(emp)) {
      for (const lote of mapaLotes[emp]?.lotes ?? []) {
        if (concluidoPorLote[emp][lote.numero] == null) {
          concluidoPorLote[emp][lote.numero] = { empreendimento: emp, numero: lote.numero, ga: null, supervisor: null, data: null };
        }
      }
      muros[emp] = { ...muros[emp], concluidos: totalLotes[emp] };
    }
  }

  const totalGeralLotes = ORDEM_EXECUCAO.reduce((a, e) => a + totalLotes[e], 0);
  const totalGeralConcluidos = ORDEM_EXECUCAO.reduce((a, e) => a + (muros[e]?.concluidos ?? 0), 0);

  const state = { empreendimento: ORDEM_EXECUCAO[0] };

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <p class="footnote" style="margin-top:-6px;">
      Dados extraídos da aba <strong>DADOS MURO</strong> da planilha de controle de muros —
      ${GP.fmtInt(totalGeralConcluidos)} de ${GP.fmtInt(totalGeralLotes)} lotes com muro/cisterna concluído
      (${GP.fmtPct((totalGeralConcluidos / totalGeralLotes) * 100, 0)}).
    </p>

    <div class="grid grid-3">
      <div class="card stat-tile">
        <div class="stat-label">Meta 2026.2</div>
        <div class="stat-value">${GP.fmtInt(metas.muros.meta)}</div>
        <span class="footnote">muros — julho a dezembro de 2026</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Evolução da Meta</div>
        <div class="stat-value">${GP.fmtInt(metas.muros.realizado)}<small>${GP.fmtPct((metas.muros.realizado / metas.muros.meta) * 100, 0)}</small></div>
        <span class="chip ${metas.muros.realizado > 0 ? "chip-good" : "chip-neutral"}">Realizado no período</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Delta da Meta</div>
        <div class="stat-value">${GP.fmtInt(metas.muros.meta - metas.muros.realizado)}</div>
        <span class="chip chip-warning">Faltam para a meta</span>
      </div>
    </div>

    <div class="grid grid-4" id="kpi-row"></div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Muro concluído por obra</div><div class="card-sub">% de lotes com muro/cisterna já construído — na ordem em que os condomínios foram executados</div></div></div>
      <div class="chart-host" id="chart-muros"></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><div class="card-title">Mapa de gestão — muros</div><div class="card-sub">Verde: muro concluído · Cinza: pendente</div></div>
        <select class="select" id="filtro-mapa-muro">
          ${ORDEM_EXECUCAO.map((e) => `<option value="${e}">${e}</option>`).join("")}
        </select>
      </div>
      <div id="mapa-muro-host"></div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;">
        <h2>Resumo por obra</h2>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Obra</th><th class="num">Total de lotes</th><th class="num">Muro concluído</th><th class="num">Pendente</th><th class="num">% concluído</th></tr></thead>
          <tbody>
            ${ORDEM_EXECUCAO.map((e) => {
              const total = totalLotes[e], conc = muros[e]?.concluidos ?? 0;
              return `<tr>
                <td>${e}</td>
                <td class="num">${GP.fmtInt(total)}</td>
                <td class="num">${GP.fmtInt(conc)}</td>
                <td class="num">${GP.fmtInt(total - conc)}</td>
                <td class="num"><span class="chip ${conc === total ? "chip-good" : "chip-warning"}">${GP.fmtPct((conc / total) * 100, 0)}</span></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Meta mensal — 2026.2</div><div class="card-sub">Meta (planejado/projetado) x realizado por mês — desvio = realizado − meta</div></div></div>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr><th>Mês</th><th class="num">Meta</th><th class="num">Realizado</th><th class="num">Desvio</th></tr>
          </thead>
          <tbody>
            ${metasMensais.meses.map((m) => {
              const desvio = m.muros.realizado - m.muros.meta;
              return `<tr>
                <td>${m.label}</td>
                <td class="num">${GP.fmtInt(m.muros.meta)}</td>
                <td class="num">${GP.fmtInt(m.muros.realizado)}</td>
                <td class="num"><span class="chip ${desvio >= 0 ? "chip-good" : "chip-warning"}">${desvio > 0 ? "+" : ""}${GP.fmtInt(desvio)}</span></td>
              </tr>`;
            }).join("")}
            <tr style="font-weight:700;">
              <td>Total 2026.2</td>
              <td class="num">${GP.fmtInt(metas.muros.meta)}</td>
              <td class="num">${GP.fmtInt(metas.muros.realizado)}</td>
              <td class="num">${GP.fmtInt(metas.muros.realizado - metas.muros.meta)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("kpi-row").innerHTML = `
    <div class="card stat-tile">
      <div class="stat-label">Lotes com muro concluído</div>
      <div class="stat-value">${GP.fmtInt(totalGeralConcluidos)}</div>
      <span class="footnote">de ${GP.fmtInt(totalGeralLotes)} lotes no total</span>
    </div>
    <div class="card stat-tile">
      <div class="stat-label">% concluído geral</div>
      <div class="stat-value">${GP.fmtPct((totalGeralConcluidos / totalGeralLotes) * 100, 0)}</div>
      <span class="chip ${totalGeralConcluidos === totalGeralLotes ? "chip-good" : "chip-warning"}">${totalGeralLotes - totalGeralConcluidos} pendentes</span>
    </div>
    <div class="card stat-tile">
      <div class="stat-label">Obra com maior avanço</div>
      <div class="stat-value" style="font-size:22px;">${ORDEM_EXECUCAO.slice().sort((a, b) => (muros[b].concluidos / totalLotes[b]) - (muros[a].concluidos / totalLotes[a]))[0]}</div>
      <span class="footnote">em % de lotes concluídos</span>
    </div>
    <div class="card stat-tile">
      <div class="stat-label">Obra com menor avanço</div>
      <div class="stat-value" style="font-size:22px;">${ORDEM_EXECUCAO.slice().sort((a, b) => (muros[a].concluidos / totalLotes[a]) - (muros[b].concluidos / totalLotes[b]))[0]}</div>
      <span class="footnote">em % de lotes concluídos</span>
    </div>
  `;

  function renderMapaMuro() {
    const emp = state.empreendimento;
    const host = document.getElementById("mapa-muro-host");
    const mapa = mapaLotes[emp];
    if (!mapa) { host.innerHTML = ""; return; }

    const lotesSvg = mapa.lotes.map((lote) => {
      const feito = concluidoPorLote[emp][lote.numero];
      const cor = feito ? "var(--status-good)" : "var(--border-strong)";
      const titulo = feito
        ? `Lote ${lote.numero} — muro concluído\nEquipe: ${feito.ga ?? "—"} · Supervisor: ${feito.supervisor ?? "—"}${feito.data ? ` · ${GP.fmtDate(feito.data)}` : ""}`
        : `Lote ${lote.numero} — muro pendente`;
      return `<path d="${lote.d}" fill="${cor}" stroke="var(--surface-raised)" stroke-width="0.4"><title>${titulo}</title></path>`;
    }).join("");
    const contornoSvg = mapa.contorno.map((d) => `<path d="${d}" fill="none" stroke="var(--border-strong)" stroke-width="0.3" opacity="0.5" />`).join("");

    host.innerHTML = `
      <svg viewBox="${mapa.viewBox}" style="width:100%; height:auto; max-height:640px; display:block;">
        <g>${contornoSvg}</g>
        <g>${lotesSvg}</g>
      </svg>
      <div class="legend" style="margin-top:10px;">
        <span class="tag-dot" style="color:var(--status-good)">Muro concluído</span>
        <span class="tag-dot" style="color:var(--border-strong)">Pendente</span>
      </div>
      <p class="footnote" style="margin-top:8px;">${GP.fmtInt(muros[emp]?.concluidos ?? 0)} de ${GP.fmtInt(totalLotes[emp])} lotes (${GP.fmtPct(((muros[emp]?.concluidos ?? 0) / totalLotes[emp]) * 100, 0)})</p>
    `;
  }

  document.getElementById("filtro-mapa-muro").addEventListener("change", (e) => {
    state.empreendimento = e.target.value;
    renderMapaMuro();
  });

  function renderGrafico() {
    GPCharts.barsLine(document.getElementById("chart-muros"), {
      items: ORDEM_EXECUCAO.map((e) => ({
        label: e, value: Math.round(((muros[e]?.concluidos ?? 0) / totalLotes[e]) * 1000) / 10, color: OBRA_COR[e],
      })),
      yFormat: (v) => `${Math.round(v * 10) / 10}%`,
      tooltipLabel: "Muro concluído",
      legendLabel: "Muro concluído (ordem de execução)",
    });
    renderMapaMuro();
  }

  renderGrafico();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(renderGrafico, 200); });
})();
