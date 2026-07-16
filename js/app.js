// Núcleo compartilhado: autenticação mock, shell (sidebar/topbar), tema e
// utilidades de dados/formatação usadas por todas as páginas.
"use strict";

const GP = (() => {
  const SESSION_KEY = "gp_session";
  const THEME_KEY = "gp_theme";

  const PERFIS = {
    admin: { label: "Administrador", desc: "Acesso total, inclui auditoria e produtividade individual" },
    gestor: { label: "Gestor", desc: "Todas as obras, inclui produtividade individual" },
    supervisor: { label: "Supervisor de Obra", desc: "Apenas a obra designada, sem produtividade individual" },
  };

  // Logomarca — duas espigas estilizadas (identidade Viana & Moura), em ouro sobre o vermelho da marca.
  const LOGO_MARK_SVG = `<svg class="logomark" viewBox="0 0 40 38" role="img" aria-label="Viana e Moura Construções">
    <line x1="12" y1="3" x2="12" y2="6.6"/>
    <line x1="28" y1="3" x2="28" y2="6.6"/>
    <polygon points="6,6.8 12,10 18,6.8 18,13.2 12,10 6,13.2"/>
    <polygon points="6.5,13.8 12,17 17.5,13.8 17.5,20.2 12,17 6.5,20.2"/>
    <polygon points="7,20.8 12,24 17,20.8 17,27.2 12,24 7,27.2"/>
    <polygon points="7.5,27.8 12,31 16.5,27.8 16.5,34.2 12,31 7.5,34.2"/>
    <polygon points="22,6.8 28,10 34,6.8 34,13.2 28,10 22,13.2"/>
    <polygon points="22.5,13.8 28,17 33.5,13.8 33.5,20.2 28,17 22.5,20.2"/>
    <polygon points="23,20.8 28,24 33,20.8 33,27.2 28,24 23,27.2"/>
    <polygon points="23.5,27.8 28,31 32.5,27.8 32.5,34.2 28,31 23.5,34.2"/>
  </svg>`;

  const NAV_ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    indicadores: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-4 4"/></svg>',
    faltas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/></svg>',
    seguranca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
  };

  const NAV_ITEMS = [
    { key: "dashboard", href: "index.html", label: "Visão Geral" },
    { key: "indicadores", href: "indicadores.html", label: "Produtividade e Qualidade" },
    { key: "faltas", href: "faltas.html", label: "Faltas e Absenteísmo" },
    { key: "seguranca", href: "seguranca.html", label: "Saúde e Segurança" },
  ];

  const OBRA_MOCK = [
    { id: "OB-001", nome: "Residencial Bosque Verde" },
    { id: "OB-002", nome: "Edifício Comercial Marco Zero" },
    { id: "OB-003", nome: "Condomínio Vista do Rio" },
    { id: "OB-004", nome: "Galpão Industrial Suape" },
  ];

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  }
  function setSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function requireAuth() {
    const s = getSession();
    if (!s) { window.location.href = "login.html"; return null; }
    return s;
  }

  function initials(name) {
    return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }

  function applyStoredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  }

  function wireThemeToggle(btn) {
    if (!btn) return;
    const icon = btn.querySelector("#gp-theme-icon") || btn;
    const setIcon = () => {
      const isDark = getComputedStyle(document.documentElement).colorScheme === "dark" ||
        document.documentElement.getAttribute("data-theme") === "dark" ||
        (!document.documentElement.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      icon.textContent = isDark ? "☀" : "☾";
    };
    setIcon();
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(THEME_KEY, next);
      setIcon();
    });
  }

  function renderShell({ activeKey, eyebrow, title, actionsHtml }) {
    const session = requireAuth();
    if (!session) return null;

    const mount = document.getElementById("gp-shell");
    if (!mount) return session;

    const navHtml = NAV_ITEMS.map((item) => `
      <a class="nav-link" href="${item.href}" ${item.key === activeKey ? 'aria-current="page"' : ""}>
        ${NAV_ICONS[item.key]}<span>${item.label}</span>
      </a>`).join("");

    mount.innerHTML = `
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">${LOGO_MARK_SVG}</div>
          <div class="brand-word">Gestão da Produção<small>Viana &amp; Moura Construções</small></div>
        </div>
        <nav class="nav-group">
          <div class="nav-label">Monitoramento</div>
          ${navHtml}
        </nav>
        <div class="sidebar-foot">
          <button class="btn btn-ghost" id="gp-theme-toggle" style="justify-content:flex-start" type="button">
            <span aria-hidden="true" id="gp-theme-icon">☾</span><span>Alternar tema</span>
          </button>
          <div class="user-card">
            <div class="user-avatar">${initials(session.nome)}</div>
            <div class="user-meta">
              <strong>${session.nome}</strong>
              <span>${PERFIS[session.perfil]?.label ?? session.perfil}</span>
            </div>
            <button class="btn icon-btn btn-ghost" id="gp-logout" title="Sair" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
            </button>
          </div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div>
            <div class="topbar-eyebrow">${eyebrow ?? "Gestão da Produção"}</div>
            <h1>${title}</h1>
          </div>
          <div class="topbar-actions">${actionsHtml ?? ""}</div>
        </header>
        <div class="content" id="gp-content"></div>
      </div>`;

    wireThemeToggle(document.getElementById("gp-theme-toggle"));
    document.getElementById("gp-logout").addEventListener("click", () => { clearSession(); window.location.href = "login.html"; });
    return session;
  }

  async function loadJSON(name) {
    const res = await fetch(`data/processed/${name}`);
    if (!res.ok) throw new Error(`Falha ao carregar ${name}`);
    return res.json();
  }

  const fmtInt = (n) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
  const fmtNum1 = (n) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n);
  const fmtPct = (n, casas = 1) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas }).format(n)}%`;
  const fmtBRL = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  const fmtDate = (iso) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
  const fmtDateShort = (iso) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${iso}T00:00:00`));

  function within(dateIso, fromIso, toIso) {
    return dateIso >= fromIso && dateIso <= toIso;
  }
  function isoDaysAgo(n, base = "2026-07-16") {
    const d = new Date(`${base}T00:00:00`);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  const GRUPO_LABEL = { estrutura: "Estrutura", alvenaria: "Alvenaria", acabamento: "Acabamento", administrativo: "Administrativo" };
  const GRUPO_VAR = { estrutura: "--cat-estrutura", alvenaria: "--cat-alvenaria", acabamento: "--cat-acabamento", administrativo: "--cat-administrativo" };

  return {
    PERFIS, NAV_ITEMS, OBRA_MOCK, GRUPO_LABEL, GRUPO_VAR, LOGO_MARK_SVG,
    getSession, setSession, clearSession, requireAuth,
    applyStoredTheme, wireThemeToggle, renderShell, initials,
    loadJSON, fmtInt, fmtNum1, fmtPct, fmtBRL, fmtDate, fmtDateShort, within, isoDaysAgo,
  };
})();

GP.applyStoredTheme();
