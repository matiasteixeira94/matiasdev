"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "faltas",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Faltas e Absenteísmo",
  });
  if (!session) return;

  const faltas = await GP.loadJSON("faltas.json");

  const MES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const CLASSIF_COR = { "NÃO.JUSTIFICADA": "var(--status-critical)", "JUSTIFICADA": "var(--status-good)", "ABONADA": "var(--cat-estrutura)" };

  const naoJustificadas = faltas.por_classificacao["NÃO.JUSTIFICADA"] || 0;
  const pctNaoJustificada = faltas.total_faltas ? (naoJustificadas / faltas.total_faltas) * 100 : 0;
  const mediaPorColaborador = faltas.colaboradores_ativos_total ? faltas.total_faltas / faltas.colaboradores_ativos_total : 0;

  const state = { ano: null, mes: null, apenasAtivos: false };

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <p class="footnote" style="margin-top:-6px;">
      Dados extraídos da aba <strong>Base</strong> da planilha matriz de DP (registros com situação
      "FALTA MÊS"), filtrados aos setores <strong>Produção</strong>, <strong>Assistência Técnica</strong> e
      <strong>Acabamento</strong> — ${GP.fmtInt(faltas.total_faltas)} faltas de ${GP.fmtInt(faltas.colaboradores_com_falta)}
      colaboradores (ativos e desligados) desde ${faltas.anos[0]}.
    </p>

    <div class="grid grid-4">
      <div class="card stat-tile">
        <div class="stat-label">Faltas totais</div>
        <div class="stat-value">${GP.fmtInt(faltas.total_faltas)}</div>
        <span class="footnote">registros desde ${faltas.anos[0]}</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">% de ativos que já faltaram</div>
        <div class="stat-value">${GP.fmtPct(faltas.pct_ativos_com_falta, 0)}</div>
        <span class="footnote">${GP.fmtInt(faltas.colaboradores_ativos_com_falta)} de ${GP.fmtInt(faltas.colaboradores_ativos_total)} colaboradores ativos</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Faltas por colaborador</div>
        <div class="stat-value">${GP.fmtNum1(mediaPorColaborador)}</div>
        <span class="footnote">média — total de faltas / ativos nos 3 setores</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">% não justificadas</div>
        <div class="stat-value">${GP.fmtPct(pctNaoJustificada, 0)}</div>
        <span class="chip ${pctNaoJustificada > 40 ? "chip-critical" : "chip-warning"}">${GP.fmtInt(naoJustificadas)} faltas</span>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><div class="card-title">Faltas por período</div><div class="card-sub" id="drill-caminho">Clique numa barra para detalhar por mês, e depois por dia</div></div>
        <button class="btn btn-ghost" id="btn-voltar-drill" type="button" style="display:none;">← Voltar</button>
      </div>
      <div class="chart-host" id="chart-faltas-drill"></div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;">
        <h2>Colaboradores que mais faltaram</h2>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="footnote" id="ranking-contador"></span>
          <div class="seg">
            <button type="button" aria-pressed="true" data-filtro="todos">Todos</button>
            <button type="button" aria-pressed="false" data-filtro="ativos">Ativos</button>
          </div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Nome</th><th>Cargo</th><th>Setor</th><th class="num">Faltas</th><th>Situação</th></tr></thead>
          <tbody id="ranking-tbody"></tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><div class="card-title">Faltas por setor</div><div class="card-sub">Produção, Assistência Técnica e Acabamento</div></div></div>
        <div class="chart-host" id="chart-faltas-setor"></div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title">Faltas por classificação</div><div class="card-sub">Justificada, não justificada e abonada</div></div></div>
        <div class="chart-host" id="chart-faltas-classificacao"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Principais motivos</div><div class="card-sub">Top 10 motivos de falta no período</div></div></div>
      <div class="chart-host" id="chart-faltas-motivo"></div>
    </div>
  `;

  function renderDrill() {
    const host = document.getElementById("chart-faltas-drill");
    const caminho = document.getElementById("drill-caminho");
    const voltar = document.getElementById("btn-voltar-drill");
    let items, onClick;

    if (state.mes) {
      const [anoStr, mesStr] = state.mes.split("-");
      const diasNoMes = new Date(Number(anoStr), Number(mesStr), 0).getDate();
      const porDia = faltas.por_mes_dia[state.mes] || {};
      items = Array.from({ length: diasNoMes }, (_, i) => ({ label: String(i + 1), value: porDia[i + 1] || 0 }));
      caminho.textContent = `${MES_ABREV[Number(mesStr) - 1]}/${anoStr} — por dia`;
      onClick = null;
      voltar.style.display = "";
    } else if (state.ano) {
      const porMes = faltas.por_ano_mes[state.ano] || {};
      const mesesOrdenados = Object.keys(porMes).sort();
      items = mesesOrdenados.map((mesKey) => ({ label: MES_ABREV[Number(mesKey.slice(5, 7)) - 1], value: porMes[mesKey], mesKey }));
      caminho.textContent = `${state.ano} — clique num mês para ver por dia`;
      onClick = (it) => { state.mes = it.mesKey; renderDrill(); };
      voltar.style.display = "";
    } else {
      items = faltas.anos.map((ano) => ({ label: ano, value: faltas.por_ano[ano], ano }));
      caminho.textContent = "Clique num ano para ver por mês";
      onClick = (it) => { state.ano = it.ano; renderDrill(); };
      voltar.style.display = "none";
    }

    GPCharts.barsLine(host, {
      items, yFormat: (v) => GP.fmtInt(v), tooltipLabel: "Faltas",
      legendLabel: state.mes ? "Faltas por dia" : state.ano ? "Faltas por mês" : "Faltas por ano",
      onClick,
    });
  }

  document.getElementById("btn-voltar-drill").addEventListener("click", () => {
    if (state.mes) state.mes = null;
    else if (state.ano) state.ano = null;
    renderDrill();
  });

  function renderRanking() {
    const filtrados = state.apenasAtivos ? faltas.ranking.filter((r) => r.ativo) : faltas.ranking;
    const top20 = filtrados.slice(0, 20);
    document.getElementById("ranking-contador").textContent = state.apenasAtivos
      ? `Top 20 de ${GP.fmtInt(filtrados.length)} ativos com falta`
      : "Top 20 — histórico completo (ativos e desligados)";
    document.getElementById("ranking-tbody").innerHTML = top20.map((r) => `
      <tr>
        <td>${r.nome}</td>
        <td>${r.cargo || "—"}</td>
        <td>${r.setor}</td>
        <td class="num">${GP.fmtInt(r.total)}</td>
        <td><span class="chip ${r.ativo ? "chip-good" : "chip-neutral"}">${r.ativo ? "Ativo" : "Desligado"}</span></td>
      </tr>`).join("") || `<tr><td colspan="5" class="footnote" style="padding:18px;">Nenhum colaborador no filtro atual.</td></tr>`;
  }

  document.querySelectorAll("[data-filtro]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.apenasAtivos = btn.dataset.filtro === "ativos";
      document.querySelectorAll("[data-filtro]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      renderRanking();
    });
  });

  function renderSuporte() {
    GPCharts.hbars(document.getElementById("chart-faltas-setor"), {
      items: Object.entries(faltas.por_setor).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: "var(--accent)" })),
      valueFormat: (v) => GP.fmtInt(v),
      showTarget: false,
    });
    GPCharts.hbars(document.getElementById("chart-faltas-classificacao"), {
      items: Object.entries(faltas.por_classificacao).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: CLASSIF_COR[label] || "var(--ink-muted)" })),
      valueFormat: (v) => GP.fmtInt(v),
      showTarget: false,
    });
    GPCharts.hbars(document.getElementById("chart-faltas-motivo"), {
      items: Object.entries(faltas.por_motivo).slice(0, 10).map(([label, value]) => ({ label, value, color: "var(--status-serious)" })),
      valueFormat: (v) => GP.fmtInt(v),
      showTarget: false,
    });
  }

  renderDrill();
  renderRanking();
  renderSuporte();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(renderDrill, 200); });
})();
