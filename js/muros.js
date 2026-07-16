"use strict";
(async function () {
  const session = GP.renderShell({
    activeKey: "muros",
    eyebrow: "Gestão da Produção",
    title: "Muros",
  });
  if (!session) return;

  const content = document.getElementById("gp-content");
  content.innerHTML = `
    <div class="card">
      <div class="section-head" style="margin-bottom:4px;">
        <h2>Produção de muros</h2>
        <span class="chip chip-warning">Aguardando dados</span>
      </div>
      <p class="footnote" style="margin-top:8px; max-width:640px;">
        Esta tela está em desenvolvimento. A planilha de controle já reserva uma coluna
        "Muro" (em "NÚMERO DE CASAS INICIADAS") para essa frente de produção, mas ela ainda
        não vem preenchida nas planilhas mais recentes — por isso não há números reais para
        mostrar aqui ainda. Assim que o time passar a registrar o avanço de muros por
        empreendimento/dia, esta tela passa a mostrar produção x meta, % concluído por
        empreendimento e histórico, no mesmo padrão da tela <a href="casas.html">Casas</a>.
      </p>
    </div>
  `;
})();
