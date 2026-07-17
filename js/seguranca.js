"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "seguranca",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Saúde e Segurança",
  });
  if (!session) return;

  const [saude, naoConformidades] = await Promise.all([
    GP.loadJSON("saude_ocupacional_resumo.json"), GP.loadJSON("seguranca_nao_conformidades.json"),
  ]);

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <div class="card">
      <div class="section-head" style="margin-bottom:4px;">
        <h2>Saúde ocupacional</h2>
        <span class="chip chip-neutral">Dados reais e agregados — Viana &amp; Moura, UGB Caruaru</span>
      </div>
      <p class="footnote" style="margin-bottom:14px;">
        Estatísticas de restrições médicas e queixas ocupacionais, sempre agregadas — nunca
        associadas a nome, cargo ou qualquer detalhe que identifique um colaborador.
      </p>
      <div class="grid grid-4" style="margin-bottom:16px;">
        <div class="stat-tile">
          <div class="stat-label">Colaboradores com restrição</div>
          <div class="stat-value">${GP.fmtInt(saude.restricoes.colaboradores_unicos)}</div>
          <span class="footnote">${saude.restricoes.por_tipo["TEMPORÁRIA"] || 0} temporária(s) · ${saude.restricoes.por_tipo["PERMANENTE"] || 0} permanente(s)</span>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Queixas registradas</div>
          <div class="stat-value">${GP.fmtInt(saude.queixas.total_registros)}</div>
          <span class="footnote">${saude.queixas.status["Em acompanhamento"] || 0} em acompanhamento</span>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Geraram tratamento</div>
          <div class="stat-value">${GP.fmtPct((saude.queixas.solicitaram_tratamento / saude.queixas.total_registros) * 100, 0)}</div>
          <span class="footnote">${saude.queixas.solicitaram_tratamento} de ${saude.queixas.total_registros} queixas</span>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Geraram restrição</div>
          <div class="stat-value">${GP.fmtPct((saude.queixas.geraram_restricao / saude.queixas.total_registros) * 100, 0)}</div>
          <span class="footnote">${saude.queixas.geraram_restricao} de ${saude.queixas.total_registros} queixas</span>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:20px;">
        <div>
          <div class="card-sub" style="margin-bottom:8px;">Restrições por parte do corpo</div>
          <div class="chart-host" id="chart-saude-restricao"></div>
        </div>
        <div>
          <div class="card-sub" style="margin-bottom:8px;">Queixas por parte do corpo</div>
          <div class="chart-host" id="chart-saude-queixa"></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:4px;">
        <h2>Não conformidades de segurança</h2>
        <span class="chip chip-neutral">Dados reais e agregados — Controle de Recomendações</span>
      </div>
      <p class="footnote" style="margin-bottom:14px;">
        Não conformidades observadas em campo e a medida disciplinar recomendada, sempre agregadas —
        nunca associadas a nome ou descrição do colaborador ou de quem aplicou.
      </p>
      <div class="grid grid-4" style="margin-bottom:16px;">
        <div class="stat-tile">
          <div class="stat-label">Registros no histórico</div>
          <div class="stat-value">${GP.fmtInt(naoConformidades.total_registros)}</div>
          <span class="footnote">desde ${Object.keys(naoConformidades.por_ano)[0]}</span>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Registros em ${new Date().getFullYear()}</div>
          <div class="stat-value">${GP.fmtInt(naoConformidades.por_ano[new Date().getFullYear()] || 0)}</div>
          <span class="footnote">ano corrente</span>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Situação sanada</div>
          <div class="stat-value">${GP.fmtPct((naoConformidades.sanada["Sanada"] / naoConformidades.total_registros) * 100, 0)}</div>
          <span class="footnote">${GP.fmtInt(naoConformidades.sanada["Sanada"] || 0)} de ${GP.fmtInt(naoConformidades.total_registros)} registros</span>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Setor mais recorrente</div>
          <div class="stat-value" style="font-size:20px;">${Object.entries(naoConformidades.por_setor).sort((a, b) => b[1] - a[1])[0][0]}</div>
          <span class="footnote">${Object.entries(naoConformidades.por_setor).sort((a, b) => b[1] - a[1])[0][1]} registro(s)</span>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:20px;">
        <div>
          <div class="card-sub" style="margin-bottom:8px;">Por medida disciplinar recomendada</div>
          <div class="chart-host" id="chart-nc-medida"></div>
        </div>
        <div>
          <div class="card-sub" style="margin-bottom:8px;">Registros por ano</div>
          <div class="chart-host" id="chart-nc-ano"></div>
        </div>
      </div>
    </div>
  `;

  function renderGraficos() {
    const partesRestricao = Object.entries(saude.restricoes.por_parte_corpo).sort((a, b) => b[1] - a[1]);
    GPCharts.bars(document.getElementById("chart-saude-restricao"), {
      categories: partesRestricao.map(([k]) => k),
      series: [{ name: "Colaboradores", color: "var(--accent)", values: partesRestricao.map(([, v]) => v) }],
      yFormat: (v) => GP.fmtInt(v),
    });
    const partesQueixa = Object.entries(saude.queixas.por_parte_corpo).sort((a, b) => b[1] - a[1]);
    GPCharts.bars(document.getElementById("chart-saude-queixa"), {
      categories: partesQueixa.map(([k]) => k),
      series: [{ name: "Queixas", color: "var(--gold)", values: partesQueixa.map(([, v]) => v) }],
      yFormat: (v) => GP.fmtInt(v),
    });

    const medidas = Object.entries(naoConformidades.por_medida).sort((a, b) => b[1] - a[1]);
    GPCharts.bars(document.getElementById("chart-nc-medida"), {
      categories: medidas.map(([k]) => k),
      series: [{ name: "Registros", color: "var(--status-warning)", values: medidas.map(([, v]) => v) }],
      yFormat: (v) => GP.fmtInt(v),
    });
    const anos = Object.entries(naoConformidades.por_ano);
    GPCharts.bars(document.getElementById("chart-nc-ano"), {
      categories: anos.map(([k]) => k),
      series: [{ name: "Registros", color: "var(--accent)", values: anos.map(([, v]) => v) }],
      yFormat: (v) => GP.fmtInt(v),
    });
  }

  renderGraficos();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(renderGraficos, 200); });
})();
