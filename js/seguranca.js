"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "seguranca",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Saúde e Segurança",
  });
  if (!session) return;

  const [saude, naoConformidades, restricoes] = await Promise.all([
    GP.loadJSON("saude_ocupacional_resumo.json"), GP.loadJSON("seguranca_nao_conformidades.json"), GP.loadJSON("colaboradores_restricao.json"),
  ]);

  function fmtTempo(dias) {
    if (dias < 30) return `${dias} dia(s)`;
    if (dias < 365) return `${Math.round(dias / 30)} mês(es)`;
    const anos = Math.floor(dias / 365), meses = Math.round((dias % 365) / 30);
    return meses > 0 ? `${anos} ano(s) e ${meses} mês(es)` : `${anos} ano(s)`;
  }

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <div class="section-head" style="margin-bottom:4px; padding-bottom:8px; border-bottom:2px solid var(--border-strong);">
      <h2 style="font-size:21px;">Saúde</h2>
    </div>

    <div class="card">
      <div class="card-head" style="margin-bottom:4px;">
        <div><div class="card-title">Saúde ocupacional</div></div>
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
      <div class="grid grid-2">
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
      <div class="card-head" style="margin-bottom:14px;">
        <div><div class="card-title">Colaboradores com restrição</div></div>
        <span class="footnote">${GP.fmtInt(restricoes.length)} colaborador(es)</span>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Nome</th><th>Função</th><th>Tipo</th><th>Tempo em restrição</th></tr></thead>
          <tbody>
            ${restricoes.map((c) => `
              <tr>
                <td>${c.nome}</td>
                <td>${c.funcao || "—"}</td>
                <td><span class="chip ${c.tipo === "PERMANENTE" ? "chip-serious" : "chip-warning"}">${c.tipo || "—"}</span></td>
                <td>${fmtTempo(c.dias)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section-head" style="margin: 24px 0 4px; padding-bottom:8px; border-bottom:2px solid var(--border-strong);">
      <h2 style="font-size:21px;">Segurança</h2>
    </div>

    <div class="card">
      <div class="card-head" style="margin-bottom:4px;">
        <div><div class="card-title">Não conformidades de segurança</div></div>
        <span class="chip chip-neutral">Dados reais e agregados — Controle de Recomendações</span>
      </div>
      <p class="footnote" style="margin-bottom:14px;">
        Não conformidades observadas em campo e a medida disciplinar recomendada, sempre agregadas —
        nunca associadas a nome ou descrição do colaborador ou de quem aplicou.
      </p>
      <div class="grid grid-3" style="margin-bottom:16px;">
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
    const partesRestricao = Object.entries(saude.restricoes.por_parte_corpo).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
    GPCharts.bodyMap(document.getElementById("chart-saude-restricao"), { items: partesRestricao, color: "var(--accent)" });

    const partesQueixa = Object.entries(saude.queixas.por_parte_corpo).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
    GPCharts.bodyMap(document.getElementById("chart-saude-queixa"), { items: partesQueixa, color: "var(--gold)" });

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
