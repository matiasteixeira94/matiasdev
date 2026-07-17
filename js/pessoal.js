"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "pessoal",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Quadro de Pessoal",
  });
  if (!session) return;

  const [ativos, resumo, quadroMensal] = await Promise.all([
    GP.loadJSON("pessoal_ativos.json"), GP.loadJSON("pessoal_resumo.json"), GP.loadJSON("quadro_pessoal_mensal.json"),
  ]);

  const ptCompare = (a, b) => a.localeCompare(b, "pt-BR");
  const funcoes = [...new Set(ativos.map((a) => a.funcao).filter(Boolean))].sort(ptCompare);
  const tipos = [...new Set(ativos.map((a) => a.tipo).filter(Boolean))].sort(ptCompare);

  const state = { funcao: "todos", tipo: "todos", busca: "" };

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <p class="footnote" style="margin-top:-6px;">
      Dados extraídos da aba <strong>Quadro Geral</strong> (colaboradores ativos) e do
      <strong>Boletim mensal</strong> (planejado x realizado) das planilhas de gestão de pessoal.
      Nome, função, setor e tipo são públicos nesta tela — CPF, PIS e data de nascimento nunca são exibidos.
    </p>

    <div class="grid grid-4">
      <div class="card stat-tile">
        <div class="stat-label">Colaboradores ativos</div>
        <div class="stat-value">${GP.fmtInt(resumo.ativos)}</div>
        <span class="footnote">de ${GP.fmtInt(resumo.total)} no quadro total</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Mão de obra direta</div>
        <div class="stat-value">${GP.fmtInt(resumo.direto)}</div>
        <span class="footnote">${GP.fmtPct((resumo.direto / resumo.ativos) * 100, 0)} dos ativos</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Mão de obra indireta</div>
        <div class="stat-value">${GP.fmtInt(resumo.indireto)}</div>
        <span class="footnote">${GP.fmtPct((resumo.indireto / resumo.ativos) * 100, 0)} dos ativos</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Outras situações</div>
        <div class="stat-value">${GP.fmtInt(resumo.outras_situacoes)}</div>
        <span class="footnote">afastado, contrato suspenso etc.</span>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Quadro planejado x realizado</div><div class="card-sub">Nº de colaboradores por mês — desvio = realizado − planejado</div></div></div>
      <div class="chart-host" id="chart-pessoal"></div>
      <div class="table-wrap" style="margin-top:16px;">
        <table class="data">
          <thead><tr><th>Mês</th><th class="num">Planejado</th><th class="num">Realizado</th><th class="num">Desvio</th></tr></thead>
          <tbody>
            ${quadroMensal.meses.map((m) => {
              const desvio = m.realizado - m.planejado;
              const seta = desvio >= 0
                ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--status-good)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`
                : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--status-critical)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`;
              return `<tr>
                <td>${m.label}</td>
                <td class="num">${GP.fmtInt(m.planejado)}</td>
                <td class="num">${GP.fmtInt(m.realizado)}</td>
                <td class="num"><span class="chip ${desvio >= 0 ? "chip-good" : "chip-warning"}">${seta} ${desvio > 0 ? "+" : ""}${GP.fmtInt(desvio)}</span></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;">
        <h2>Colaboradores ativos</h2>
        <span class="footnote" id="contador-pessoal"></span>
      </div>
      <div class="filter-bar">
        <div class="field">
          <label>Função</label>
          <select class="select" id="filtro-funcao">
            <option value="todos">Todas</option>
            ${funcoes.map((f) => `<option value="${f}">${f}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Tipo</label>
          <select class="select" id="filtro-tipo">
            <option value="todos">Todos</option>
            ${tipos.map((t) => `<option value="${t}">${t.trim()}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="flex:1; min-width:200px;">
          <label>Buscar por nome</label>
          <input class="input" id="filtro-busca" placeholder="Nome do colaborador" style="width:100%;" />
        </div>
      </div>
      <div class="table-wrap">
        <table class="data" id="tabela-pessoal">
          <thead>
            <tr><th>Nome</th><th>Função</th><th>Tipo</th><th>Tempo de empresa</th><th>Admissão</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;

  GPCharts.bars(document.getElementById("chart-pessoal"), {
    categories: quadroMensal.meses.map((m) => m.label.replace("/2026", "")),
    series: [
      { name: "Planejado", color: "var(--border-strong)", values: quadroMensal.meses.map((m) => m.planejado) },
      { name: "Realizado", color: "var(--accent)", values: quadroMensal.meses.map((m) => m.realizado) },
    ],
    yFormat: (v) => GP.fmtInt(v),
  });

  document.getElementById("filtro-funcao").addEventListener("change", (e) => { state.funcao = e.target.value; render(); });
  document.getElementById("filtro-tipo").addEventListener("change", (e) => { state.tipo = e.target.value; render(); });
  let buscaTimer;
  document.getElementById("filtro-busca").addEventListener("input", (e) => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => { state.busca = e.target.value.trim().toUpperCase(); render(); }, 150);
  });

  function render() {
    const filtrados = ativos.filter((a) =>
      (state.funcao === "todos" || a.funcao === state.funcao) &&
      (state.tipo === "todos" || a.tipo === state.tipo) &&
      (!state.busca || a.nome.toUpperCase().includes(state.busca))
    );
    document.getElementById("contador-pessoal").textContent = `${GP.fmtInt(filtrados.length)} colaborador(es)`;
    document.querySelector("#tabela-pessoal tbody").innerHTML = filtrados.map((a) => `
      <tr>
        <td>${a.nome}</td>
        <td>${a.funcao}</td>
        <td><span class="chip chip-neutral">${a.tipo.trim()}</span></td>
        <td>${a.tempo_empresa_anos != null ? `${GP.fmtNum1(a.tempo_empresa_anos)} anos` : "—"}</td>
        <td>${a.data_admissao ? GP.fmtDate(a.data_admissao) : "—"}</td>
      </tr>`).join("") || `<tr><td colspan="5" class="footnote" style="padding:18px;">Nenhum colaborador no filtro atual.</td></tr>`;
  }

  render();
  window.addEventListener("resize", () => {
    clearTimeout(window.__gpResize);
    window.__gpResize = setTimeout(() => {
      GPCharts.bars(document.getElementById("chart-pessoal"), {
        categories: quadroMensal.meses.map((m) => m.label.replace("/2026", "")),
        series: [
          { name: "Planejado", color: "var(--border-strong)", values: quadroMensal.meses.map((m) => m.planejado) },
          { name: "Realizado", color: "var(--accent)", values: quadroMensal.meses.map((m) => m.realizado) },
        ],
        yFormat: (v) => GP.fmtInt(v),
      });
    }, 200);
  });
})();
