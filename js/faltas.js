"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "faltas",
    eyebrow: "Gestão da Produção",
    title: "Faltas e Absenteísmo",
  });
  if (!session) return;

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <div class="card">
      <div class="section-head" style="margin-bottom:4px;">
        <h2>Faltas e Absenteísmo</h2>
        <span class="chip chip-warning">Aguardando dados</span>
      </div>
      <p class="footnote" style="margin-top:8px; max-width:640px;">
        Esta tela está em desenvolvimento — ainda não recebemos uma planilha dedicada de
        faltas e absenteísmo para gerar indicadores reais aqui.
      </p>
    </div>
  `;
})();
