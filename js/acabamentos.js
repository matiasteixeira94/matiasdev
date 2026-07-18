"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "acabamentos",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Acabamentos",
  });
  if (!session) return;

  const [mapaLotes, checklist] = await Promise.all([
    GP.loadJSON("mapa_lotes.json"), GP.loadJSON("checklist_acabamento.json"),
  ]);

  const ORDEM_EXECUCAO = ["Laranjeiras", "Cerejeiras", "Oliveiras", "Amoreiras"];
  const OBRA_COR = { Amoreiras: "var(--cat-alvenaria)", Oliveiras: "var(--cat-acabamento)", Cerejeiras: "var(--cat-estrutura)", Laranjeiras: "var(--cat-administrativo)" };

  const totalLotes = Object.fromEntries(ORDEM_EXECUCAO.map((e) => [e, mapaLotes[e]?.lotes.length ?? 0]));
  const semPorLote = {}, comPorLote = {};
  for (const emp of ORDEM_EXECUCAO) {
    semPorLote[emp] = Object.fromEntries((checklist.empreendimentos[emp]?.lotes_sem_pendencia ?? []).map((l) => [l.numero, l]));
    comPorLote[emp] = Object.fromEntries((checklist.empreendimentos[emp]?.lotes_com_pendencia ?? []).map((l) => [l.numero, l]));
  }
  const semCount = Object.fromEntries(ORDEM_EXECUCAO.map((e) => [e, Object.keys(semPorLote[e]).length]));
  const comCount = Object.fromEntries(ORDEM_EXECUCAO.map((e) => [e, Object.keys(comPorLote[e]).length]));
  const vistoriadas = Object.fromEntries(ORDEM_EXECUCAO.map((e) => [e, semCount[e] + comCount[e]]));

  const totalGeralLotes = ORDEM_EXECUCAO.reduce((a, e) => a + totalLotes[e], 0);
  const semGeral = ORDEM_EXECUCAO.reduce((a, e) => a + semCount[e], 0);
  const comGeral = ORDEM_EXECUCAO.reduce((a, e) => a + comCount[e], 0);
  const vistoriadasGeral = semGeral + comGeral;

  const state = { empreendimento: ORDEM_EXECUCAO[0], indice: "Geral" };

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <p class="footnote" style="margin-top:-6px;">
      Dados extraídos do relatório de <strong>checklist de acabamento</strong> (vistorias de casa acabada e
      checklist final de entrega) — ${GP.fmtInt(vistoriadasGeral)} de ${GP.fmtInt(totalGeralLotes)} lotes já vistoriados.
      Uma casa fica "sem pendência" quando o checklist final de entrega mais recente não tem nenhum problema anotado.
    </p>

    <div class="grid grid-4" id="kpi-row"></div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Casas sem pendência por obra</div><div class="card-sub">% de casas vistoriadas com checklist final de entrega limpo</div></div></div>
      <div class="chart-host" id="chart-acabamento"></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><div class="card-title">Mapa de gestão — acabamento</div><div class="card-sub">Verde: sem pendência · Laranja: com pendência · Cinza: ainda sem vistoria registrada</div></div>
        <select class="select" id="filtro-mapa-acabamento">
          ${ORDEM_EXECUCAO.map((e) => `<option value="${e}">${e}</option>`).join("")}
        </select>
      </div>
      <div id="mapa-acabamento-host"></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><div class="card-title">Índice de problemas por tipo</div><div class="card-sub">Quantas vezes cada tipo de problema apareceu no histórico de vistorias</div></div>
        <select class="select" id="filtro-indice">
          <option value="Geral">Todas as obras</option>
          ${ORDEM_EXECUCAO.map((e) => `<option value="${e}">${e}</option>`).join("")}
        </select>
      </div>
      <div class="chart-host" id="chart-indice-problemas"></div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;">
        <h2>Resumo por obra</h2>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Obra</th><th class="num">Total de lotes</th><th class="num">Sem pendência</th><th class="num">Com pendência</th><th class="num">Sem vistoria</th><th class="num">% sem pendência (das vistoriadas)</th></tr></thead>
          <tbody>
            ${ORDEM_EXECUCAO.map((e) => {
              const pct = vistoriadas[e] ? (semCount[e] / vistoriadas[e]) * 100 : 0;
              return `<tr>
                <td>${e}</td>
                <td class="num">${GP.fmtInt(totalLotes[e])}</td>
                <td class="num">${GP.fmtInt(semCount[e])}</td>
                <td class="num">${GP.fmtInt(comCount[e])}</td>
                <td class="num">${GP.fmtInt(totalLotes[e] - vistoriadas[e])}</td>
                <td class="num"><span class="chip ${pct >= 70 ? "chip-good" : pct >= 40 ? "chip-warning" : "chip-serious"}">${GP.fmtPct(pct, 0)}</span></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("kpi-row").innerHTML = `
    <div class="card stat-tile">
      <div class="stat-label">Casas sem pendência</div>
      <div class="stat-value">${GP.fmtInt(semGeral)}</div>
      <span class="footnote">de ${GP.fmtInt(vistoriadasGeral)} já vistoriadas</span>
    </div>
    <div class="card stat-tile">
      <div class="stat-label">Casas com pendência</div>
      <div class="stat-value">${GP.fmtInt(comGeral)}</div>
      <span class="chip ${comGeral === 0 ? "chip-good" : "chip-warning"}">precisam de retorno</span>
    </div>
    <div class="card stat-tile">
      <div class="stat-label">% sem pendência (vistoriadas)</div>
      <div class="stat-value">${GP.fmtPct(vistoriadasGeral ? (semGeral / vistoriadasGeral) * 100 : 0, 0)}</div>
      <span class="footnote">entre as casas já vistoriadas</span>
    </div>
    <div class="card stat-tile">
      <div class="stat-label">Ainda sem vistoria</div>
      <div class="stat-value">${GP.fmtInt(totalGeralLotes - vistoriadasGeral)}</div>
      <span class="footnote">de ${GP.fmtInt(totalGeralLotes)} lotes no total</span>
    </div>
  `;

  function renderMapa() {
    const emp = state.empreendimento;
    const host = document.getElementById("mapa-acabamento-host");
    const mapa = mapaLotes[emp];
    if (!mapa) { host.innerHTML = ""; return; }

    const lotesSvg = mapa.lotes.map((lote) => {
      const sem = semPorLote[emp][lote.numero];
      const com = comPorLote[emp][lote.numero];
      const cor = sem ? "var(--status-good)" : com ? "var(--status-warning)" : "var(--border-strong)";
      const titulo = sem
        ? `Lote ${lote.numero} — sem pendência\nChecklist final de entrega limpo em ${GP.fmtDate(sem.data)}`
        : com
        ? `Lote ${lote.numero} — com pendência\n${GP.fmtDate(com.data)}\n${com.problemas.join(", ") || "problema não especificado"}`
        : `Lote ${lote.numero} — ainda sem vistoria registrada`;
      return `<path d="${lote.d}" fill="${cor}" stroke="var(--surface-raised)" stroke-width="0.4"><title>${titulo}</title></path>`;
    }).join("");
    const contornoSvg = mapa.contorno.map((d) => `<path d="${d}" fill="none" stroke="var(--border-strong)" stroke-width="0.3" opacity="0.5" />`).join("");

    host.innerHTML = `
      <svg viewBox="${mapa.viewBox}" style="width:100%; height:auto; max-height:640px; display:block;">
        <g>${contornoSvg}</g>
        <g>${lotesSvg}</g>
      </svg>
      <div class="legend" style="margin-top:10px;">
        <span class="tag-dot" style="color:var(--status-good)">Casas finalizadas sem pendências</span>
        <span class="tag-dot" style="color:var(--status-warning)">Casas com Pendências</span>
        <span class="tag-dot" style="color:var(--border-strong)">Sem vistoria registrada</span>
      </div>
      <p class="footnote" style="margin-top:8px;">${GP.fmtInt(semCount[emp])} sem pendência · ${GP.fmtInt(comCount[emp])} com pendência · ${GP.fmtInt(totalLotes[emp] - vistoriadas[emp])} sem vistoria — de ${GP.fmtInt(totalLotes[emp])} lotes</p>
    `;
  }

  document.getElementById("filtro-mapa-acabamento").addEventListener("change", (e) => { state.empreendimento = e.target.value; renderMapa(); });
  document.getElementById("filtro-indice").addEventListener("change", (e) => { state.indice = e.target.value; renderIndice(); });

  function renderIndice() {
    const dados = Object.entries(checklist.indice_problemas[state.indice] ?? {}).sort((a, b) => b[1] - a[1]);
    GPCharts.hbars(document.getElementById("chart-indice-problemas"), {
      items: dados.map(([label, value]) => ({ label, value, color: "var(--status-serious)" })),
      valueFormat: (v) => GP.fmtInt(v),
      showTarget: false,
    });
  }

  function renderGrafico() {
    GPCharts.barsLine(document.getElementById("chart-acabamento"), {
      items: ORDEM_EXECUCAO.map((e) => ({
        label: e, value: vistoriadas[e] ? Math.round((semCount[e] / vistoriadas[e]) * 1000) / 10 : 0, color: OBRA_COR[e],
      })),
      yFormat: (v) => `${Math.round(v * 10) / 10}%`,
      tooltipLabel: "Sem pendência",
      legendLabel: "% sem pendência (ordem de execução)",
    });
    renderMapa();
    renderIndice();
  }

  renderGrafico();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(renderGrafico, 200); });
})();
