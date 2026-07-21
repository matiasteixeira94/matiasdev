"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "casas",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Casas",
  });
  if (!session) return;

  const [casasBrutas, mapaLotes, obrasReais, metas, metasMensais, liderancas] = await Promise.all([
    GP.loadJSON("casas.json"), GP.loadJSON("mapa_lotes.json"), GP.loadJSON("obras_reais.json"), GP.loadJSON("metas_2026_2.json"), GP.loadJSON("metas_mensais_2026_2.json"), GP.loadJSON("liderancas.json"),
  ]);
  const lotesReais = Object.fromEntries(obrasReais.map((o) => [o.empreendimento, o.total]));

  // Só os 4 condomínios em acompanhamento hoje — planilhas antigas (Xique-xique
  // etc.) e variações de nome do mesmo empreendimento são unificadas/descartadas aqui.
  const NOME_CANONICO = {
    "Rec. Laranjeiras": "Laranjeiras",
    "Rec. Cerejeiras": "Cerejeiras",
    "CONDOMINIO CEREJEIRAS": "Cerejeiras",
    "CONDOMINIO OLIVEIRAS": "Oliveiras",
    "CONDOMINIO AMOREIRAS": "Amoreiras",
  };
  const EMPREENDIMENTOS = ["Laranjeiras", "Cerejeiras", "Oliveiras", "Amoreiras"];

  // Mesma pessoa/equipe grafada de formas diferentes na planilha de origem.
  const SUPERVISOR_CANONICO = {
    "ELIALDERSON DA SILVA (CP)": "ELIANDERSON DA SILVA (CP)",
    "JOSENILDO MILANÊS": "JOSENILDO MILANEZ",
  };
  const EQUIPE_CANONICA = { AGUIA: "ÁGUIA" };

  // Confirmado como 100% entregue, mesmo quando a aba DADOS CASA ainda não
  // tem todas as linhas marcadas como concluídas (a planilha de origem não é
  // a fonte definitiva de conclusão para essas obras) — mesmo critério já
  // usado em gerar_resumo_obras.mjs para obras_reais.json.
  const CONCLUIDO_OVERRIDE = new Set(["Laranjeiras", "Oliveiras"]);

  const casas = casasBrutas
    .map((c) => {
      const empreendimento = NOME_CANONICO[c.empreendimento] || c.empreendimento;
      const concluida = CONCLUIDO_OVERRIDE.has(empreendimento) && c.status !== "concluida";
      return {
        ...c,
        empreendimento,
        ga: EQUIPE_CANONICA[c.ga?.trim()] || c.ga?.trim(),
        supervisor: SUPERVISOR_CANONICO[c.supervisor?.trim()] || c.supervisor?.trim(),
        status: concluida ? "concluida" : c.status,
        macroetapas_concluidas: concluida ? 5 : c.macroetapas_concluidas,
        etapa_atual: concluida ? "entregue" : c.etapa_atual,
      };
    })
    .filter((c) => EMPREENDIMENTOS.includes(c.empreendimento));
  const ptCompare = (a, b) => a.localeCompare(b, "pt-BR");
  const supervisores = [...new Set(casas.map((c) => c.supervisor).filter(Boolean))].sort(ptCompare);
  const equipes = [...new Set(casas.map((c) => c.ga).filter(Boolean))].sort(ptCompare);

  // Número do lote embutido no código da casa (ex.: "RL 127A" -> 127) — é o
  // mesmo número usado para casar cada casa com seu polígono no mapa do
  // empreendimento (ver data/scripts/gerar_mapa_lotes.mjs).
  function numeroLote(casaRow) {
    const m = casaRow.casa.match(/[A-Z]{2}\s*0*([0-9]+)/);
    return m ? Number(m[1]) : null;
  }
  const casaPorLote = {};
  for (const emp of EMPREENDIMENTOS) casaPorLote[emp] = {};
  for (const c of casas) {
    const n = numeroLote(c);
    if (n != null) casaPorLote[c.empreendimento][n] = c;
  }

  // Lotes que existem na planta (mapa_lotes.json) mas ainda não têm nenhuma
  // linha em casas.json (nem em DADOS CASA, nem no cronograma CONTROLE) —
  // isso significa que a casa ainda não foi iniciada de fato. Sem essas
  // linhas sintéticas, "Total de casas" ficaria menor que o real (ex.:
  // Amoreiras: só 215 das 503 casas têm alguma linha de progresso hoje).
  const PREFIXO_POR_EMPREENDIMENTO = { Laranjeiras: "RL", Cerejeiras: "RC", Oliveiras: "RO", Amoreiras: "RA" };
  for (const emp of EMPREENDIMENTOS) {
    const mapa = mapaLotes[emp];
    if (!mapa) continue;
    for (const lote of mapa.lotes) {
      if (casaPorLote[emp][lote.numero] != null) continue;
      const placeholder = {
        empreendimento: emp,
        casa: `${PREFIXO_POR_EMPREENDIMENTO[emp]} ${lote.numero}`,
        ga: null,
        supervisor: null,
        data_inicio: null,
        macroetapas_concluidas: 0,
        status: "nao_iniciada",
        etapa_atual: "radier",
      };
      casas.push(placeholder);
      casaPorLote[emp][lote.numero] = placeholder;
    }
  }

  const ETAPAS_ORDEM = ["radier", "alvenaria", "acab2_coberta", "reboco_int_ext", "acab1"];
  const ETAPA_LABEL = { radier: "Radier", alvenaria: "Alvenaria", acab2_coberta: "Acab.2 + Coberta", reboco_int_ext: "Reboco Int.+Ext.", acab1: "Acab.1", entregue: "Entregue" };
  const STATUS_LABEL = { concluida: "Concluída", em_producao: "Em produção", nao_iniciada: "Não iniciada" };
  const STATUS_CHIP = { concluida: "chip-good", em_producao: "chip-warning", nao_iniciada: "chip-neutral" };

  const state = { empreendimento: "todos", equipe: "todos", supervisor: "todos", status: "todos", busca: "" };

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <p class="footnote" style="margin-top:-6px;">
      Dados extraídos da aba <strong>DADOS CASA</strong> das planilhas de controle de produção
      (2026.1 e 2026.2) — ${GP.fmtInt(casas.length)} casas, ${equipes.length} equipes,
      ${EMPREENDIMENTOS.length} empreendimentos.
    </p>

    <div class="grid grid-3">
      <div class="card stat-tile">
        <div class="stat-label">Meta 2026.2</div>
        <div class="stat-value">${GP.fmtInt(metas.casas.meta)}</div>
        <span class="footnote">casas — julho a dezembro de 2026</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Evolução da Meta</div>
        <div class="stat-value">${GP.fmtInt(metas.casas.realizado)}<small>${GP.fmtPct((metas.casas.realizado / metas.casas.meta) * 100, 0)}</small></div>
        <span class="chip ${metas.casas.realizado > 0 ? "chip-good" : "chip-neutral"}">Realizado no período</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Delta da Meta</div>
        <div class="stat-value">${GP.fmtInt(metas.casas.meta - metas.casas.realizado)}</div>
        <span class="chip chip-warning">Faltam para a meta</span>
      </div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;">
        <h2>Líderes de Produção</h2>
        <span class="footnote">Meta de casas 2026.2 por liderança · clique na foto para ver os supervisores</span>
      </div>
      <div class="grid grid-3" id="lideres-row"></div>
      <div id="lider-detalhe"></div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Meta mensal — 2026.2</div><div class="card-sub">Meta (planejado/projetado) x realizado por mês — desvio = realizado − meta</div></div></div>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr><th>Mês</th><th class="num">Meta</th><th class="num">Realizado</th><th class="num">Desvio</th></tr>
          </thead>
          <tbody>
            ${metasMensais.meses.map((m) => {
              const desvio = m.casas.realizado - m.casas.meta;
              return `<tr>
                <td>${m.label}</td>
                <td class="num">${GP.fmtInt(m.casas.meta)}</td>
                <td class="num">${GP.fmtInt(m.casas.realizado)}</td>
                <td class="num"><span class="chip ${desvio >= 0 ? "chip-good" : "chip-warning"}">${desvio > 0 ? "+" : ""}${GP.fmtInt(desvio)}</span></td>
              </tr>`;
            }).join("")}
            <tr style="font-weight:700;">
              <td>Total 2026.2</td>
              <td class="num">${GP.fmtInt(metas.casas.meta)}</td>
              <td class="num">${GP.fmtInt(metas.casas.realizado)}</td>
              <td class="num">${GP.fmtInt(metas.casas.realizado - metas.casas.meta)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="filter-bar">
      <div class="field">
        <label>Empreendimento</label>
        <select class="select" id="filtro-emp">
          <option value="todos">Todos</option>
          ${EMPREENDIMENTOS.map((e) => `<option value="${e}">${e}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>GA - Equipe</label>
        <select class="select" id="filtro-equipe">
          <option value="todos">Todas</option>
          ${equipes.map((g) => `<option value="${g}">${g}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Supervisor</label>
        <select class="select" id="filtro-supervisor">
          <option value="todos">Todos</option>
          ${supervisores.map((s) => `<option value="${s}">${s}</option>`).join("")}
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

    <div class="card" id="card-mapa">
      <div class="card-head"><div><div class="card-title">Mapa do empreendimento</div><div class="card-sub" id="mapa-sub">Implantação real — clique num lote para localizá-lo na tabela</div></div></div>
      <div id="mapa-host"></div>
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

  // Ao trocar o empreendimento, os filtros de GA-Equipe e Supervisor só
  // mostram quem de fato trabalhou nele — evita listar equipes/supervisores
  // de outras obras que nunca vão dar resultado.
  function atualizarFiltrosDependentes() {
    const doEmpreendimento = state.empreendimento === "todos" ? casas : casas.filter((c) => c.empreendimento === state.empreendimento);
    const equipesDisponiveis = [...new Set(doEmpreendimento.map((c) => c.ga).filter(Boolean))].sort(ptCompare);
    const supervisoresDisponiveis = [...new Set(doEmpreendimento.map((c) => c.supervisor).filter(Boolean))].sort(ptCompare);

    if (!equipesDisponiveis.includes(state.equipe)) state.equipe = "todos";
    if (!supervisoresDisponiveis.includes(state.supervisor)) state.supervisor = "todos";

    document.getElementById("filtro-equipe").innerHTML = `<option value="todos">Todas</option>${equipesDisponiveis.map((g) => `<option value="${g}">${g}</option>`).join("")}`;
    document.getElementById("filtro-supervisor").innerHTML = `<option value="todos">Todos</option>${supervisoresDisponiveis.map((s) => `<option value="${s}">${s}</option>`).join("")}`;
    document.getElementById("filtro-equipe").value = state.equipe;
    document.getElementById("filtro-supervisor").value = state.supervisor;
  }

  document.getElementById("filtro-emp").addEventListener("change", (e) => { state.empreendimento = e.target.value; atualizarFiltrosDependentes(); render(); });
  document.getElementById("filtro-equipe").addEventListener("change", (e) => { state.equipe = e.target.value; render(); });
  document.getElementById("filtro-supervisor").addEventListener("change", (e) => { state.supervisor = e.target.value; render(); });
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

  const STATUS_COR = { concluida: "var(--status-good)", em_producao: "var(--gold)", nao_iniciada: "var(--border-strong)" };

  function renderMapa(filtradas) {
    const sub = document.getElementById("mapa-sub");
    const host = document.getElementById("mapa-host");
    if (state.empreendimento === "todos") {
      sub.textContent = "Escolha um empreendimento no filtro acima para ver a implantação real";
      host.innerHTML = `<p class="footnote" style="padding:24px 0; text-align:center;">Selecione um empreendimento.</p>`;
      return;
    }
    const mapa = mapaLotes[state.empreendimento];
    if (!mapa) { host.innerHTML = ""; return; }
    sub.textContent = "Implantação real — clique num lote para localizá-lo na tabela";

    const idsNoFiltro = new Set(filtradas.map((c) => c.casa));
    const lotesSvg = mapa.lotes.map((lote) => {
      const c = casaPorLote[state.empreendimento][lote.numero];
      const status = c ? c.status : "nao_iniciada";
      const noFiltro = c ? idsNoFiltro.has(c.casa) : (state.equipe === "todos" && state.supervisor === "todos" && state.status === "todos" && !state.busca);
      const cor = STATUS_COR[status];
      const titulo = !c ? `Lote ${lote.numero} — sem dados de produção`
        : c.ga ? `Lote ${lote.numero} — ${c.casa}\n${STATUS_LABEL[c.status]}\nEquipe: ${c.ga} · Supervisor: ${c.supervisor || "—"}`
        : `Lote ${lote.numero} — ${c.casa}\n${STATUS_LABEL[c.status]} · ainda sem equipe atribuída`;
      return `<path d="${lote.d}" fill="${cor}" stroke="var(--surface-raised)" stroke-width="0.4" opacity="${noFiltro ? 1 : 0.18}" class="mapa-lote" data-casa="${c ? c.casa : ""}" style="cursor:${c ? "pointer" : "default"};"><title>${titulo}</title></path>`;
    }).join("");
    const contornoSvg = mapa.contorno.map((d) => `<path d="${d}" fill="none" stroke="var(--border-strong)" stroke-width="0.3" opacity="0.5" />`).join("");

    const totalReal = lotesReais[state.empreendimento];
    const faltam = totalReal != null ? totalReal - mapa.lotes.length : 0;

    host.innerHTML = `
      <svg viewBox="${mapa.viewBox}" style="width:100%; height:auto; max-height:640px; display:block;">
        <g>${contornoSvg}</g>
        <g>${lotesSvg}</g>
      </svg>
      <div class="legend" style="margin-top:10px;">
        <span class="tag-dot" style="color:${STATUS_COR.concluida}">Concluída</span>
        <span class="tag-dot" style="color:${STATUS_COR.em_producao}">Em produção</span>
        <span class="tag-dot" style="color:${STATUS_COR.nao_iniciada}">Não iniciada / sem dados</span>
      </div>
      ${faltam > 0 ? `<p class="footnote" style="margin-top:8px;">A planta desta obra (arquivo de projeto) tem ${mapa.lotes.length} lotes desenhados; faltam ${faltam} lote(s) que ainda não foram incluídos no arquivo de origem — envie uma planta atualizada para completar o mapa.</p>` : ""}
    `;
  }

  document.getElementById("card-mapa").addEventListener("click", (e) => {
    const path = e.target.closest("path[data-casa]");
    if (!path || !path.dataset.casa) return;
    document.getElementById("filtro-busca").value = path.dataset.casa;
    state.busca = path.dataset.casa.toUpperCase();
    render();
  });

  const stateLideres = { selecionado: null };

  function renderLideres() {
    document.getElementById("lideres-row").innerHTML = liderancas.liderancas.map((l) => `
      <div class="card stat-tile" style="gap:10px;">
        <div style="display:flex; align-items:center; gap:10px;">
          ${l.foto
            ? `<img src="${l.foto}" alt="${l.nome}" data-lider="${l.nome}" class="lider-foto" style="width:56px; height:56px; border-radius:50%; object-fit:cover; border:2px solid var(--border); cursor:pointer; flex-shrink:0;" />`
            : `<div class="user-avatar lider-foto" data-lider="${l.nome}" style="width:56px; height:56px; font-size:15px; cursor:pointer; flex-shrink:0;">${GP.initials(l.nome)}</div>`}
          <div style="min-width:0;">
            <div style="font-weight:700; font-size:14px;">${l.nome}</div>
            <div class="footnote">${l.supervisores.length} supervisor(es)</div>
          </div>
        </div>
        <div class="grid grid-3" style="gap:6px;">
          <div><div class="footnote">Meta 2026.2</div><div style="font-weight:700; font-size:18px;">${GP.fmtInt(l.meta_2026_2)}</div></div>
          <div><div class="footnote">Alcançado</div><div style="font-weight:700; font-size:18px; color:var(--status-good);">${GP.fmtInt(l.realizado_2026_2)}</div></div>
          <div><div class="footnote">Faltam</div><div style="font-weight:700; font-size:18px; color:var(--status-warning);">${GP.fmtInt(l.faltam_2026_2)}</div></div>
        </div>
        ${l.backlog_sem_data > 0 ? `<div class="footnote">+ ${GP.fmtInt(l.backlog_sem_data)} casa(s) na fila, ainda sem mês definido</div>` : ""}
      </div>`).join("");

    document.querySelectorAll(".lider-foto").forEach((el) => {
      el.addEventListener("click", () => {
        stateLideres.selecionado = stateLideres.selecionado === el.dataset.lider ? null : el.dataset.lider;
        renderLiderDetalhe();
      });
    });
  }

  function renderLiderDetalhe() {
    const host = document.getElementById("lider-detalhe");
    if (!stateLideres.selecionado) { host.innerHTML = ""; return; }
    const l = liderancas.liderancas.find((x) => x.nome === stateLideres.selecionado);
    if (!l) { host.innerHTML = ""; return; }
    const supervisoresOrdenados = l.supervisores.slice().sort((a, b) => b.meta_2026_2 - a.meta_2026_2);

    host.innerHTML = `
      <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border); display:flex; flex-direction:column; gap:16px;">
        <div class="section-head">
          <h2 style="font-size:14.5px;">Meta mensal por supervisor — ${l.nome} · 2026.2</h2>
          <span class="footnote">${GP.fmtInt(l.meta_2026_2)} casas planejadas no semestre, entre ${l.supervisores.length} supervisor(es)</span>
        </div>
        ${supervisoresOrdenados.map((s) => `
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              ${s.foto
                ? `<img src="${s.foto}" alt="${s.nome}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:2px solid var(--border); flex-shrink:0;" />`
                : `<div class="user-avatar" style="width:32px; height:32px; font-size:11px; flex-shrink:0;">${GP.initials(s.nome)}</div>`}
              <div style="font-weight:700; font-size:13px;">${s.nome}</div>
            </div>
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>Mês</th><th class="num">Meta</th><th class="num">Realizado</th><th class="num">Desvio</th></tr></thead>
                <tbody>
                  ${s.por_mes.map((m) => `
                    <tr>
                      <td>${m.label}</td>
                      <td class="num">${GP.fmtInt(m.meta)}</td>
                      <td class="num">${GP.fmtInt(m.realizado)}</td>
                      <td class="num"><span class="chip ${m.desvio >= 0 ? "chip-good" : "chip-warning"}">${m.desvio > 0 ? "+" : ""}${GP.fmtInt(m.desvio)}</span></td>
                    </tr>`).join("")}
                  <tr style="font-weight:700;">
                    <td>Total 2026.2</td>
                    <td class="num">${GP.fmtInt(s.meta_2026_2)}</td>
                    <td class="num">${GP.fmtInt(s.realizado_2026_2)}</td>
                    <td class="num">${GP.fmtInt(s.realizado_2026_2 - s.meta_2026_2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            ${s.backlog_sem_data > 0 ? `<div class="footnote" style="margin-top:6px;">+ ${GP.fmtInt(s.backlog_sem_data)} casa(s) já na fila deste supervisor, mas ainda sem mês calculado na planilha — não entram na meta 2026.2 acima.</div>` : ""}
          </div>`).join("")}
      </div>
    `;
  }

  renderLideres();

  function render() {
    const filtradas = casas.filter((c) =>
      (state.empreendimento === "todos" || c.empreendimento === state.empreendimento) &&
      (state.equipe === "todos" || c.ga === state.equipe) &&
      (state.supervisor === "todos" || c.supervisor === state.supervisor) &&
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

    renderMapa(filtradas);

    const LIMITE = 150;
    const paraTabela = filtradas.slice(0, LIMITE);
    document.getElementById("contador-casas").textContent = `${GP.fmtInt(filtradas.length)} casa(s)`;
    document.querySelector("#tabela-casas tbody").innerHTML = paraTabela.map((c) => `
      <tr>
        <td class="mono">${c.casa}</td>
        <td>${c.empreendimento}</td>
        <td>${c.ga || "—"}</td>
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

  // Vindo de um link da Visão Geral (cartão de um empreendimento específico)
  // já abre com o filtro de Empreendimento aplicado.
  const empDaUrl = new URLSearchParams(window.location.search).get("empreendimento");
  if (empDaUrl && EMPREENDIMENTOS.includes(empDaUrl)) {
    state.empreendimento = empDaUrl;
    document.getElementById("filtro-emp").value = empDaUrl;
    atualizarFiltrosDependentes();
  }

  render();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(render, 200); });
})();
