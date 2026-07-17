"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "assistencia",
    eyebrow: "Gestão da Produção",
    title: "Assistência Técnica",
  });
  if (!session) return;

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <div class="card">
      <div class="section-head" style="margin-bottom:4px;">
        <h2>Assistência Técnica</h2>
        <span class="chip chip-warning">Aguardando dados</span>
      </div>
      <p class="footnote" style="margin-top:8px; max-width:640px;">
        Esta tela está em desenvolvimento — ainda não recebemos uma planilha dedicada de
        assistência técnica para gerar indicadores reais aqui.
      </p>
    </div>
  `;
})();
