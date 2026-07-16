"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "seguranca",
    eyebrow: "Gestão da Produção",
    title: "Saúde e Segurança",
    actionsHtml: `<button class="btn btn-primary" id="btn-nova-ocorrencia" type="button">+ Registrar ocorrência</button>`,
  });
  if (!session) return;

  const [obras, colaboradores, producao, ocorrencias, epis, treinamentos, inspecoes] = await Promise.all([
    GP.loadJSON("obras.json"), GP.loadJSON("colaboradores.json"), GP.loadJSON("producao.json"),
    GP.loadJSON("ocorrencias_seguranca.json"), GP.loadJSON("epis_pendentes.json"),
    GP.loadJSON("treinamentos_pendentes.json"), GP.loadJSON("inspecoes.json"),
  ]);
  const colabById = Object.fromEntries(colaboradores.map((c) => [c.id, c]));
  const obraById = Object.fromEntries(obras.map((o) => [o.id, o]));

  const HOJE = "2026-07-16";
  const state = { obraId: session.perfil === "supervisor" ? session.obraId : "todas", tipo: "todos", from: GP.isoDaysAgo(29, HOJE), to: HOJE };

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
        <label>Tipo</label>
        <select class="select" id="filtro-tipo">
          <option value="todos">Todos os tipos</option>
          <option value="quase_acidente">Quase-acidente</option>
          <option value="acidente_leve">Acidente leve</option>
          <option value="acidente_grave">Acidente grave</option>
        </select>
      </div>
    </div>

    <div class="grid grid-4" id="kpi-row"></div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><div class="card-title">Ocorrências por semana</div><div class="card-sub">Por categoria, últimas semanas do período</div></div></div>
        <div class="chart-host" id="chart-tempo"></div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title">Ocorrências por obra</div><div class="card-sub">Total no período selecionado</div></div></div>
        <div class="chart-host" id="chart-obra"></div>
      </div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;"><h2>Registro de ocorrências</h2><span class="footnote" id="contador-oc"></span></div>
      <div class="table-wrap">
        <table class="data" id="tabela-oc">
          <thead><tr><th>ID</th><th>Data</th><th>Obra</th><th>Colaborador</th><th>Tipo</th><th>Descrição</th><th>Ação tomada</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div><div class="card-title">EPIs vencidos ou faltando</div></div></div>
        <div class="table-wrap">
          <table class="data" id="tabela-epi">
            <thead><tr><th>Colaborador</th><th>Item</th><th>Situação</th><th>Vencimento</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title">Treinamentos pendentes</div></div></div>
        <div class="table-wrap">
          <table class="data" id="tabela-treino">
            <thead><tr><th>Colaborador</th><th>Treinamento</th><th>Prazo</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Relatórios de inspeção</div><div class="card-sub">Checklist de segurança do canteiro</div></div></div>
      <div class="table-wrap">
        <table class="data" id="tabela-inspecao">
          <thead><tr><th>Data</th><th>Obra</th><th>Responsável</th><th class="num">Itens verificados</th><th class="num">Não conformes</th><th>Status</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-nova-ocorrencia").addEventListener("click", () => {
    alert("Formulário de registro: data, obra, colaborador, tipo, descrição e ação tomada — grava em POST /ocorrencias-seguranca (ver docs/estrutura-banco-dados.md).");
  });

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
  document.getElementById("filtro-tipo").addEventListener("change", (e) => { state.tipo = e.target.value; render(); });

  function matchObra(id) { return state.obraId === "todas" || id === state.obraId; }
  function matchPeriodo(d) { return GP.within(d, state.from, state.to); }
  function matchTipo(t) { return state.tipo === "todos" || t === state.tipo; }

  const TIPO_LABEL = { quase_acidente: "Quase-acidente", acidente_leve: "Acidente leve", acidente_grave: "Acidente grave" };
  const TIPO_CHIP = { quase_acidente: "chip-warning", acidente_leve: "chip-serious", acidente_grave: "chip-critical" };

  function render() {
    const ocF = ocorrencias.filter((o) => matchObra(o.obra_id) && matchPeriodo(o.data) && matchTipo(o.tipo));
    const horasPeriodo = producao.filter((p) => matchObra(p.obra_id) && matchPeriodo(p.data)).reduce((a, p) => a + p.horas_trabalhadas, 0);
    const acidentes = ocorrencias.filter((o) => matchObra(o.obra_id) && matchPeriodo(o.data) && o.tipo !== "quase_acidente").length;
    const indiceFrequencia = horasPeriodo ? (acidentes * 1000000) / horasPeriodo : 0;

    const ultimoGrave = ocorrencias.filter((o) => matchObra(o.obra_id) && o.tipo === "acidente_grave").sort((a, b) => (a.data < b.data ? 1 : -1))[0];
    const diasSemGrave = ultimoGrave ? Math.round((new Date(HOJE) - new Date(ultimoGrave.data)) / 86400000) : "—";

    const episF = epis.filter((e) => matchObra(e.obra_id));
    const treinosF = treinamentos.filter((t) => matchObra(t.obra_id));

    document.getElementById("kpi-row").innerHTML = `
      <div class="card stat-tile">
        <div class="stat-label">Índice de frequência</div>
        <div class="stat-value">${GP.fmtNum1(indiceFrequencia)}</div>
        <span class="footnote">acidentes por milhão de horas-homem</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Dias sem acidente grave</div>
        <div class="stat-value">${diasSemGrave}</div>
        <span class="chip ${typeof diasSemGrave === "number" && diasSemGrave >= 30 ? "chip-good" : "chip-warning"}">${typeof diasSemGrave === "number" && diasSemGrave >= 30 ? "Dentro da meta" : "Atenção"}</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">EPIs pendentes</div>
        <div class="stat-value">${episF.length}</div>
        <span class="footnote">vencidos ou faltando</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Treinamentos pendentes</div>
        <div class="stat-value">${treinosF.length}</div>
        <span class="footnote">NRs a vencer ou vencidas</span>
      </div>
    `;

    const semanas = weeklyBuckets(Math.min(13, Math.ceil((new Date(state.to) - new Date(state.from)) / 604800000) + 1), state.to);
    const tiposOrdem = ["quase_acidente", "acidente_leve", "acidente_grave"];
    GPCharts.bars(document.getElementById("chart-tempo"), {
      categories: semanas.map(([, fim]) => GP.fmtDateShort(fim)),
      series: tiposOrdem.map((t) => ({
        name: TIPO_LABEL[t],
        color: t === "quase_acidente" ? "var(--status-warning)" : t === "acidente_leve" ? "var(--status-serious)" : "var(--status-critical)",
        values: semanas.map(([ini, fim]) => ocorrencias.filter((o) => matchObra(o.obra_id) && o.tipo === t && GP.within(o.data, ini, fim)).length),
      })),
      yFormat: (v) => GP.fmtInt(v),
    });

    const obrasParaGrafico = state.obraId === "todas" ? obras.filter((o) => o.status === "em_execucao") : obras.filter((o) => o.id === state.obraId);
    GPCharts.hbars(document.getElementById("chart-obra"), {
      items: obrasParaGrafico.map((o) => ({
        label: o.nome,
        value: ocorrencias.filter((x) => x.obra_id === o.id && matchPeriodo(x.data) && matchTipo(x.tipo)).length,
        color: "var(--accent)",
      })),
      valueFormat: (v) => v, showTarget: false,
    });

    document.getElementById("contador-oc").textContent = `${ocF.length} registro(s)`;
    document.querySelector("#tabela-oc tbody").innerHTML = ocF.sort((a, b) => (a.data < b.data ? 1 : -1)).map((o) => {
      const c = colabById[o.colaborador_id];
      return `<tr>
        <td class="mono footnote">${o.id}</td>
        <td>${GP.fmtDate(o.data)}</td>
        <td>${o.obra_id}</td>
        <td>${c ? c.nome : o.colaborador_id}</td>
        <td><span class="chip ${TIPO_CHIP[o.tipo]}">${TIPO_LABEL[o.tipo]}</span></td>
        <td>${o.descricao}</td>
        <td class="footnote">${o.acao_tomada}${o.dias_afastamento ? ` · ${o.dias_afastamento}d de afastamento` : ""}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="7" class="footnote" style="padding:18px;">Nenhuma ocorrência no filtro atual.</td></tr>`;

    document.querySelector("#tabela-epi tbody").innerHTML = episF.map((e) => {
      const c = colabById[e.colaborador_id];
      return `<tr>
        <td>${c ? c.nome : e.colaborador_id}</td>
        <td>${e.item}</td>
        <td><span class="chip ${e.situacao === "vencido" ? "chip-critical" : "chip-warning"}">${e.situacao === "vencido" ? "Vencido" : "Faltando"}</span></td>
        <td>${GP.fmtDate(e.vencimento)}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="4" class="footnote" style="padding:18px;">Nenhuma pendência de EPI.</td></tr>`;

    document.querySelector("#tabela-treino tbody").innerHTML = treinosF.map((t) => {
      const c = colabById[t.colaborador_id];
      const atrasado = t.prazo < HOJE;
      return `<tr>
        <td>${c ? c.nome : t.colaborador_id}</td>
        <td>${t.treinamento}</td>
        <td><span class="chip ${atrasado ? "chip-critical" : "chip-warning"}">${GP.fmtDate(t.prazo)}${atrasado ? " · vencido" : ""}</span></td>
      </tr>`;
    }).join("") || `<tr><td colspan="3" class="footnote" style="padding:18px;">Nenhum treinamento pendente.</td></tr>`;

    const inspecoesF = inspecoes.filter((i) => matchObra(i.obra_id) && matchPeriodo(i.data)).sort((a, b) => (a.data < b.data ? 1 : -1));
    const statusChip = { conforme: "chip-good", conforme_com_ressalvas: "chip-warning", nao_conforme: "chip-critical" };
    const statusLabel = { conforme: "Conforme", conforme_com_ressalvas: "Conforme c/ ressalvas", nao_conforme: "Não conforme" };
    document.querySelector("#tabela-inspecao tbody").innerHTML = inspecoesF.map((i) => `
      <tr>
        <td>${GP.fmtDate(i.data)}</td>
        <td>${i.obra_id}</td>
        <td>${i.responsavel}</td>
        <td class="num">${i.itens_verificados}</td>
        <td class="num">${i.itens_nao_conformes}</td>
        <td><span class="chip ${statusChip[i.status]}">${statusLabel[i.status]}</span></td>
      </tr>`).join("") || `<tr><td colspan="6" class="footnote" style="padding:18px;">Nenhuma inspeção registrada no período.</td></tr>`;
  }

  function weeklyBuckets(n, base) {
    const out = []; let fim = new Date(`${base}T00:00:00`);
    for (let i = 0; i < Math.max(1, n); i++) {
      const ini = new Date(fim); ini.setDate(ini.getDate() - 6);
      out.unshift([ini.toISOString().slice(0, 10), fim.toISOString().slice(0, 10)]);
      fim = new Date(ini); fim.setDate(fim.getDate() - 1);
    }
    return out;
  }

  render();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(render, 200); });
})();
