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

  const [obrasReais, pessoalResumo, custoCasa] = await Promise.all([
    GP.loadJSON("obras_reais.json"), GP.loadJSON("pessoal_resumo.json"), GP.loadJSON("custo_casa.json"),
  ]);
  const totalCasas = obrasReais.reduce((a, o) => a + o.total, 0);
  const totalConcluidas = obrasReais.reduce((a, o) => a + o.concluida, 0);

  // Cada condomínio leva o nome de uma árvore frutífera — o ícone segue o tema.
  const OBRA_ICON = {
    Amoreiras: `<svg viewBox="0 0 40 40"><path d="M20 10V4" stroke="#5B7A3A" stroke-width="2" stroke-linecap="round"/><path d="M20 8c3-3 7-2 8 1-3 2-6 1-8-1Z" fill="#5B7A3A"/><circle cx="20" cy="15" r="3.3" fill="#4A2A57"/><circle cx="16" cy="19" r="3.3" fill="#5B3466"/><circle cx="24" cy="19" r="3.3" fill="#5B3466"/><circle cx="13.5" cy="24" r="3.3" fill="#4A2A57"/><circle cx="20" cy="24" r="3.3" fill="#5B3466"/><circle cx="26.5" cy="24" r="3.3" fill="#4A2A57"/><circle cx="17" cy="29" r="3.3" fill="#5B3466"/><circle cx="23" cy="29" r="3.3" fill="#4A2A57"/></svg>`,
    Oliveiras: `<svg viewBox="0 0 40 40"><path d="M6 11c8-5 20-5 28 0" stroke="#6B5B3A" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse cx="20" cy="25" rx="8" ry="11" fill="#7A8C3F"/><ellipse cx="17" cy="20" rx="2.4" ry="3.3" fill="rgba(255,255,255,0.28)"/></svg>`,
    Cerejeiras: `<svg viewBox="0 0 40 40"><path d="M16 11c1-5 6-8 10-7" stroke="#5B7A3A" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M23 10c1-4 5-6 8-5" stroke="#5B7A3A" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="15" cy="25" r="7.5" fill="#C23B3B"/><circle cx="26" cy="24" r="7.5" fill="#A9302F"/></svg>`,
    Laranjeiras: `<svg viewBox="0 0 40 40"><circle cx="20" cy="23" r="13" fill="#E2871E"/><rect x="19" y="4" width="2" height="8" rx="1" fill="#5B7A3A"/><path d="M21 8c4-3 8-2 9 1-3 2-7 1-9-1Z" fill="#5B7A3A"/></svg>`,
  };
  const OBRA_COR = { Amoreiras: "var(--cat-alvenaria)", Oliveiras: "var(--cat-acabamento)", Cerejeiras: "var(--cat-estrutura)", Laranjeiras: "var(--cat-administrativo)" };

  // Ordem real em que os condomínios foram construídos (não é a ordem de
  // exibição dos cartões acima, que é Amoreiras/Oliveiras/Cerejeiras/Laranjeiras).
  const ORDEM_EXECUCAO = ["Laranjeiras", "Cerejeiras", "Oliveiras", "Amoreiras"];
  const SUBCONTAS_CUSTO = ["MATERIAL", "SERVIÇO", "PESSOAL", "OUTROS CUSTOS"];
  const obrasComCusto = ORDEM_EXECUCAO.filter((nome) => custoCasa[nome]);
  const primeiraObraCusto = obrasComCusto[0] ? custoCasa[obrasComCusto[0]] : null;
  const ultimaObraCusto = obrasComCusto.length ? custoCasa[obrasComCusto[obrasComCusto.length - 1]] : null;
  const variacaoCustoGeral = primeiraObraCusto && ultimaObraCusto
    ? Math.round(((ultimaObraCusto.total.custo_por_casa_atual - primeiraObraCusto.total.custo_por_casa_atual) / primeiraObraCusto.total.custo_por_casa_atual) * 1000) / 10
    : null;

  // Seta + variação % ao lado do nome da obra, comparando o custo/casa com a
  // obra anterior na ordem de execução — verde para baixo (melhorou) ou
  // vermelha para cima (piorou).
  function custoTrendArrow(i) {
    if (i === 0) return "";
    const atual = custoCasa[obrasComCusto[i]].total.custo_por_casa_atual;
    const anterior = custoCasa[obrasComCusto[i - 1]].total.custo_por_casa_atual;
    if (atual === anterior) return "";
    const piorou = atual > anterior;
    const pct = Math.round((Math.abs(atual - anterior) / anterior) * 1000) / 10;
    const cor = piorou ? "var(--status-critical)" : "var(--status-good)";
    const path = piorou ? `<path d="M12 19V5M5 12l7-7 7 7"/>` : `<path d="M12 5v14M19 12l-7 7-7-7"/>`;
    return `<span style="display:inline-flex; align-items:center; gap:2px; margin-left:5px; color:${cor}; font-weight:700; font-size:12px;">` +
      `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${cor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>` +
      `${piorou ? "+" : "-"}${GP.fmtPct(pct, 1)}</span>`;
  }

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
      <div class="grid grid-4">
        ${obrasReais.map((o) => `
          <a class="card obra-card" href="casas.html">
            <div class="obra-card-icon">${OBRA_ICON[o.empreendimento] ?? OBRA_ICON.Oliveiras}</div>
            <div class="obra-card-name">${o.empreendimento}</div>
            <div class="obra-card-pct">${o.pct_concluido}%</div>
            <div class="bar-track"><div class="bar-fill" style="width:${o.pct_concluido}%;"></div></div>
            <div class="footnote mono" style="margin-top:8px;">${GP.fmtInt(o.concluida)} / ${GP.fmtInt(o.total)} casas</div>
            <span class="chip ${o.pct_concluido >= 100 ? "chip-good" : "chip-warning"}" style="margin-top:8px;">${o.pct_concluido >= 100 ? "Concluída" : "Em andamento"}</span>
            ${o.produtividade_media != null ? `<div class="footnote" style="margin-top:8px;">Produtividade média<br><span class="mono" style="color:var(--ink); font-weight:700;">${GP.fmtNum1(o.produtividade_media)}</span> por casa entregue</div>` : ""}
          </a>`).join("")}
      </div>
      <a class="btn btn-ghost" style="margin-top:14px;" href="casas.html">Ver casa a casa →</a>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Produtividade média por obra</div><div class="card-sub">Coluna "PROD." da aba DADOS CASA, média das casas já entregues — na ordem em que as obras foram executadas</div></div></div>
      <div class="chart-host" id="chart-produtividade-media"></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><div class="card-title">Custo por casa — grupo "Custo Casa"</div><div class="card-sub">Última fotografia de orçamento (MATERIAL + SERVIÇO + PESSOAL + OUTROS CUSTOS) dividida pelos lotes de cada obra — na ordem em que os condomínios foram construídos</div></div>
        ${variacaoCustoGeral != null ? `<span class="chip ${variacaoCustoGeral > 0 ? "chip-warning" : "chip-good"}">${variacaoCustoGeral > 0 ? "+" : ""}${GP.fmtPct(variacaoCustoGeral, 1)} de Laranjeiras até Amoreiras</span>` : ""}
      </div>
      <div class="table-wrap" style="margin-bottom:16px;">
        <table class="data">
          <thead>
            <tr><th>Item 01.05 — Custo Casa</th>${obrasComCusto.map((nome, i) => `<th class="num">${nome}${custoTrendArrow(i)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${SUBCONTAS_CUSTO.map((sub) => `
              <tr>
                <td>${sub}</td>
                ${obrasComCusto.map((nome) => `<td class="num">${custoCasa[nome].subcontas[sub] ? GP.fmtBRL(custoCasa[nome].subcontas[sub].atual) : "—"}</td>`).join("")}
              </tr>`).join("")}
            <tr style="font-weight:700;">
              <td>Total (Material + Serviço + Pessoal + Outros)</td>
              ${obrasComCusto.map((nome) => `<td class="num">${GP.fmtBRL(custoCasa[nome].total.atual)}</td>`).join("")}
            </tr>
          </tbody>
        </table>
      </div>
      <div class="chart-host" id="chart-custo-casa"></div>
      <div class="grid grid-4" style="margin-top:14px;">
        ${obrasComCusto.map((nome, i) => {
          const d = custoCasa[nome];
          return `
          <div class="stat-tile">
            <div class="stat-label">${nome}${custoTrendArrow(i)}</div>
            <div class="stat-value" style="font-size:20px;">${GP.fmtBRL(d.total.custo_por_casa_atual)}</div>
            <span class="footnote">por casa · ${d.lotes} lotes</span><br>
            <span class="chip ${d.total.variacao_pct > 0 ? "chip-warning" : "chip-good"}" style="margin-top:6px;">${d.total.variacao_pct > 0 ? "+" : ""}${GP.fmtPct(d.total.variacao_pct, 1)} vs orçamento base</span>
          </div>`;
        }).join("")}
      </div>
    </div>
  `;

  document.getElementById("btn-export-pdf").addEventListener("click", () => window.print());
  document.getElementById("btn-export-xls").addEventListener("click", () => alert("Exportação para Excel: integra com o endpoint /relatorios/exportar?formato=xlsx (ver docs/estrutura-banco-dados.md)."));

  function renderGraficos() {
    const porObra = Object.fromEntries(obrasReais.map((o) => [o.empreendimento, o]));
    GPCharts.barsLine(document.getElementById("chart-produtividade-media"), {
      items: ORDEM_EXECUCAO.filter((nome) => porObra[nome]?.produtividade_media != null).map((nome) => ({
        label: nome, value: porObra[nome].produtividade_media, color: OBRA_COR[nome] ?? "var(--accent)",
      })),
      yFormat: (v) => GP.fmtNum1(v),
    });

    GPCharts.barsLine(document.getElementById("chart-custo-casa"), {
      items: obrasComCusto.map((nome) => ({
        label: nome, value: custoCasa[nome].total.custo_por_casa_atual, color: OBRA_COR[nome] ?? "var(--accent)",
      })),
      yFormat: (v) => GP.fmtBRL(v),
      tooltipLabel: "Custo por casa",
      legendLabel: "Custo por casa (ordem de execução)",
    });
  }

  renderGraficos();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(renderGraficos, 200); });
})();
