"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "pessoal",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Quadro de Pessoal",
  });
  if (!session) return;

  const [ativos, resumo, quadroMensal, desligamentos] = await Promise.all([
    GP.loadJSON("pessoal_ativos.json"), GP.loadJSON("pessoal_resumo.json"), GP.loadJSON("quadro_pessoal_mensal.json"), GP.loadJSON("desligamentos.json"),
  ]);

  const ptCompare = (a, b) => a.localeCompare(b, "pt-BR");
  const funcoes = [...new Set(ativos.map((a) => a.funcao).filter(Boolean))].sort(ptCompare);
  const tipos = [...new Set(ativos.map((a) => a.tipo).filter(Boolean))].sort(ptCompare);

  const FRENTES = ["Acabamento", "Assistência Técnica", "Produção", "Aprendiz", "Muro"];

  // Setor/frente de cada função — o Quadro Geral não tem essa coluna, então
  // a função de cada colaborador é o jeito de ligar a lista de ativos às
  // frentes do Boletim mensal. "Muro" não dá pra distinguir por aqui: as
  // equipes de muro usam os mesmos nomes de função da produção de casas
  // (Pedreiro, Servente...), sem nenhuma marcação própria na planilha.
  const FUNCAO_PARA_FRENTE = {
    "ELETRICISTA": "Acabamento",
    "MARCENEIRO": "Acabamento",
    "OPERADOR DE PRODUÇÃO": "Acabamento", // "Operador de Produção / Pintor" no Boletim, dentro de Acabamento
    "SUPERVISOR DE ACABAMENTO": "Acabamento",
    "SUPERVISOR LIDER DE ACABAMENTO E ASSIST TECNICA": "Acabamento",
    "OPERADOR DE ASSISTENCIA TÉCNICA": "Assistência Técnica",
    "SERVENTE DE ASSISTÊNCIA TÉCNICA": "Assistência Técnica",
    "OPERADOR LÍDER DE ASSISTENCIA TÉCNICA": "Assistência Técnica",
    "SUPERVISOR(A) DE ASSISTENCIA TECNICA": "Assistência Técnica",
    "SERVENTE DE PRODUÇÃO": "Produção",
    "SERVENTE POLIVALENTE DE PRODUÇÃO": "Produção",
    "PEDREIRO DE PRODUÇÃO": "Produção",
    "PEDREIRO LIDER DE PRODUÇÃO": "Produção",
    "SUPERVISOR(A) DE PRODUÇÃO": "Produção",
    "SUPERVISOR(A) DE PRODUÇÃO LIDER": "Produção",
    "APRENDIZ ASSISTENTE DE GERENCIAMENTO DE OBRAS": "Aprendiz",
  };

  const state = { funcao: "todos", tipo: "todos", busca: "", frente: "todos" };

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
      <div class="section-head" style="margin-bottom:14px;">
        <h2>Organograma — Produção CA</h2>
        <span class="footnote">245 pessoas · julho de 2026</span>
      </div>
      <div style="overflow-x:auto; border-radius:12px; border:1px solid var(--border);">
        <img src="assets/images/organograma-producao.jpg" alt="Organograma da Produção CA — julho de 2026" style="display:block; width:100%; min-width:1100px;" />
      </div>
      <p class="footnote" style="margin-top:8px;">Clique com o botão direito e abra a imagem em uma nova aba para ampliar.</p>
    </div>

    <div class="card">
      <div class="card-head">
        <div><div class="card-title">Quadro planejado x realizado</div><div class="card-sub">Nº de colaboradores por mês — desvio = realizado − planejado</div></div>
        <select class="select" id="filtro-frente">
          <option value="todos">Todas as frentes</option>
          ${FRENTES.map((f) => `<option value="${f}">${f}</option>`).join("")}
        </select>
      </div>
      <div class="chart-host" id="chart-pessoal"></div>
      <div class="table-wrap" style="margin-top:16px;">
        <table class="data">
          <thead><tr><th>Mês</th><th class="num">Planejado</th><th class="num">Realizado</th><th class="num">Desvio</th></tr></thead>
          <tbody id="tabela-quadro-mensal"></tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Desligamentos</div><div class="card-sub">${desligamentos.total_registros} registros no levantamento (${desligamentos.periodo})</div></div></div>
      <div class="grid grid-2">
        <div>
          <div class="card-sub" style="margin-bottom:8px;">Evolução mensal <span class="footnote">— clique num mês para ver por função</span></div>
          <div class="chart-host" id="chart-desligamentos-mes"></div>
          <div id="detalhe-mes-desligamento" class="footnote" style="margin-top:10px;">Clique num mês no gráfico para ver o detalhe por função.</div>
        </div>
        <div>
          <div class="card-sub" style="margin-bottom:8px;">Por função</div>
          <div class="chart-host" id="chart-desligamentos-funcao"></div>
        </div>
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

  function renderQuadro() {
    const meses = state.frente === "todos" ? quadroMensal.meses : quadroMensal.frentes[state.frente].meses;

    GPCharts.bars(document.getElementById("chart-pessoal"), {
      categories: meses.map((m) => m.label.replace("/2026", "")),
      series: [
        { name: "Planejado", color: "var(--border-strong)", values: meses.map((m) => m.planejado) },
        { name: "Realizado", color: "var(--accent)", values: meses.map((m) => m.realizado) },
      ],
      yFormat: (v) => GP.fmtInt(v),
    });

    // Nesta tela o sinal é invertido: realizado acima do planejado significa
    // mais gente do que o previsto, ou seja, mais gasto com pessoal — por
    // isso positivo é vermelho (ruim) e negativo/zero é verde (bom) aqui,
    // ao contrário do padrão usado nas outras telas de meta.
    document.getElementById("tabela-quadro-mensal").innerHTML = meses.map((m) => {
      const desvio = m.realizado - m.planejado;
      const ruim = desvio > 0;
      const seta = ruim
        ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--status-critical)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`
        : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--status-good)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`;
      return `<tr>
        <td>${m.label}</td>
        <td class="num">${GP.fmtInt(m.planejado)}</td>
        <td class="num">${GP.fmtInt(m.realizado)}</td>
        <td class="num"><span class="chip ${ruim ? "chip-warning" : "chip-good"}">${seta} ${desvio > 0 ? "+" : ""}${GP.fmtInt(desvio)}</span></td>
      </tr>`;
    }).join("");
  }

  function renderDesligamentos() {
    // Preenche os meses sem nenhum desligamento (0), pra evolução não pular
    // mês, entre o primeiro e o último mês do levantamento.
    const meses = Object.keys(desligamentos.por_mes).sort();
    const [anoIni, mesIni] = meses[0].split("-").map(Number);
    const [anoFim, mesFim] = meses[meses.length - 1].split("-").map(Number);
    const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const serieMensal = [];
    for (let a = anoIni, m = mesIni; a < anoFim || (a === anoFim && m <= mesFim); m++) {
      if (m > 12) { m = 1; a++; }
      const chave = `${a}-${String(m).padStart(2, "0")}`;
      serieMensal.push({ label: `${MESES_ABREV[m - 1]}/${String(a).slice(2)}`, value: desligamentos.por_mes[chave] || 0, mes: chave });
    }
    GPCharts.barsLine(document.getElementById("chart-desligamentos-mes"), {
      items: serieMensal,
      yFormat: (v) => GP.fmtInt(v),
      tooltipLabel: "Desligamentos",
      onClick: (it) => {
        const detalhe = desligamentos.por_mes_funcao[it.mes] || {};
        const entradas = Object.entries(detalhe);
        const host = document.getElementById("detalhe-mes-desligamento");
        host.innerHTML = entradas.length
          ? `<div style="margin-bottom:6px;"><strong>${it.label}</strong> — ${it.value} desligamento(s):</div>
             <div style="display:flex; flex-wrap:wrap; gap:6px;">${entradas.map(([f, v]) => `<span class="chip chip-neutral">${f} — ${v}</span>`).join("")}</div>`
          : `Nenhum desligamento em ${it.label}.`;
      },
      legendLabel: "Desligamentos por mês",
    });

    const porFuncao = Object.entries(desligamentos.por_funcao).sort((a, b) => b[1] - a[1]);
    const TOP = 8;
    const principais = porFuncao.slice(0, TOP);
    const outras = porFuncao.slice(TOP).reduce((a, [, v]) => a + v, 0);
    const itensFuncao = principais.map(([label, value]) => ({ label, value, color: "var(--status-serious)" }));
    if (outras > 0) itensFuncao.push({ label: "Outras funções", value: outras, color: "var(--border-strong)" });
    GPCharts.hbars(document.getElementById("chart-desligamentos-funcao"), {
      items: itensFuncao,
      valueFormat: (v) => GP.fmtInt(v),
      showTarget: false,
    });
  }

  document.getElementById("filtro-frente").addEventListener("change", (e) => { state.frente = e.target.value; renderQuadro(); render(); });
  renderQuadro();
  renderDesligamentos();

  document.getElementById("filtro-funcao").addEventListener("change", (e) => { state.funcao = e.target.value; render(); });
  document.getElementById("filtro-tipo").addEventListener("change", (e) => { state.tipo = e.target.value; render(); });
  let buscaTimer;
  document.getElementById("filtro-busca").addEventListener("input", (e) => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => { state.busca = e.target.value.trim().toUpperCase(); render(); }, 150);
  });

  function render() {
    const filtrados = ativos.filter((a) =>
      (state.frente === "todos" || FUNCAO_PARA_FRENTE[a.funcao] === state.frente) &&
      (state.funcao === "todos" || a.funcao === state.funcao) &&
      (state.tipo === "todos" || a.tipo === state.tipo) &&
      (!state.busca || a.nome.toUpperCase().includes(state.busca))
    );
    document.getElementById("contador-pessoal").textContent = state.frente === "Muro"
      ? `${GP.fmtInt(filtrados.length)} colaborador(es) — o Quadro Geral não marca quem trabalha em muro separado de casa, então essa frente não filtra a lista`
      : `${GP.fmtInt(filtrados.length)} colaborador(es)`;
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
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(() => { renderQuadro(); renderDesligamentos(); }, 200); });
})();
