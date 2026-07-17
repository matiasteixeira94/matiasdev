"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "acabamentos",
    eyebrow: "Gestão da Produção",
    title: "Acabamentos",
  });
  if (!session) return;

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <div class="card">
      <div class="section-head" style="margin-bottom:4px;">
        <h2>Acabamentos</h2>
        <span class="chip chip-warning">Aguardando dados</span>
      </div>
      <p class="footnote" style="margin-top:8px; max-width:640px;">
        Esta tela está em desenvolvimento — ainda não recebemos uma planilha dedicada de
        acabamentos para gerar indicadores reais aqui.
      </p>
    </div>
  `;
})();
