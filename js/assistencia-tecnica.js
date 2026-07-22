"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "assistencia",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Assistência Técnica",
  });
  if (!session) return;

  const dados = await GP.loadJSON("assistencia_tecnica.json");

  const STATUS_COR = {
    "Realizado": "var(--status-good)",
    "Avaliado": "var(--gold)",
    "Finalizado Não Procedente": "var(--status-warning)",
    "Excluído": "var(--status-critical)",
    "Cancelado": "var(--status-critical)",
  };
  const corStatus = (s) => STATUS_COR[s] || "var(--accent)";

  // "Todos" sempre primeiro; o resto em ordem alfabética (o JSON traz por
  // volume, que é útil pro cálculo mas não pra escolher num select).
  const empreendimentosOrdenados = ["Todos", ...dados.empreendimentos.filter((e) => e !== "Todos").sort((a, b) => a.localeCompare(b, "pt-BR"))];

  // Cartões fixos de "chamados que faltam finalizar" por empreendimento —
  // Laranjeiras, Cerejeiras e Oliveiras cada um com o seu, e "Loteamento"
  // junta todo o resto (Xique-xique, Andorinha, Lagoa de Pedra, Amoreiras e
  // os itens sem empreendimento identificado). Independe do filtro
  // selecionado abaixo — é sempre a visão dos 4 grupos. Conta CHAMADOS (não
  // itens) que ainda não chegaram em Realizado/Não Procedente/Cancelado —
  // ver totais.em_aberto em extrair_assistencia_tecnica.mjs.
  const GRUPOS_PRINCIPAIS = ["Laranjeiras", "Cerejeiras", "Oliveiras"];
  const abertoPorGrupo = { Laranjeiras: 0, Cerejeiras: 0, Oliveiras: 0, Loteamento: 0 };
  for (const emp of dados.empreendimentos) {
    if (emp === "Todos") continue;
    const chamados = dados.por_empreendimento[emp].totais.em_aberto;
    if (GRUPOS_PRINCIPAIS.includes(emp)) abertoPorGrupo[emp] += chamados;
    else abertoPorGrupo.Loteamento += chamados;
  }

  // Funil de status (do histórico de mudanças de status, não do status
  // atual): quantos chamados já passaram por cada etapa alguma vez. Mesmo
  // agrupamento em 4 grupos do cartão acima, mas cada grupo aqui soma as 5
  // etapas — os grupos são conjuntos disjuntos de empreendimentos, então
  // somar não conta nenhum chamado 2x.
  const GRUPOS_FUNIL = ["Laranjeiras", "Cerejeiras", "Oliveiras", "Loteamento"];
  const funilPorGrupo = {
    Laranjeiras: { inseridos: 0, avaliados: 0, agendados: 0, nao_procedentes: 0, realizados: 0 },
    Cerejeiras: { inseridos: 0, avaliados: 0, agendados: 0, nao_procedentes: 0, realizados: 0 },
    Oliveiras: { inseridos: 0, avaliados: 0, agendados: 0, nao_procedentes: 0, realizados: 0 },
    Loteamento: { inseridos: 0, avaliados: 0, agendados: 0, nao_procedentes: 0, realizados: 0 },
  };
  for (const emp of dados.empreendimentos) {
    if (emp === "Todos") continue;
    const f = dados.por_empreendimento[emp].funil_status;
    const grupo = GRUPOS_PRINCIPAIS.includes(emp) ? emp : "Loteamento";
    for (const chave of Object.keys(f)) funilPorGrupo[grupo][chave] += f[chave];
  }

  const state = { empreendimento: "Todos", funilGrupo: "Laranjeiras" };
  const content = document.getElementById("gp-content");

  function irParaEmpreendimento(emp) {
    state.empreendimento = emp;
    render();
    document.getElementById("filtro-empreendimento").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function render() {
    const d = dados.por_empreendimento[state.empreendimento];
    const { totais, sla, tempos_medios_dias: tempos, pesquisa_satisfacao: pesquisa } = d;

    content.innerHTML = `
      <div class="card">
        <div class="card-head" style="margin-bottom:14px;">
          <div><div class="card-title">Chamados que faltam finalizar por empreendimento</div><div class="card-sub">Clique num empreendimento pra ver o detalhe. "Loteamento" junta Amoreiras, Xique-xique, Andorinha e Lagoa de Pedra</div></div>
        </div>
        <div class="grid grid-4">
          <div class="stat-tile" style="cursor:pointer;" data-emp="Laranjeiras">
            <div class="stat-label">Laranjeiras</div>
            <div class="stat-value">${GP.fmtInt(abertoPorGrupo.Laranjeiras)}</div>
          </div>
          <div class="stat-tile" style="cursor:pointer;" data-emp="Cerejeiras">
            <div class="stat-label">Cerejeiras</div>
            <div class="stat-value">${GP.fmtInt(abertoPorGrupo.Cerejeiras)}</div>
          </div>
          <div class="stat-tile" style="cursor:pointer;" data-emp="Oliveiras">
            <div class="stat-label">Oliveiras</div>
            <div class="stat-value">${GP.fmtInt(abertoPorGrupo.Oliveiras)}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Loteamento</div>
            <div class="stat-value">${GP.fmtInt(abertoPorGrupo.Loteamento)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head" style="margin-bottom:14px;">
          <div><div class="card-title">Nº de chamados por etapa</div><div class="card-sub">Do histórico — quantos chamados já passaram por cada etapa alguma vez (não é o status atual)</div></div>
          <div class="seg">
            ${GRUPOS_FUNIL.map((g) => `<button type="button" aria-pressed="${g === state.funilGrupo}" data-funil-grupo="${g}">${g}</button>`).join("")}
          </div>
        </div>
        <div class="grid" style="grid-template-columns: repeat(5, 1fr);">
          <div class="stat-tile">
            <div class="stat-label">Inseridos</div>
            <div class="stat-value">${GP.fmtInt(funilPorGrupo[state.funilGrupo].inseridos)}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Avaliados</div>
            <div class="stat-value">${GP.fmtInt(funilPorGrupo[state.funilGrupo].avaliados)}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Agendados</div>
            <div class="stat-value">${GP.fmtInt(funilPorGrupo[state.funilGrupo].agendados)}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Não procedente</div>
            <div class="stat-value">${GP.fmtInt(funilPorGrupo[state.funilGrupo].nao_procedentes)}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Realizado</div>
            <div class="stat-value">${GP.fmtInt(funilPorGrupo[state.funilGrupo].realizados)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head" style="margin-bottom:4px;">
          <div><div class="card-title">Chamados de assistência técnica</div></div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <select class="select" id="filtro-empreendimento">
              ${empreendimentosOrdenados.map((e) => `<option value="${e}" ${e === state.empreendimento ? "selected" : ""}>${e === "Todos" ? "Todos os empreendimentos" : e}</option>`).join("")}
            </select>
            <span class="chip chip-neutral">Dados reais e agregados — UGB Caruaru</span>
          </div>
        </div>
        <p class="footnote" style="margin-bottom:14px; max-width:720px;">
          ${d.periodo.de ? GP.fmtDate(d.periodo.de) : "—"} a ${d.periodo.ate ? GP.fmtDate(d.periodo.ate) : "—"} ·
          atualizado em ${GP.fmtDate(dados.atualizado_em)} · fonte: dados.vianaemoura.com.br. Só a UGB Caruaru — as
          demais unidades da Viana &amp; Moura ficam fora deste site. Sempre agregado — nunca associado a nome de
          cliente ou ao texto livre da avaliação de campo.
        </p>
        <div class="grid grid-auto">
          <div class="stat-tile">
            <div class="stat-label">Chamados únicos</div>
            <div class="stat-value">${GP.fmtInt(totais.chamados_unicos)}</div>
            <span class="footnote">${GP.fmtInt(totais.itens_relatados)} itens relatados</span>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Em aberto</div>
            <div class="stat-value">${GP.fmtInt(totais.em_aberto)}</div>
            <span class="footnote">${GP.fmtInt(totais.casas_com_solicitacao_aberta)} casas aguardando atendimento</span>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Taxa de procedência</div>
            <div class="stat-value">${totais.taxa_procedencia_pct != null ? GP.fmtPct(totais.taxa_procedencia_pct, 1) : "—"}</div>
            <span class="footnote">${GP.fmtInt(totais.concluidos)} concluídos · ${GP.fmtInt(totais.nao_procedentes)} não procedentes</span>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Tempo médio de atendimento</div>
            <div class="stat-value">${totais.tempo_medio_atendimento_dias ?? "—"} dias</div>
            <span class="footnote">abertura até execução (concluídos)</span>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Chamados de Infra</div>
            <div class="stat-value">${GP.fmtInt(totais.chamados_infra)}</div>
            <span class="footnote">não ligados a uma casa específica (ruas, áreas comuns etc.)</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head" style="margin-bottom:14px;">
          <div><div class="card-title">Evolução mensal</div><div class="card-sub">Itens relatados por mês de abertura</div></div>
        </div>
        <div class="chart-host" id="chart-evolucao"></div>
      </div>

      <div class="card">
        <div class="card-head" style="margin-bottom:14px;">
          <div><div class="card-title">Por status</div></div>
        </div>
        <div class="chart-host" id="chart-status"></div>
      </div>

      <div class="card">
        <div class="card-head" style="margin-bottom:14px;">
          <div><div class="card-title">Categorias de problema mais frequentes</div></div>
        </div>
        <div class="chart-host" id="chart-categoria"></div>
      </div>

      <div class="card">
        <div class="card-head" style="margin-bottom:4px;">
          <div><div class="card-title">Prazos (SLA)</div></div>
        </div>
        <p class="footnote" style="margin-bottom:14px;">
          % de chamados avaliados/concluídos dentro do prazo combinado e do prazo máximo com o cliente.
        </p>
        <div class="grid grid-4">
          <div class="stat-tile">
            <div class="stat-label">Avaliação no prazo combinado</div>
            <div class="stat-value">${sla.avaliacao_no_prazo_combinado_pct ?? "—"}%</div>
            <span class="footnote">${GP.fmtInt(sla.avaliacao_no_prazo_combinado_amostra)} chamados com prazo definido</span>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Avaliação no prazo máximo</div>
            <div class="stat-value">${sla.avaliacao_no_prazo_maximo_pct ?? "—"}%</div>
            <span class="footnote">${GP.fmtInt(sla.avaliacao_no_prazo_maximo_amostra)} chamados com prazo definido</span>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Término no prazo combinado</div>
            <div class="stat-value">${sla.termino_no_prazo_combinado_pct ?? "—"}%</div>
            <span class="footnote">${GP.fmtInt(sla.termino_no_prazo_combinado_amostra)} chamados com prazo definido</span>
          </div>
          <div class="stat-tile">
            <div class="stat-label">Término no prazo máximo</div>
            <div class="stat-value">${sla.termino_no_prazo_maximo_pct ?? "—"}%</div>
            <span class="footnote">${GP.fmtInt(sla.termino_no_prazo_maximo_amostra)} chamados com prazo definido</span>
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head" style="margin-bottom:14px;">
            <div><div class="card-title">Gravidade</div></div>
          </div>
          <div class="chart-host" id="chart-gravidade"></div>
        </div>
        <div class="card">
          <div class="card-head" style="margin-bottom:4px;">
            <div><div class="card-title">Tempo médio por etapa</div></div>
          </div>
          <p class="footnote" style="margin-bottom:14px;">Dias entre etapas do histórico de status de cada chamado.</p>
          <div style="display:flex; flex-direction:column; gap:14px;">
            <div class="stat-tile">
              <div class="stat-label">Abertura → agendamento</div>
              <div class="stat-value" style="font-size:22px;">${tempos.abertura_ate_agendamento ?? "—"} dias</div>
            </div>
            <div class="stat-tile">
              <div class="stat-label">Agendamento → avaliação</div>
              <div class="stat-value" style="font-size:22px;">${tempos.agendamento_ate_avaliacao ?? "—"} dias</div>
            </div>
            <div class="stat-tile">
              <div class="stat-label">Avaliação → execução</div>
              <div class="stat-value" style="font-size:22px;">${tempos.avaliacao_ate_realizado ?? "—"} dias</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head" style="margin-bottom:4px;">
          <div><div class="card-title">Atendimento interno</div></div>
          <span class="footnote">Pesquisa de satisfação respondida: ${pesquisa.respondida_pct != null ? GP.fmtPct(pesquisa.respondida_pct, 1) : "—"} (${GP.fmtInt(pesquisa.amostra)} chamados concluídos)</span>
        </div>
        <p class="footnote" style="margin-bottom:14px;">Ranking por volume de chamados executados — visão gerencial de carga de trabalho da equipe de campo.</p>
        ${d.por_tecnico.length ? `
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Técnico</th><th>Chamados executados</th></tr></thead>
            <tbody>
              ${d.por_tecnico.map((t) => `
                <tr>
                  <td>${t.nome}</td>
                  <td>${GP.fmtInt(t.realizados)}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>` : `<p class="footnote">Sem chamados executados neste recorte.</p>`}
      </div>
    `;

    document.getElementById("filtro-empreendimento").addEventListener("change", (e) => {
      state.empreendimento = e.target.value;
      render();
    });
    content.querySelectorAll("[data-emp]").forEach((el) => {
      el.addEventListener("click", () => irParaEmpreendimento(el.dataset.emp));
    });
    content.querySelectorAll("[data-funil-grupo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.funilGrupo = btn.dataset.funilGrupo;
        render();
      });
    });

    renderGraficos(d);
  }

  function renderGraficos(d) {
    GPCharts.line(document.getElementById("chart-evolucao"), {
      labels: d.evolucao_mensal.map((m) => m.mes),
      series: [{ name: "Itens relatados", values: d.evolucao_mensal.map((m) => m.total), color: "var(--accent)", area: true }],
      yFormat: (v) => GP.fmtInt(v),
    });

    GPCharts.hbars(document.getElementById("chart-status"), {
      items: d.por_status.map((s) => ({ label: s.status, value: s.total, color: corStatus(s.status) })),
      valueFormat: (v) => GP.fmtInt(v),
      showTarget: false,
    });

    GPCharts.hbars(document.getElementById("chart-categoria"), {
      items: d.por_categoria.map((c) => ({ label: c.categoria, value: c.total, color: "var(--accent)" })),
      valueFormat: (v) => GP.fmtInt(v),
      showTarget: false,
    });

    GPCharts.hbars(document.getElementById("chart-gravidade"), {
      items: d.por_gravidade.map((g) => ({ label: g.gravidade, value: g.total, color: "var(--status-serious)" })),
      valueFormat: (v) => GP.fmtInt(v),
      showTarget: false,
    });
  }

  render();
  window.addEventListener("resize", () => {
    clearTimeout(window.__gpResize);
    window.__gpResize = setTimeout(() => renderGraficos(dados.por_empreendimento[state.empreendimento]), 200);
  });
})();
