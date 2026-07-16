"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "acabamentos",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Acabamentos",
  });
  if (!session) return;

  const [casas, meta] = await Promise.all([
    GP.loadJSON("casas.json"), GP.loadJSON("casas_meta.json"),
  ]);

  const ETAPAS_ORDEM = ["radier", "alvenaria", "acab2_coberta", "reboco_int_ext", "acab1"];
  const state = { empreendimento: "todos", equipe: "todos" };

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <p class="footnote" style="margin-top:-6px;">
      Foco nas duas últimas macroetapas de acabamento (Acab.2 + Coberta e Acab.1),
      a partir dos mesmos dados reais da tela <a href="casas.html">Casas</a>.
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
    </div>

    <div class="grid grid-4" id="kpi-row"></div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Conclusão de acabamento por empreendimento</div><div class="card-sub">% de casas com Acab.1 concluído</div></div></div>
      <div class="chart-host" id="chart-emp"></div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;">
        <h2>Casas em fase de acabamento</h2>
        <span class="footnote" id="contador"></span>
      </div>
      <div class="table-wrap">
        <table class="data" id="tabela">
          <thead><tr><th>Casa</th><th>Empreendimento</th><th>Equipe (GA)</th><th>Etapa atual</th><th>Entrou na etapa em</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <p class="footnote" id="limite-nota" style="margin-top:10px;"></p>
    </div>
  `;

  const obraSelect = document.getElementById("filtro-emp");
  obraSelect.addEventListener("change", (e) => { state.empreendimento = e.target.value; render(); });
  document.getElementById("filtro-equipe").addEventListener("change", (e) => { state.equipe = e.target.value; render(); });

  function dataInicioEtapaAtual(c) {
    const idx = ETAPAS_ORDEM.indexOf(c.etapa_atual);
    if (idx <= 0) return c.data_inicio;
    return c.etapas[ETAPAS_ORDEM[idx - 1]].data;
  }

  function render() {
    const filtradas = casas.filter((c) =>
      (state.empreendimento === "todos" || c.empreendimento === state.empreendimento) &&
      (state.equipe === "todos" || c.ga === state.equipe)
    );

    const emAcab2 = filtradas.filter((c) => c.etapa_atual === "acab2_coberta");
    const emAcab1 = filtradas.filter((c) => c.etapa_atual === "acab1");
    const concluidas = filtradas.filter((c) => c.status === "concluida");
    const emFaseAcabamento = emAcab2.length + emAcab1.length + concluidas.length;

    document.getElementById("kpi-row").innerHTML = `
      <div class="card stat-tile">
        <div class="stat-label">Em Acab.2 + Coberta</div>
        <div class="stat-value">${GP.fmtInt(emAcab2.length)}</div>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Em Acab.1</div>
        <div class="stat-value">${GP.fmtInt(emAcab1.length)}</div>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Acabamentos concluídos</div>
        <div class="stat-value">${GP.fmtInt(concluidas.length)}</div>
        <span class="footnote">de ${GP.fmtInt(filtradas.length)} casas no filtro</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Já alcançaram acabamento</div>
        <div class="stat-value">${filtradas.length ? GP.fmtPct((emFaseAcabamento / filtradas.length) * 100, 0) : "0%"}</div>
        <span class="footnote">chegaram a Acab.2 ou além</span>
      </div>
    `;

    const empsParaGrafico = state.empreendimento === "todos" ? meta.empreendimentos : [state.empreendimento];
    GPCharts.hbars(document.getElementById("chart-emp"), {
      items: empsParaGrafico.map((emp) => {
        const doEmp = filtradas.filter((c) => c.empreendimento === emp);
        const conc = doEmp.filter((c) => c.status === "concluida").length;
        return { label: emp, value: doEmp.length ? Math.round((conc / doEmp.length) * 100) : 0, target: 100, color: "var(--accent)" };
      }),
      valueFormat: (v) => `${v}%`,
    });

    const emAcabamento = [...emAcab2, ...emAcab1].sort((a, b) => (dataInicioEtapaAtual(b) || "").localeCompare(dataInicioEtapaAtual(a) || ""));
    const LIMITE = 150;
    document.getElementById("contador").textContent = `${GP.fmtInt(emAcabamento.length)} casa(s) em acabamento`;
    document.querySelector("#tabela tbody").innerHTML = emAcabamento.slice(0, LIMITE).map((c) => `
      <tr>
        <td class="mono">${c.casa}</td>
        <td>${c.empreendimento}</td>
        <td>${c.ga}</td>
        <td><span class="chip chip-warning">${c.etapa_atual === "acab2_coberta" ? "Acab.2 + Coberta" : "Acab.1"}</span></td>
        <td>${dataInicioEtapaAtual(c) ? GP.fmtDate(dataInicioEtapaAtual(c)) : "—"}</td>
      </tr>`).join("") || `<tr><td colspan="5" class="footnote" style="padding:18px;">Nenhuma casa em fase de acabamento no filtro atual.</td></tr>`;
    document.getElementById("limite-nota").textContent = emAcabamento.length > LIMITE ? `Mostrando ${LIMITE} de ${GP.fmtInt(emAcabamento.length)} — refine os filtros.` : "";
  }

  render();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(render, 200); });
})();
