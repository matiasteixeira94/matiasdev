"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "celulaFeminina",
    eyebrow: "Gestão da Produção · Dados reais",
    title: "Célula Feminina",
  });
  if (!session) return;

  const dados = await GP.loadJSON("celula_feminina.json");

  const ATIVIDADES = ["PVC", "Cerâmica", "Rejunte", "Alvenaria", "Reboco", "Massa Fina"];
  const comProdutividade = dados.colaboradoras.filter((c) => c.produtividade);
  const destaques = dados.colaboradoras.filter((c) => c.destaque_cultura || c.destaque_produtividade).length;

  const state = { colaboradora: comProdutividade[0]?.nome ?? null };

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <p class="footnote" style="margin-top:-6px; max-width:900px;">
      A <strong>Célula Feminina</strong> é uma iniciativa da Produção UGB Caruaru que forma duplas de
      colaboradoras e as insere em células de produção antes só masculinas. Dados do
      <strong>${dados.periodo}</strong>, com acompanhamento ${dados.rotina_acompanhamento.toLowerCase()}.
      Mostramos aqui só os indicadores gerais (organograma, motivação, absenteísmo e produtividade) —
      comentários individuais sensíveis de saúde e de situações pessoais do relatório original não entram
      no site.
    </p>

    <div class="grid grid-4">
      <div class="card stat-tile">
        <div class="stat-label">Colaboradoras</div>
        <div class="stat-value">${GP.fmtInt(dados.colaboradoras.length)}</div>
        <span class="footnote">função: ${dados.funcao_padrao}</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Motivação média</div>
        <div class="stat-value">${GP.fmtPct(dados.motivacao_media_pct, 0)}</div>
        <span class="chip chip-good">satisfação — acumulado até junho</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Absenteísmo médio</div>
        <div class="stat-value">${GP.fmtPct(dados.absenteismo_medio_pct, 0)}</div>
        <span class="footnote">média de ausências no período</span>
      </div>
      <div class="card stat-tile">
        <div class="stat-label">Destaques</div>
        <div class="stat-value">${GP.fmtInt(destaques)}</div>
        <span class="footnote">de cultura ou produtividade</span>
      </div>
    </div>

    <div class="card">
      <div class="section-head" style="margin-bottom:14px;">
        <h2>Organograma</h2>
        <span class="footnote">★ dourada: destaque de cultura · ★ azul: destaque de produtividade · ⚠ ponto de atenção</span>
      </div>
      <div class="grid grid-auto" id="organograma-celula"></div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Motivação por colaboradora</div><div class="card-sub">Acumulado até maio x acumulado até junho</div></div></div>
      <div class="chart-host" id="chart-motivacao"></div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Absenteísmo por colaboradora</div><div class="card-sub">Acumulado até maio x acumulado até junho</div></div></div>
      <div class="chart-host" id="chart-absenteismo"></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><div class="card-title">Produtividade por atividade</div><div class="card-sub">% da meta atingida — produção executada (dia) sobre a projetada</div></div>
        <select class="select" id="filtro-colaboradora">
          ${comProdutividade.map((c) => `<option value="${c.nome}">${c.nome}</option>`).join("")}
        </select>
      </div>
      <div class="chart-host" id="chart-produtividade"></div>
    </div>
  `;

  document.getElementById("organograma-celula").innerHTML = dados.colaboradoras.map((c) => `
    <div class="card stat-tile" style="align-items:center; text-align:center; gap:10px;">
      ${c.foto
        ? `<img src="${c.foto}" alt="${c.nome}" style="width:64px; height:64px; border-radius:50%; object-fit:cover; border:2px solid var(--border);" />`
        : `<div class="user-avatar" style="width:52px; height:52px; font-size:16px;">${GP.initials(c.nome)}</div>`}
      <div>
        <div style="font-weight:700; font-size:13.5px;">${c.nome}</div>
        <div class="footnote">${c.funcao}</div>
        ${c.tempo_empresa ? `<div class="footnote">${c.tempo_empresa} de empresa</div>` : ""}
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:center;">
        ${c.destaque_cultura ? `<span class="chip chip-warning" title="Destaque de cultura">★ Cultura</span>` : ""}
        ${c.destaque_produtividade ? `<span class="chip" style="color:var(--cat-estrutura); background:color-mix(in srgb, var(--cat-estrutura) 14%, transparent);" title="Destaque de produtividade">★ Produtividade</span>` : ""}
        ${c.ponto_atencao ? `<span class="chip chip-critical" title="Ponto de atenção">⚠ Atenção</span>` : ""}
      </div>
    </div>`).join("");

  function renderMotivacaoAbsenteismo() {
    const comDados = dados.colaboradoras;
    GPCharts.bars(document.getElementById("chart-motivacao"), {
      categories: comDados.map((c) => c.nome.split(" ")[0]),
      series: [
        { name: "Até maio", color: "var(--border-strong)", values: comDados.map((c) => c.motivacao_maio ?? 0) },
        { name: "Até junho", color: "var(--accent)", values: comDados.map((c) => c.motivacao_junho ?? 0) },
      ],
      yFormat: (v) => `${Math.round(v)}%`,
    });
    GPCharts.bars(document.getElementById("chart-absenteismo"), {
      categories: comDados.map((c) => c.nome.split(" ")[0]),
      series: [
        { name: "Até maio", color: "var(--border-strong)", values: comDados.map((c) => c.absenteismo_maio ?? 0) },
        { name: "Até junho", color: "var(--status-warning)", values: comDados.map((c) => c.absenteismo_junho ?? 0) },
      ],
      yFormat: (v) => `${Math.round(v)}%`,
    });
  }

  function renderProdutividade() {
    const colaboradora = comProdutividade.find((c) => c.nome === state.colaboradora);
    if (!colaboradora) return;
    GPCharts.hbars(document.getElementById("chart-produtividade"), {
      items: ATIVIDADES.map((a) => ({ label: a, value: colaboradora.produtividade[a] ?? 0, color: "var(--accent)" })),
      valueFormat: (v) => `${Math.round(v)}%`,
      showTarget: false,
    });
  }

  document.getElementById("filtro-colaboradora").addEventListener("change", (e) => {
    state.colaboradora = e.target.value;
    renderProdutividade();
  });

  renderMotivacaoAbsenteismo();
  renderProdutividade();
  window.addEventListener("resize", () => { clearTimeout(window.__gpResize); window.__gpResize = setTimeout(renderMotivacaoAbsenteismo, 200); });
})();
