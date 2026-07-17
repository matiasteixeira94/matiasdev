"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "dashboard",
    eyebrow: "Gestão da Produção",
    title: "Visão Geral",
    actionsHtml: `
      <button class="btn" id="btn-export-pdf" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>PDF</button>
      <button class="btn" id="btn-export-xls" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>Excel</button>`,
  });
  if (!session) return;

  const [obras, colaboradores, producao, qualidade, faltas, ocorrencias, epis, treinamentos, obrasReais, pessoalResumo] = await Promise.all([
    GP.loadJSON("obras.json"), GP.loadJSON("colaboradores.json"), GP.loadJSON("producao.json"),
    GP.loadJSON("qualidade.json"), GP.loadJSON("faltas.json"), GP.loadJSON("ocorrencias_seguranca.json"),
    GP.loadJSON("epis_pendentes.json"), GP.loadJSON("treinamentos_pendentes.json"),
    GP.loadJSON("obras_reais.json"), GP.loadJSON("pessoal_resumo.json"),
  ]);
  const totalCasas = obrasReais.reduce((a, o) => a + o.total, 0);
  const totalConcluidas = obrasReais.reduce((a, o) => a + o.concluida, 0);

  const HOJE = "2026-07-16";
  const state = { periodo: 30, obraId: session.perfil === "supervisor" ? session.obraId : "todas", grupo: "todos", from: GP.isoDaysAgo(29, HOJE), to: HOJE };

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <div class="card">
      <div class="section-head" style="margin-bottom:4px;">
        <h2>Obras</h2>
        <span class="chip chip-neutral">Dados reais — Viana &amp; Moura, UGB Caruaru</span>
      </div>
      <p class="footnote" style="margin-bottom:14px;">
        Condomínios cadastrados: Laranjeiras, Cerejeiras, Oliveiras e Amoreiras.
      </p>
      <div class="grid grid-4" style="margin-bottom:16px;">
        <div class="stat-tile">
          <div class="stat-label">Obras cadastradas</div>
          <div class="stat-value">${obrasReais.length}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Total de casas</div>
          <div class="stat-value">${GP.fmtInt(totalCasas)}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Casas concluídas</div>
          <div class="stat-value">${GP.fmtInt(totalConcluidas)}</div>
          <span class="footnote">${GP.fmtPct((totalConcluidas / totalCasas) * 100, 0)} do total</span>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Colaboradores ativos</div>
          <div class="stat-value">${GP.fmtInt(pessoalResumo.ativos)} <small>de ${GP.fmtInt(pessoalResumo.total)}</small></div>
          <span class="footnote">${GP.fmtInt(pessoalResumo.direto)} mão de obra direta · ${GP.fmtInt(pessoalResumo.indireto)} indireta</span>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${obrasReais.map((o) => `
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
              <span style="font-weight:600;">${o.empreendimento}</span>
              <span class="footnote mono">${GP.fmtInt(o.concluida)} / ${GP.fmtInt(o.total)} casas · ${o.pct_concluido}%</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${o.pct_concluido}%;"></div></div>
          </div>`).join("")}
      </div>
      <a class="btn btn-ghost" style="margin-top:14px;" href="casas.html">Ver casa a casa →</a>
    </div>

    <p class="footnote" style="margin: -8px 0 0;">
      Os indicadores abaixo (produtividade, absenteísmo, saúde e segurança) usam dados de
      demonstração fictícios.
    </p>

    <div class="filter-bar">
      <div class="field">
        <label>Período</label>
        <div class="seg" id="seg-periodo">
          <button data-v="7">7 dias</button>
          <button data-v="30" aria-pressed="true">30 dias</button>
          <button data-v="90">90 dias</button>
          <button data-v="custom">Personalizado</button>
        </div>
      </div>
      <div class="field" id="custom-range" style="display:none; flex-direction:row; gap:6px; align-items:flex-end;">
        <div class="field"><label>De</label><input class="input" type="date" id="date-from"></div>
        <div class="field"><label>Até</label><input class="input" type="date" id="date-to"></div>
      </div>
      <div class="field">
        <label>Obra</label>
        <select class="select" id="filtro-obra"></select>
      </div>
      <div class="field">
        <label>Grupo</label>
        <select class="select" id="filtro-grupo">
          <option value="todos">Todos os grupos</option>
          <option value="estrutura">Estrutura</option>
          <option value="alvenaria">Alvenaria</option>
          <option value="acabamento">Acabamento</option>
          <option value="administrativo">Administrativo</option>
        </select>
      </div>
    </div>

    <div class="grid grid-auto" id="kpi-row"></div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><div class="card-title">Produção diária x meta</div><div class="card-sub">Soma das obras/grupos filtrados</div></div></div>
        <div class="chart-host" id="chart-producao"></div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title">Produtividade por obra</div><div class="card-sub">% da meta atingida no período</div></div></div>
        <div class="chart-host" id="chart-obras"></div>
      </div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;">
        <h2>Obras</h2><span class="footnote">Orçamento previsto x realizado</span>
      </div>
      <div class="table-wrap">
        <table class="data" id="tabela-obras">
          <thead><tr><th>Obra</th><th>Local</th><th>Engenheiro / Encarregado</th><th>Status</th><th class="num">Avanço orçamentário</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-3">
      <div class="card">
        <div class="card-title">Pendências de justificativa</div>
        <div class="card-sub">Faltas sem motivo registrado</div>
        <div class="stat-value" style="margin-top:10px;" id="kpi-pend-falta">–</div>
        <a class="btn btn-ghost" style="margin-top:10px;" href="faltas.html">Ver faltas →</a>
      </div>
      <div class="card">
        <div class="card-title">EPIs vencidos ou faltando</div>
        <div class="card-sub">Itens pendentes de reposição</div>
        <div class="stat-value" style="margin-top:10px;" id="kpi-epi">–</div>
        <a class="btn btn-ghost" style="margin-top:10px;" href="seguranca.html">Ver segurança →</a>
      </div>
      <div class="card">
        <div class="card-title">Treinamentos pendentes</div>
        <div class="card-sub">NRs a vencer ou vencidas</div>
        <div class="stat-value" style="margin-top:10px;" id="kpi-treino">–</div>
        <a class="btn btn-ghost" style="margin-top:10px;" href="seguranca.html">Ver segurança →</a>
      </div>
    </div>
  `;

  // ---- obra select ----
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
    const v = btn.dataset.v;
    document.getElementById("custom-range").style.display = v === "custom" ? "flex" : "none";
    if (v !== "custom") { state.periodo = Number(v); state.from = GP.isoDaysAgo(Number(v) - 1, HOJE); state.to = HOJE; render(); }
  });
  document.getElementById("date-from").addEventListener("change", (e) => { state.from = e.target.value; render(); });
  document.getElementById("date-to").addEventListener("change", (e) => { state.to = e.target.value; render(); });
  obraSelect.addEventListener("change", (e) => { state.obraId = e.target.value; render(); });
  document.getElementById("filtro-grupo").addEventListener("change", (e) => { state.grupo = e.target.value; render(); });
  document.getElementById("btn-export-pdf").addEventListener("click", () => window.print());
  document.getElementById("btn-export-xls").addEventListener("click", () => alert("Exportação para Excel: integra com o endpoint /relatorios/exportar?formato=xlsx (ver docs/estrutura-banco-dados.md)."));

  function matchObra(id) { return state.obraId === "todas" || id === state.obraId; }
  function matchGrupo(g) { return state.grupo === "todos" || g === state.grupo; }
  function matchPeriodo(d) { return GP.within(d, state.from, state.to); }

  function render() {
    const prodF = producao.filter((p) => matchObra(p.obra_id) && matchGrupo(p.grupo) && matchPeriodo(p.data));
    const qualF = qualidade.filter((q) => matchObra(q.obra_id) && matchGrupo(q.grupo) && matchPeriodo(q.data));
    const faltasF = faltas.filter((f) => matchObra(f.obra_id) && matchGrupo(f.grupo) && matchPeriodo(f.data));
    const ocF = ocorrencias.filter((o) => matchObra(o.obra_id) && matchGrupo(o.grupo) && matchPeriodo(o.data));

    const colabAtivos = colaboradores.filter((c) => c.ativo && matchObra(c.obra_id) && matchGrupo(c.grupo));
    const obrasAtivas = obras.filter((o) => o.status === "em_execucao" && (state.obraId === "todas" || o.id === state.obraId));

    // ---- KPIs ----
    const somaProd = prodF.reduce((a, p) => a + p.quantidade_produzida, 0);
    const somaMeta = prodF.reduce((a, p) => a + p.meta_diaria, 0);
    const produtividade = somaMeta ? (somaProd / somaMeta) * 100 : 0;

    const diasUteisPeriodo = new Set(prodF.map((p) => p.data)).size || 1;
    const colabElegiveis = colaboradores.filter((c) => c.ativo && c.grupo !== "administrativo" && matchObra(c.obra_id) && matchGrupo(c.grupo));
    const pessoasDia = colabElegiveis.length * diasUteisPeriodo;
    const taxaAbsenteismo = pessoasDia ? (faltasF.length / pessoasDia) * 100 : 0;

    const porGrupo = { estrutura: 0, alvenaria: 0, acabamento: 0, administrativo: 0 };
    colabAtivos.forEach((c) => (porGrupo[c.grupo] = (porGrupo[c.grupo] || 0) + 1));

    const graves = ocF.filter((o) => o.tipo === "acidente_grave").length;
    const leves = ocF.filter((o) => o.tipo === "acidente_leve").length;
    const quase = ocF.filter((o) => o.tipo === "quase_acidente").length;

    const kpiRow = document.getElementById("kpi-row");
    kpiRow.innerHTML = `
      <div class="card stat-tile">
        <div class="stat-label">Obras ativas</div>
        <div class="stat-value">${obrasAtivas.length} <small>de ${obras.length} cadastradas</small></div>
        <div class="legend" style="margin-top:2px;">${obrasAtivas.slice(0, 4).map((o) => `<span class="chip chip-good">${o.id}</span>`).join("")}</div>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Colaboradores ativos</div>
        <div class="stat-value">${GP.fmtInt(colabAtivos.length)} <small>no filtro atual</small></div>
        <div class="legend">
          ${Object.entries(porGrupo).filter(([,v]) => v > 0).map(([g, v]) => `<span class="tag-dot" style="color:var(${GP.GRUPO_VAR[g]})">${GP.GRUPO_LABEL[g]} · ${v}</span>`).join("")}
        </div>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Produtividade média</div>
        <div class="stat-value">${GP.fmtPct(produtividade)}</div>
        <span class="stat-delta ${produtividade >= 100 ? "delta-up" : produtividade >= 90 ? "delta-flat" : "delta-down"}">${produtividade >= 100 ? "Acima da meta" : "Abaixo da meta"}</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Taxa de absenteísmo</div>
        <div class="stat-value">${GP.fmtPct(taxaAbsenteismo)}</div>
        <span class="stat-delta ${taxaAbsenteismo <= 3 ? "delta-up" : taxaAbsenteismo <= 6 ? "delta-flat" : "delta-down"}">${faltasF.length} ocorrências no período</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Ocorrências de S&amp;S</div>
        <div class="stat-value">${ocF.length}</div>
        <div class="legend">
          <span class="chip chip-warning">${quase} quase-acidente</span>
          <span class="chip chip-serious">${leves} leve</span>
          <span class="chip chip-critical">${graves} grave</span>
        </div>
      </div>
    `;

    // ---- gráfico produção diária ----
    const diasOrdenados = [...new Set(prodF.map((p) => p.data))].sort();
    const prodPorDia = diasOrdenados.map((d) => prodF.filter((p) => p.data === d).reduce((a, p) => a + p.quantidade_produzida, 0));
    const metaPorDia = diasOrdenados.map((d) => prodF.filter((p) => p.data === d).reduce((a, p) => a + p.meta_diaria, 0));
    GPCharts.line(document.getElementById("chart-producao"), {
      labels: diasOrdenados.map(GP.fmtDateShort),
      series: [
        { name: "Produzido", color: "var(--accent)", values: prodPorDia, area: true },
        { name: "Meta", color: "var(--ink-muted)", values: metaPorDia, dashed: true },
      ],
      yFormat: (v) => GP.fmtInt(v),
    });

    // ---- gráfico produtividade por obra ----
    const obrasParaGrafico = state.obraId === "todas" ? obras.filter((o) => o.status === "em_execucao") : obras.filter((o) => o.id === state.obraId);
    GPCharts.hbars(document.getElementById("chart-obras"), {
      items: obrasParaGrafico.map((o) => {
        const p = producao.filter((x) => x.obra_id === o.id && matchGrupo(x.grupo) && matchPeriodo(x.data));
        const prod = p.reduce((a, x) => a + x.quantidade_produzida, 0);
        const meta = p.reduce((a, x) => a + x.meta_diaria, 0);
        return { label: o.nome, value: Math.round(meta ? (prod / meta) * 100 : 0), target: 100, color: "var(--accent)" };
      }),
      valueFormat: (v) => `${v}%`,
    });

    // ---- tabela de obras ----
    const tbody = document.querySelector("#tabela-obras tbody");
    tbody.innerHTML = (state.obraId === "todas" ? obras : obras.filter((o) => o.id === state.obraId)).map((o) => {
      const pctOrcamento = Math.round((o.orcamento_realizado / o.orcamento_previsto) * 100);
      return `<tr>
        <td><strong>${o.nome}</strong><br><span class="footnote id-tag">${o.id}</span></td>
        <td>${o.cidade}/${o.uf}</td>
        <td>${o.engenheiro}<br><span class="footnote">${o.encarregado}</span></td>
        <td>${o.status === "em_execucao" ? '<span class="chip chip-good">Em execução</span>' : '<span class="chip chip-neutral">Concluída</span>'}</td>
        <td class="num">
          <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end;">
            <span class="mono">${GP.fmtBRL(o.orcamento_realizado)} / ${GP.fmtBRL(o.orcamento_previsto)}</span>
            <div class="bar-track" style="width:70px;"><div class="bar-fill" style="width:${Math.min(100, pctOrcamento)}%; ${pctOrcamento > 100 ? "background:var(--status-critical);" : ""}"></div></div>
          </div>
        </td>
      </tr>`;
    }).join("");

    // ---- pendências ----
    const pendFalta = faltas.filter((f) => matchObra(f.obra_id) && f.motivo === null).length;
    const epiF = epis.filter((e) => matchObra(e.obra_id)).length;
    const treinoF = treinamentos.filter((t) => matchObra(t.obra_id)).length;
    document.getElementById("kpi-pend-falta").textContent = pendFalta;
    document.getElementById("kpi-epi").textContent = epiF;
    document.getElementById("kpi-treino").textContent = treinoF;
  }

  render();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(render, 200); });
})();
