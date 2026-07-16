"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "faltas",
    eyebrow: "Gestão da Produção",
    title: "Faltas e Absenteísmo",
  });
  if (!session) return;

  const [obras, colaboradores, faltas] = await Promise.all([
    GP.loadJSON("obras.json"), GP.loadJSON("colaboradores.json"), GP.loadJSON("faltas.json"),
  ]);
  const colabById = Object.fromEntries(colaboradores.map((c) => [c.id, c]));

  const HOJE = "2026-07-16";
  const state = { obraId: session.perfil === "supervisor" ? session.obraId : "todas", grupo: "todos", tipo: "todos", justificativa: "todas", from: GP.isoDaysAgo(29, HOJE), to: HOJE };

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <div class="filter-bar">
      <div class="field">
        <label>Período</label>
        <div class="seg" id="seg-periodo">
          <button data-v="7">7 dias</button>
          <button data-v="30" aria-pressed="true">30 dias</button>
          <button data-v="90">90 dias</button>
        </div>
      </div>
      <div class="field"><label>Obra</label><select class="select" id="filtro-obra"></select></div>
      <div class="field">
        <label>Grupo</label>
        <select class="select" id="filtro-grupo">
          <option value="todos">Todos os grupos</option>
          <option value="estrutura">Estrutura</option>
          <option value="alvenaria">Alvenaria</option>
          <option value="acabamento">Acabamento</option>
        </select>
      </div>
      <div class="field">
        <label>Tipo</label>
        <select class="select" id="filtro-tipo">
          <option value="todos">Todos os tipos</option>
          <option value="falta">Falta</option>
          <option value="atraso">Atraso</option>
          <option value="saida_antecipada">Saída antecipada</option>
        </select>
      </div>
      <div class="field">
        <label>Justificativa</label>
        <select class="select" id="filtro-justificativa">
          <option value="todas">Todas</option>
          <option value="pendente">Pendentes</option>
          <option value="justificada">Justificadas</option>
          <option value="injustificada">Injustificadas</option>
        </select>
      </div>
    </div>

    <div class="grid grid-4" id="kpi-row"></div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><div class="card-title">Absenteísmo por obra</div><div class="card-sub">% de dias-pessoa perdidos no período</div></div></div>
        <div class="chart-host" id="chart-obra"></div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title">Comparativo histórico</div><div class="card-sub">Taxa semanal, últimas 13 semanas</div></div></div>
        <div class="chart-host" id="chart-historico"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Padrões — faltas crônicas</div><div class="card-sub">Colaboradores com 3 ou mais ocorrências no período filtrado</div></div></div>
      <div class="table-wrap">
        <table class="data" id="tabela-cronicos">
          <thead><tr><th>Colaborador</th><th>Função</th><th>Obra</th><th class="num">Ocorrências</th><th class="num">Injustificadas</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;"><h2>Registro de faltas</h2><span class="footnote" id="contador-faltas"></span></div>
      <div class="table-wrap">
        <table class="data" id="tabela-faltas">
          <thead><tr><th>Data</th><th>Colaborador</th><th>Obra</th><th>Grupo</th><th>Tipo</th><th>Justificativa</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;

  const obraSelect = document.getElementById("filtro-obra");
  const obrasVisiveis = session.perfil === "supervisor" ? obras.filter((o) => o.id === session.obraId) : obras;
  if (session.perfil !== "supervisor") obraSelect.appendChild(new Option("Todas as obras", "todas"));
  obrasVisiveis.forEach((o) => obraSelect.appendChild(new Option(`${o.id} — ${o.nome}`, o.id)));
  obraSelect.value = state.obraId;
  obraSelect.disabled = session.perfil === "supervisor";

  document.getElementById("seg-periodo").addEventListener("click", (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    document.querySelectorAll("#seg-periodo button").forEach((b) => b.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");
    state.from = GP.isoDaysAgo(Number(btn.dataset.v) - 1, HOJE); state.to = HOJE; render();
  });
  obraSelect.addEventListener("change", (e) => { state.obraId = e.target.value; render(); });
  ["grupo", "tipo", "justificativa"].forEach((k) => {
    document.getElementById(`filtro-${k}`).addEventListener("change", (e) => { state[k] = e.target.value; render(); });
  });

  function matchObra(id) { return state.obraId === "todas" || id === state.obraId; }
  function matchGrupo(g) { return state.grupo === "todos" || g === state.grupo; }
  function matchPeriodo(d) { return GP.within(d, state.from, state.to); }
  function matchTipo(t) { return state.tipo === "todos" || t === state.tipo; }
  function matchJustificativa(f) {
    if (state.justificativa === "todas") return true;
    if (state.justificativa === "pendente") return f.motivo === null;
    if (state.justificativa === "justificada") return f.motivo !== null && f.justificada;
    return f.motivo !== null && !f.justificada;
  }

  function render() {
    const faltasF = faltas.filter((f) => matchObra(f.obra_id) && matchGrupo(f.grupo) && matchPeriodo(f.data) && matchTipo(f.tipo) && matchJustificativa(f));

    const colabElegiveis = colaboradores.filter((c) => c.ativo && c.grupo !== "administrativo" && matchObra(c.obra_id) && matchGrupo(c.grupo));
    const diasNoPeriodo = businessDaysBetween(state.from, state.to);
    const pessoasDia = colabElegiveis.length * diasNoPeriodo;
    const taxa = pessoasDia ? (faltasF.length / pessoasDia) * 100 : 0;
    const pendentes = faltasF.filter((f) => f.motivo === null).length;
    const injustificadas = faltasF.filter((f) => f.motivo !== null && !f.justificada).length;

    const contagemPorColab = {};
    faltasF.forEach((f) => (contagemPorColab[f.colaborador_id] = (contagemPorColab[f.colaborador_id] || 0) + 1));
    const cronicos = Object.entries(contagemPorColab).filter(([, n]) => n >= 3).length;

    document.getElementById("kpi-row").innerHTML = `
      <div class="card stat-tile">
        <div class="stat-label">Taxa de absenteísmo</div>
        <div class="stat-value">${GP.fmtPct(taxa)}</div>
        <span class="stat-delta ${taxa <= 3 ? "delta-up" : taxa <= 6 ? "delta-flat" : "delta-down"}">Meta ≤ 3,0%</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Ocorrências no período</div>
        <div class="stat-value">${faltasF.length}</div>
        <span class="footnote">${injustificadas} injustificadas</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Pendentes de justificativa</div>
        <div class="stat-value">${pendentes}</div>
        <span class="chip ${pendentes === 0 ? "chip-good" : "chip-warning"}">${pendentes === 0 ? "Em dia" : "Ação necessária"}</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Colaboradores crônicos</div>
        <div class="stat-value">${cronicos}</div>
        <span class="footnote">≥ 3 ocorrências no período</span>
      </div>
    `;

    const obrasParaGrafico = state.obraId === "todas" ? obras.filter((o) => o.status === "em_execucao") : obras.filter((o) => o.id === state.obraId);
    GPCharts.hbars(document.getElementById("chart-obra"), {
      items: obrasParaGrafico.map((o) => {
        const eq = colaboradores.filter((c) => c.ativo && c.grupo !== "administrativo" && c.obra_id === o.id && matchGrupo(c.grupo));
        const f = faltas.filter((x) => x.obra_id === o.id && matchGrupo(x.grupo) && matchPeriodo(x.data) && matchTipo(x.tipo) && matchJustificativa(x));
        const t = eq.length ? (f.length / (eq.length * diasNoPeriodo)) * 100 : 0;
        return { label: o.nome, value: Math.round(t * 10) / 10, target: 3, color: t > 6 ? "var(--status-critical)" : t > 3 ? "var(--status-warning)" : "var(--status-good)" };
      }),
      valueFormat: (v) => `${v}%`, showTarget: true,
    });

    const semanas = weeklyBuckets(13, HOJE);
    const taxasSemanais = semanas.map(([ini, fim]) => {
      const f = faltas.filter((x) => matchObra(x.obra_id) && matchGrupo(x.grupo) && GP.within(x.data, ini, fim));
      const dias = businessDaysBetween(ini, fim);
      const eq = colaboradores.filter((c) => c.ativo && c.grupo !== "administrativo" && matchObra(c.obra_id) && matchGrupo(c.grupo)).length;
      return eq ? (f.length / (eq * dias)) * 100 : 0;
    });
    GPCharts.line(document.getElementById("chart-historico"), {
      labels: semanas.map(([, fim]) => GP.fmtDateShort(fim)),
      series: [{ name: "Absenteísmo semanal", color: "var(--accent)", values: taxasSemanais, area: true }],
      yFormat: (v) => GP.fmtPct(v, 1),
    });

    const tbodyCronicos = document.querySelector("#tabela-cronicos tbody");
    const listaCronicos = Object.entries(contagemPorColab).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
    tbodyCronicos.innerHTML = listaCronicos.length ? listaCronicos.map(([colabId, n]) => {
      const c = colabById[colabId];
      const injust = faltasF.filter((f) => f.colaborador_id === colabId && f.motivo !== null && !f.justificada).length;
      return `<tr>
        <td>${c ? c.nome : colabId}</td>
        <td>${c ? c.funcao : "—"}</td>
        <td>${colabId in colabById ? c.obra_id : "—"}</td>
        <td class="num">${n}</td>
        <td class="num">${injust > 0 ? `<span class="chip chip-critical">${injust}</span>` : "0"}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="5" class="footnote" style="padding:18px;">Nenhum padrão de falta recorrente no filtro atual.</td></tr>`;

    document.getElementById("contador-faltas").textContent = `${faltasF.length} registro(s)`;
    const tbody = document.querySelector("#tabela-faltas tbody");
    const tipoLabel = { falta: "Falta", atraso: "Atraso", saida_antecipada: "Saída antecipada" };
    tbody.innerHTML = faltasF.sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 60).map((f) => {
      const c = colabById[f.colaborador_id];
      let justCol;
      if (f.motivo === null) justCol = `<span class="chip chip-warning">Pendente</span>`;
      else justCol = f.justificada ? `<span class="chip chip-good">Justificada</span> <span class="footnote">${f.motivo}</span>` : `<span class="chip chip-critical">Injustificada</span>`;
      return `<tr>
        <td>${GP.fmtDate(f.data)}</td>
        <td>${c ? c.nome : f.colaborador_id}</td>
        <td>${f.obra_id}</td>
        <td><span class="tag-dot" style="color:var(${GP.GRUPO_VAR[f.grupo]})">${GP.GRUPO_LABEL[f.grupo]}</span></td>
        <td>${tipoLabel[f.tipo]}</td>
        <td>${justCol}</td>
      </tr>`;
    }).join("");
  }

  function businessDaysBetween(fromIso, toIso) {
    let d = new Date(`${fromIso}T00:00:00`); const end = new Date(`${toIso}T00:00:00`); let count = 0;
    while (d <= end) { if (d.getDay() !== 0) count++; d.setDate(d.getDate() + 1); }
    return Math.max(1, count);
  }
  function weeklyBuckets(n, base) {
    const out = []; let fim = new Date(`${base}T00:00:00`);
    for (let i = 0; i < n; i++) {
      const ini = new Date(fim); ini.setDate(ini.getDate() - 6);
      out.unshift([ini.toISOString().slice(0, 10), fim.toISOString().slice(0, 10)]);
      fim = new Date(ini); fim.setDate(fim.getDate() - 1);
    }
    return out;
  }

  render();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(render, 200); });
})();
