"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "assistencia",
    eyebrow: "Gestão da Produção",
    title: "Assistência Técnica",
  });
  if (!session) return;

  const pessoal = await GP.loadJSON("pessoal_resumo.json");

  const equipeAT = Object.entries(pessoal.por_funcao)
    .filter(([funcao]) => funcao.toUpperCase().includes("ASSIST"))
    .sort((a, b) => b[1] - a[1]);
  const totalAT = equipeAT.reduce((a, [, n]) => a + n, 0);

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <div class="card">
      <div class="section-head" style="margin-bottom:4px;">
        <h2>Equipe de Assistência Técnica</h2>
        <span class="chip chip-neutral">Dados reais — Viana &amp; Moura, UGB Caruaru</span>
      </div>
      <p class="footnote" style="margin-bottom:14px;">
        Colaboradores ativos hoje classificados em funções de assistência técnica, a partir
        do quadro de pessoal real.
      </p>
      <div class="grid grid-auto" style="margin-bottom:16px;">
        <div class="stat-tile">
          <div class="stat-label">Colaboradores em Assistência Técnica</div>
          <div class="stat-value">${GP.fmtInt(totalAT)}</div>
          <span class="footnote">de ${GP.fmtInt(pessoal.ativos)} ativos na empresa</span>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Função</th><th class="num">Colaboradores</th></tr></thead>
          <tbody>
            ${equipeAT.map(([funcao, n]) => `<tr><td>${funcao}</td><td class="num">${n}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Chamados e atendimentos</div>
      <p class="footnote" style="margin-top:8px; max-width:640px;">
        Esta tela está em desenvolvimento. Os próximos indicadores planejados são: chamados
        abertos por empreendimento, prazo médio de atendimento, taxa de reincidência e
        pendências por casa entregue — dependem de uma nova fonte de dados de pós-obra,
        ainda não integrada à plataforma.
      </p>
    </div>
  `;
})();
