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

  const [obrasReais, pessoalResumo, produtividadeObras] = await Promise.all([
    GP.loadJSON("obras_reais.json"), GP.loadJSON("pessoal_resumo.json"), GP.loadJSON("produtividade_obras.json"),
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

  const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function labelMes(m) {
    const [ano, mes] = m.split("-");
    return `${MESES_ABREV[Number(mes) - 1]}/${ano.slice(2)}`;
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
          </a>`).join("")}
      </div>
      <a class="btn btn-ghost" style="margin-top:14px;" href="casas.html">Ver casa a casa →</a>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:4px;">
        <h2>Evolução da produtividade média</h2>
        <span class="chip chip-neutral">Dados reais</span>
      </div>
      <p class="footnote" style="margin-bottom:14px;">
        Média mensal da produção registrada por macroetapa concluída (aba DADOS CASA), por
        obra. Cada condomínio foi construído em uma janela de tempo diferente — por isso cada
        um tem seu próprio período no eixo horizontal.
      </p>
      <div class="grid grid-2">
        ${Object.entries(produtividadeObras).map(([nome, d]) => `
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <div class="obra-card-icon" style="width:28px; height:28px; margin-bottom:0;">${OBRA_ICON[nome] ?? ""}</div>
              <span class="tag-dot" style="color:${OBRA_COR[nome] ?? "var(--accent)"}; font-size:13px; font-weight:700;">${nome}</span>
            </div>
            <div class="chart-host" id="chart-prod-${nome}"></div>
          </div>`).join("")}
      </div>
    </div>
  `;

  document.getElementById("btn-export-pdf").addEventListener("click", () => window.print());
  document.getElementById("btn-export-xls").addEventListener("click", () => alert("Exportação para Excel: integra com o endpoint /relatorios/exportar?formato=xlsx (ver docs/estrutura-banco-dados.md)."));

  function renderGraficos() {
    for (const [nome, d] of Object.entries(produtividadeObras)) {
      const host = document.getElementById(`chart-prod-${nome}`);
      if (!host) continue;
      GPCharts.line(host, {
        labels: d.meses.map(labelMes),
        series: [{ name: "Produção média", color: OBRA_COR[nome] ?? "var(--accent)", values: d.valores, area: true }],
        height: 170,
        yFormat: (v) => GP.fmtNum1(v),
      });
    }
  }

  renderGraficos();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(renderGraficos, 200); });
})();
