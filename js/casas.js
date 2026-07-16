"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "casas",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Casas",
  });
  if (!session) return;

  const [casas, meta] = await Promise.all([
    GP.loadJSON("casas.json"), GP.loadJSON("casas_meta.json"),
  ]);

  const ETAPAS_ORDEM = ["radier", "alvenaria", "acab2_coberta", "reboco_int_ext", "acab1"];
  const ETAPA_LABEL = { radier: "Radier", alvenaria: "Alvenaria", acab2_coberta: "Acab.2 + Coberta", reboco_int_ext: "Reboco Int.+Ext.", acab1: "Acab.1", entregue: "Entregue" };
  const STATUS_LABEL = { concluida: "Concluída", em_producao: "Em produção", nao_iniciada: "Não iniciada" };
  const STATUS_CHIP = { concluida: "chip-good", em_producao: "chip-warning", nao_iniciada: "chip-neutral" };

  const state = { empreendimento: "todos", equipe: "todos", status: "todos", busca: "" };

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <p class="footnote" style="margin-top:-6px;">
      Dados extraídos da aba <strong>DADOS CASA</strong> das planilhas de controle de produção
      (2026.1 e 2026.2) — ${GP.fmtInt(casas.length)} casas, ${meta.equipes.length} equipes,
      ${meta.empreendimentos.length} empreendimentos.
    </p>

    <div class="filter-bar">
      <div class="field">
        <label>Empreendimento</label>
        <select class="select" id="filtro-emp">
          <option value="todos">Todos</option>
          ${meta.empreendimentos.map((e) => `<option value="${e}">${e}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Equipe (GA)</label>
        <select class="select" id="filtro-equipe">
          <option value="todos">Todas</option>
          ${meta.equipes.map((g) => `<option value="${g}">${g}${meta.supervisorPorEquipe[g] ? " — " + meta.supervisorPorEquipe[g] : ""}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Status</label>
        <select class="select" id="filtro-status">
          <option value="todos">Todos</option>
          <option value="concluida">Concluída</option>
          <option value="em_producao">Em produção</option>
          <option value="nao_iniciada">Não iniciada</option>
        </select>
      </div>
      <div class="field" style="flex:1; min-width:160px;">
        <label>Buscar casa</label>
        <input class="input" id="filtro-busca" placeholder="Código da casa (ex.: RA 477R)" style="width:100%;" />
      </div>
    </div>

    <div class="grid grid-auto" id="kpi-row"></div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><div class="card-title">Casas por status</div><div class="card-sub">No filtro atual</div></div></div>
        <div class="chart-host" id="chart-status"></div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title">Conclusão por empreendimento</div><div class="card-sub">% de casas concluídas</div></div></div>
        <div class="chart-host" id="chart-emp"></div>
      </div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;">
        <h2>Registro de casas</h2>
        <span class="footnote" id="contador-casas"></span>
      </div>
      <div class="table-wrap">
        <table class="data" id="tabela-casas">
          <thead>
            <tr>
              <th>Casa</th><th>Empreendimento</th><th>Equipe (GA)</th><th>Supervisor</th>
              <th>Status</th><th>Progresso</th><th>Etapa atual</th><th>Início</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <p class="footnote" id="limite-nota" style="margin-top:10px;"></p>
    </div>
  `;

  document.getElementById("filtro-emp").addEventListener("change", (e) => { state.empreendimento = e.target.value; render(); });
  document.getElementById("filtro-equipe").addEventListener("change", (e) => { state.equipe = e.target.value; render(); });
  document.getElementById("filtro-status").addEventListener("change", (e) => { state.status = e.target.value; render(); });
  let buscaTimer;
  document.getElementById("filtro-busca").addEventListener("input", (e) => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => { state.busca = e.target.value.trim().toUpperCase(); render(); }, 150);
  });

  function stageTracker(casaRow) {
    return `<div class="stage-tracker">${ETAPAS_ORDEM.map((et, i) => {
      const done = i < casaRow.macroetapas_concluidas;
      const current = i === casaRow.macroetapas_concluidas && casaRow.status !== "concluida";
      return `<span class="stage-dot ${done ? "done" : ""} ${current ? "current" : ""}" title="${ETAPA_LABEL[et]}"></span>`;
    }).join("")}</div>`;
  }

  function render() {
    const filtradas = casas.filter((c) =>
      (state.empreendimento === "todos" || c.empreendimento === state.empreendimento) &&
      (state.equipe === "todos" || c.ga === state.equipe) &&
      (state.status === "todos" || c.status === state.status) &&
      (!state.busca || c.casa.toUpperCase().includes(state.busca))
    );

    const concluidas = filtradas.filter((c) => c.status === "concluida").length;
    const emProducao = filtradas.filter((c) => c.status === "em_producao").length;
    const naoIniciadas = filtradas.filter((c) => c.status === "nao_iniciada").length;
    const equipesAtivas = new Set(filtradas.filter((c) => c.status !== "nao_iniciada").map((c) => c.ga)).size;
    const empreendimentosNoFiltro = new Set(filtradas.map((c) => c.empreendimento)).size;

    document.getElementById("kpi-row").innerHTML = `
      <div class="card stat-tile">
        <div class="stat-label">Total de casas</div>
        <div class="stat-value">${GP.fmtInt(filtradas.length)}</div>
        <span class="footnote">${empreendimentosNoFiltro} empreendimento(s)</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Concluídas</div>
        <div class="stat-value">${GP.fmtInt(concluidas)}<small>${filtradas.length ? GP.fmtPct((concluidas / filtradas.length) * 100) : "0%"}</small></div>
        <span class="chip chip-good">Entregues</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Em produção</div>
        <div class="stat-value">${GP.fmtInt(emProducao)}</div>
        <span class="chip chip-warning">${equipesAtivas} equipe(s) ativa(s)</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Não iniciadas</div>
        <div class="stat-value">${GP.fmtInt(naoIniciadas)}</div>
        <span class="footnote">Aguardando início do radier</span>
      </div>
    `;

    GPCharts.bars(document.getElementById("chart-status"), {
      categories: ["Concluída", "Em produção", "Não iniciada"],
      series: [{ name: "Casas", color: "var(--accent)", values: [concluidas, emProducao, naoIniciadas] }],
      yFormat: (v) => GP.fmtInt(v),
    });

    const empsParaGrafico = state.empreendimento === "todos" ? meta.empreendimentos : [state.empreendimento];
    GPCharts.hbars(document.getElementById("chart-emp"), {
      items: empsParaGrafico.map((emp) => {
        const doEmp = filtradas.filter((c) => c.empreendimento === emp);
        const conc = doEmp.filter((c) => c.status === "concluida").length;
        return { label: emp, value: doEmp.length ? Math.round((conc / doEmp.length) * 100) : 0, target: 100, color: "var(--accent)" };
      }),
      valueFormat: (v) => `${v}%`,
    });

    const LIMITE = 150;
    const paraTabela = filtradas.slice(0, LIMITE);
    document.getElementById("contador-casas").textContent = `${GP.fmtInt(filtradas.length)} casa(s)`;
    document.querySelector("#tabela-casas tbody").innerHTML = paraTabela.map((c) => `
      <tr>
        <td class="mono">${c.casa}</td>
        <td>${c.empreendimento}</td>
        <td>${c.ga}</td>
        <td>${c.supervisor || "—"}</td>
        <td><span class="chip ${STATUS_CHIP[c.status]}">${STATUS_LABEL[c.status]}</span></td>
        <td>${stageTracker(c)}</td>
        <td class="footnote">${ETAPA_LABEL[c.etapa_atual] ?? c.etapa_atual}</td>
        <td>${c.data_inicio ? GP.fmtDate(c.data_inicio) : "—"}</td>
      </tr>`).join("") || `<tr><td colspan="8" class="footnote" style="padding:18px;">Nenhuma casa no filtro atual.</td></tr>`;

    document.getElementById("limite-nota").textContent = filtradas.length > LIMITE
      ? `Mostrando ${LIMITE} de ${GP.fmtInt(filtradas.length)} — refine os filtros para ver outras casas.`
      : "";
  }

  render();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(render, 200); });
})();
