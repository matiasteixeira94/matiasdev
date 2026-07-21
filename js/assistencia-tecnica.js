"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "assistencia",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Assistência Técnica",
  });
  if (!session) return;

  const dados = await GP.loadJSON("assistencia_tecnica.json");
  const { totais, sla, tempos_medios_dias: tempos, pesquisa_satisfacao: pesquisa } = dados;

  const STATUS_COR = {
    "Realizado": "var(--status-good)",
    "Avaliado": "var(--gold)",
    "Finalizado Não Procedente": "var(--status-warning)",
    "Excluído": "var(--status-critical)",
    "Cancelado": "var(--status-critical)",
  };
  const corStatus = (s) => STATUS_COR[s] || "var(--accent)";

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <div class="card">
      <div class="card-head" style="margin-bottom:4px;">
        <div><div class="card-title">Chamados de assistência técnica</div></div>
        <span class="chip chip-neutral">Dados reais e agregados — UGB Caruaru</span>
      </div>
      <p class="footnote" style="margin-bottom:14px; max-width:720px;">
        ${dados.periodo.de ? GP.fmtDate(dados.periodo.de) : "—"} a ${dados.periodo.ate ? GP.fmtDate(dados.periodo.ate) : "—"} ·
        atualizado em ${GP.fmtDate(dados.atualizado_em)} · fonte: dados.vianaemoura.com.br. Só a UGB Caruaru — as
        demais unidades da Viana &amp; Moura ficam fora deste site. Sempre agregado — nunca associado a nome de
        cliente ou ao texto livre da avaliação de campo.
      </p>
      <div class="grid grid-4">
        <div class="stat-tile">
          <div class="stat-label">Chamados únicos</div>
          <div class="stat-value">${GP.fmtInt(totais.chamados_unicos)}</div>
          <span class="footnote">${GP.fmtInt(totais.itens_relatados)} itens relatados</span>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Em aberto</div>
          <div class="stat-value">${GP.fmtInt(totais.em_aberto)}</div>
          <span class="footnote">itens ainda sem desfecho</span>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Taxa de procedência</div>
          <div class="stat-value">${GP.fmtPct(totais.taxa_procedencia_pct, 1)}</div>
          <span class="footnote">${GP.fmtInt(totais.concluidos)} concluídos · ${GP.fmtInt(totais.nao_procedentes)} não procedentes</span>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Tempo médio de atendimento</div>
          <div class="stat-value">${totais.tempo_medio_atendimento_dias} dias</div>
          <span class="footnote">abertura até execução (concluídos)</span>
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
        <span class="footnote">Pesquisa de satisfação respondida: ${GP.fmtPct(pesquisa.respondida_pct, 1)} (${GP.fmtInt(pesquisa.amostra)} chamados concluídos)</span>
      </div>
      <p class="footnote" style="margin-bottom:14px;">Ranking por volume de chamados executados — visão gerencial de carga de trabalho da equipe de campo.</p>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Técnico</th><th>Chamados executados</th></tr></thead>
          <tbody>
            ${dados.por_tecnico.map((t) => `
              <tr>
                <td>${t.nome}</td>
                <td>${GP.fmtInt(t.realizados)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  function renderGraficos() {
    GPCharts.line(document.getElementById("chart-evolucao"), {
      labels: dados.evolucao_mensal.map((m) => m.mes),
      series: [{ name: "Itens relatados", values: dados.evolucao_mensal.map((m) => m.total), color: "var(--accent)", area: true }],
      yFormat: (v) => GP.fmtInt(v),
    });

    GPCharts.hbars(document.getElementById("chart-status"), {
      items: dados.por_status.map((s) => ({ label: s.status, value: s.total, color: corStatus(s.status) })),
      valueFormat: (v) => GP.fmtInt(v),
      showTarget: false,
    });

    GPCharts.hbars(document.getElementById("chart-categoria"), {
      items: dados.por_categoria.map((c) => ({ label: c.categoria, value: c.total, color: "var(--accent)" })),
      valueFormat: (v) => GP.fmtInt(v),
      showTarget: false,
    });

    GPCharts.hbars(document.getElementById("chart-gravidade"), {
      items: dados.por_gravidade.map((g) => ({ label: g.gravidade, value: g.total, color: "var(--status-serious)" })),
      valueFormat: (v) => GP.fmtInt(v),
      showTarget: false,
    });
  }

  renderGraficos();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(renderGraficos, 200); });
})();
