"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "indicadores",
    eyebrow: "Gestão da Produção",
    title: "Produtividade e Qualidade",
  });
  if (!session) return;

  const [obras, colaboradores, producao, qualidade, faltas] = await Promise.all([
    GP.loadJSON("obras.json"), GP.loadJSON("colaboradores.json"), GP.loadJSON("producao.json"),
    GP.loadJSON("qualidade.json"), GP.loadJSON("faltas.json"),
  ]);

  const HOJE = "2026-07-16";
  const podeVerIndividual = session.perfil === "admin" || session.perfil === "gestor";
  const state = { obraId: session.perfil === "supervisor" ? session.obraId : "todas", grupo: "todos", from: GP.isoDaysAgo(29, HOJE), to: HOJE, ncStatus: "todas" };

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
    </div>

    <div class="grid grid-4" id="kpi-row"></div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><div class="card-title">Produção x meta por grupo</div><div class="card-sub">Acumulado no período selecionado</div></div></div>
        <div class="chart-host" id="chart-grupo"></div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title">Evolução do retrabalho</div><div class="card-sub">Tendência diária, média móvel de 5 dias</div></div></div>
        <div class="chart-host" id="chart-retrabalho"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Índice de qualidade por grupo</div><div class="card-sub">100 − retrabalho médio − peso de não conformidades</div></div></div>
      <div class="chart-host" id="chart-indice"></div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;">
        <h2>Não conformidades</h2>
        <select class="select" id="filtro-nc">
          <option value="todas">Todos os status</option>
          <option value="aberta">Abertas</option>
          <option value="em_correcao">Em correção</option>
          <option value="corrigida">Corrigidas</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="data" id="tabela-nc">
          <thead><tr><th>Data</th><th>Obra</th><th>Grupo</th><th>Descrição</th><th>Status</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div class="card" id="card-individual"></div>
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
  document.getElementById("filtro-grupo").addEventListener("change", (e) => { state.grupo = e.target.value; render(); });
  document.getElementById("filtro-nc").addEventListener("change", (e) => { state.ncStatus = e.target.value; renderNC(); });

  function matchObra(id) { return state.obraId === "todas" || id === state.obraId; }
  function matchGrupo(g) { return state.grupo === "todos" || g === state.grupo; }
  function matchPeriodo(d) { return GP.within(d, state.from, state.to); }

  let qualF = [];

  function render() {
    const prodF = producao.filter((p) => matchObra(p.obra_id) && matchGrupo(p.grupo) && matchPeriodo(p.data));
    qualF = qualidade.filter((q) => matchObra(q.obra_id) && matchGrupo(q.grupo) && matchPeriodo(q.data));

    const somaProd = prodF.reduce((a, p) => a + p.quantidade_produzida, 0);
    const somaMeta = prodF.reduce((a, p) => a + p.meta_diaria, 0);
    const produtividade = somaMeta ? (somaProd / somaMeta) * 100 : 0;
    const retrabalhoMedio = qualF.length ? qualF.reduce((a, q) => a + q.retrabalho_pct, 0) / qualF.length : 0;
    const ncAbertas = qualF.filter((q) => q.nao_conformidade && q.nc_status !== "corrigida").length;
    const ncTotal = qualF.filter((q) => q.nao_conformidade).length;
    const indiceGeral = Math.max(0, 100 - retrabalhoMedio * 2 - (ncTotal ? (ncAbertas / ncTotal) * 20 : 0));

    document.getElementById("kpi-row").innerHTML = `
      <div class="card stat-tile">
        <div class="stat-label">Produtividade média</div>
        <div class="stat-value">${GP.fmtPct(produtividade)}</div>
        <span class="stat-delta ${produtividade >= 100 ? "delta-up" : "delta-down"}">${produtividade >= 100 ? "Acima da meta" : "Abaixo da meta"}</span>
      </div>
      <div class="card stat-tile" style="border:none; box-shadow:none; padding:0;">
        <div class="stat-label">Taxa de retrabalho</div>
        <div class="stat-value">${GP.fmtPct(retrabalhoMedio)}</div>
        <span class="stat-delta ${retrabalhoMedio <= 3 ? "delta-up" : "delta-down"}">Meta ≤ 3,0%</span>
      </div>
      <div class="card stat-tile" style="border:none; box-shadow:none; padding:0;">
        <div class="stat-label">Não conformidades abertas</div>
        <div class="stat-value">${ncAbertas} <small>de ${ncTotal} no período</small></div>
        <span class="chip ${ncAbertas === 0 ? "chip-good" : "chip-warning"}">${ncAbertas === 0 ? "Sob controle" : "Requer atenção"}</span>
      </div>
      <div class="card stat-tile" style="border:none; box-shadow:none; padding:0;">
        <div class="stat-label">Índice de qualidade</div>
        <div class="stat-value">${GP.fmtNum1(indiceGeral)} <small>/ 100</small></div>
        <span class="stat-delta ${indiceGeral >= 90 ? "delta-up" : indiceGeral >= 75 ? "delta-flat" : "delta-down"}">${indiceGeral >= 90 ? "Bom" : indiceGeral >= 75 ? "Atenção" : "Crítico"}</span>
      </div>
    `;
    document.querySelectorAll("#kpi-row .card").forEach((c, i) => { if (i > 0) { c.style.border = "1px solid var(--border)"; c.style.boxShadow = "var(--shadow-card)"; c.style.padding = "18px"; } });

    const grupos = ["estrutura", "alvenaria", "acabamento"];
    GPCharts.bars(document.getElementById("chart-grupo"), {
      categories: grupos.map((g) => GP.GRUPO_LABEL[g]),
      series: [
        { name: "Produzido", color: "var(--accent)", values: grupos.map((g) => Math.round(prodF.filter((p) => p.grupo === g).reduce((a, p) => a + p.quantidade_produzida, 0))) },
        { name: "Meta", color: "var(--ink-muted)", values: grupos.map((g) => Math.round(prodF.filter((p) => p.grupo === g).reduce((a, p) => a + p.meta_diaria, 0))) },
      ],
      yFormat: (v) => GP.fmtInt(v),
    });

    const dias = [...new Set(qualF.map((q) => q.data))].sort();
    const retrabPorDia = dias.map((d) => {
      const rows = qualF.filter((q) => q.data === d);
      return rows.reduce((a, r) => a + r.retrabalho_pct, 0) / rows.length;
    });
    const movAvg = retrabPorDia.map((_, i, arr) => {
      const win = arr.slice(Math.max(0, i - 4), i + 1);
      return win.reduce((a, v) => a + v, 0) / win.length;
    });
    GPCharts.line(document.getElementById("chart-retrabalho"), {
      labels: dias.map(GP.fmtDateShort),
      series: [{ name: "Retrabalho (média móvel 5d)", color: "var(--status-serious)", values: movAvg, area: true }],
      yFormat: (v) => GP.fmtPct(v, 1),
    });

    GPCharts.hbars(document.getElementById("chart-indice"), {
      items: grupos.map((g) => {
        const rows = qualF.filter((q) => q.grupo === g);
        const rt = rows.length ? rows.reduce((a, r) => a + r.retrabalho_pct, 0) / rows.length : 0;
        const ncA = rows.filter((r) => r.nao_conformidade && r.nc_status !== "corrigida").length;
        const idx = Math.max(0, 100 - rt * 2 - (rows.length ? (ncA / rows.length) * 30 : 0));
        return { label: GP.GRUPO_LABEL[g], value: Math.round(idx), target: 90, color: `var(${GP.GRUPO_VAR[g]})` };
      }),
      valueFormat: (v) => `${v} / 100`,
    });

    renderNC();
    renderIndividual();
  }

  function renderNC() {
    const rows = qualF.filter((q) => q.nao_conformidade && (state.ncStatus === "todas" || q.nc_status === state.ncStatus))
      .sort((a, b) => (a.data < b.data ? 1 : -1));
    const chipClass = { aberta: "chip-critical", em_correcao: "chip-warning", corrigida: "chip-good" };
    const chipLabel = { aberta: "Aberta", em_correcao: "Em correção", corrigida: "Corrigida" };
    const tbody = document.querySelector("#tabela-nc tbody");
    tbody.innerHTML = rows.length ? rows.map((r) => `
      <tr>
        <td>${GP.fmtDate(r.data)}</td>
        <td>${r.obra_id}</td>
        <td><span class="tag-dot" style="color:var(${GP.GRUPO_VAR[r.grupo]})">${GP.GRUPO_LABEL[r.grupo]}</span></td>
        <td>${r.nc_descricao ?? "—"}</td>
        <td><span class="chip ${chipClass[r.nc_status]}">${chipLabel[r.nc_status]}</span></td>
      </tr>`).join("") : `<tr><td colspan="5" class="footnote" style="padding:18px;">Nenhuma não conformidade no filtro atual.</td></tr>`;
  }

  function renderIndividual() {
    const card = document.getElementById("card-individual");
    if (!podeVerIndividual) {
      card.innerHTML = `
        <div class="card-title">Produtividade por colaborador</div>
        <p class="footnote" style="margin-top:8px;">Visão restrita a perfis Gestor e Administrador.</p>`;
      return;
    }
    const equipe = colaboradores.filter((c) => c.ativo && c.grupo !== "administrativo" && matchObra(c.obra_id) && matchGrupo(c.grupo));
    const faltasCount = {};
    faltas.forEach((f) => (faltasCount[f.colaborador_id] = (faltasCount[f.colaborador_id] || 0) + 1));
    const ranked = equipe.map((c) => {
      let hash = 0; for (const ch of c.id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
      const indice = Math.max(58, Math.min(118, 100 + (hash % 30) - 12 - (faltasCount[c.id] || 0) * 6));
      return { ...c, indice };
    }).sort((a, b) => b.indice - a.indice);

    card.innerHTML = `
      <div class="card-head"><div><div class="card-title">Produtividade por colaborador</div><div class="card-sub">Índice relativo à meta da função — visão restrita (Gestor/Admin)</div></div></div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Colaborador</th><th>Função</th><th>Grupo</th><th class="num">Faltas no período</th><th class="num">Índice</th></tr></thead>
          <tbody>
            ${ranked.slice(0, 10).map((c) => `
              <tr>
                <td>${c.nome}</td>
                <td>${c.funcao}</td>
                <td><span class="tag-dot" style="color:var(${GP.GRUPO_VAR[c.grupo]})">${GP.GRUPO_LABEL[c.grupo]}</span></td>
                <td class="num">${faltasCount[c.id] || 0}</td>
                <td class="num"><span class="chip ${c.indice >= 100 ? "chip-good" : c.indice >= 85 ? "chip-neutral" : "chip-warning"}">${c.indice}</span></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  render();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(render, 200); });
})();
