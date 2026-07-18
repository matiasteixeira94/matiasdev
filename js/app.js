// Núcleo compartilhado: autenticação mock, shell (sidebar/topbar), tema e
// utilidades de dados/formatação usadas por todas as páginas.
"use strict";

const GP = (() => {
  const SESSION_KEY = "gp_session";
  const THEME_KEY = "gp_theme";

  // Logomarca — duas espigas trançadas (identidade Viana & Moura). Coluna direita
  // mais alta que a esquerda, como no manual de marca; renderizada só em ouro
  // (versão "reversa" do logo) porque aqui ela sempre fica sobre fundo vermelho.
  const LOGO_MARK_SVG = `<svg class="logomark" viewBox="16 0 84 172" role="img" aria-label="Viana e Moura Construções">
    <line x1="36" y1="48" x2="36" y2="60"/>
    <line x1="80" y1="3" x2="80" y2="11"/>
    <polygon points="23,64 36,72 36,94 23,86"/>
    <polygon points="36,72 49,64 49,86 36,94"/>
    <polygon points="23,89 36,97 36,119 23,111"/>
    <polygon points="36,97 49,89 49,111 36,119"/>
    <polygon points="23,114 36,122 36,144 23,136"/>
    <polygon points="36,122 49,114 49,136 36,144"/>
    <polygon points="23,139 36,147 36,169 23,161"/>
    <polygon points="36,147 49,139 49,161 36,169"/>
    <polygon points="67,14 80,22 80,44 67,36"/>
    <polygon points="80,22 93,14 93,36 80,44"/>
    <polygon points="67,39 80,47 80,69 67,61"/>
    <polygon points="80,47 93,39 93,61 80,69"/>
    <polygon points="67,64 80,72 80,94 67,86"/>
    <polygon points="80,72 93,64 93,86 80,94"/>
    <polygon points="67,89 80,97 80,119 67,111"/>
    <polygon points="80,97 93,89 93,111 80,119"/>
    <polygon points="67,114 80,122 80,144 67,136"/>
    <polygon points="80,122 93,114 93,136 80,144"/>
    <polygon points="67,139 80,147 80,169 67,161"/>
    <polygon points="80,147 93,139 93,161 80,169"/>
  </svg>`;

  const NAV_ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    faltas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/></svg>',
    seguranca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
    casas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
    muros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M8 5v7M16 5v7M3 19v-2M21 19v-2"/></svg>',
    acabamentos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2 8 12l-2 6 6-2L22 6Z"/><path d="M2 22l4-1 1-4"/></svg>',
    assistencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4L14 13"/></svg>',
    pessoal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  };

  const NAV_ITEMS = [
    { key: "dashboard", href: "index.html", label: "Visão Geral" },
    { key: "casas", href: "casas.html", label: "Casas" },
    { key: "muros", href: "muros.html", label: "Muros" },
    { key: "acabamentos", href: "acabamentos.html", label: "Acabamentos" },
    { key: "assistencia", href: "assistencia-tecnica.html", label: "Assistência Técnica" },
    { key: "pessoal", href: "pessoal.html", label: "Quadro de Pessoal" },
    { key: "faltas", href: "faltas.html", label: "Faltas e Absenteísmo" },
    { key: "seguranca", href: "seguranca.html", label: "Saúde e Segurança" },
  ];

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  }
  function setSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  const DEFAULT_SESSION = { nome: "Matias Teixeira" };

  function requireAuth() {
    let s = getSession();
    if (!s) { s = { ...DEFAULT_SESSION }; setSession(s); }
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
      <div class="mobile-topbar">
        <button class="mobile-topbar-toggle" id="gp-sidebar-toggle" type="button" aria-label="Abrir menu" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
        <a class="mobile-topbar-brand" href="inicio.html">
          <div class="brand-mark" style="width:26px;height:26px;">${LOGO_MARK_SVG}</div>
          <span>Gestão da Produção</span>
        </a>
      </div>
      <div class="sidebar-backdrop" id="gp-sidebar-backdrop"></div>
      <aside class="sidebar" id="gp-sidebar">
        <a class="brand" href="inicio.html" title="Voltar à tela inicial">
          <div class="brand-mark">${LOGO_MARK_SVG}</div>
          <div class="brand-word">Gestão da Produção<small>Viana &amp; Moura Construções</small></div>
        </a>
        <a class="nav-link" href="inicio.html" style="margin: -12px 0 4px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>
          <span>Voltar à tela inicial</span>
        </a>
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
            </div>
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
    wireMobileSidebar(mount);
    return session;
  }

  function wireMobileSidebar(mount) {
    const toggle = document.getElementById("gp-sidebar-toggle");
    const backdrop = document.getElementById("gp-sidebar-backdrop");
    if (!toggle || !backdrop) return;
    const close = () => { mount.classList.remove("sidebar-open"); toggle.setAttribute("aria-expanded", "false"); };
    const open = () => { mount.classList.add("sidebar-open"); toggle.setAttribute("aria-expanded", "true"); };
    toggle.addEventListener("click", () => (mount.classList.contains("sidebar-open") ? close() : open()));
    backdrop.addEventListener("click", close);
    document.getElementById("gp-sidebar").addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
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
    NAV_ITEMS, GRUPO_LABEL, GRUPO_VAR, LOGO_MARK_SVG,
    getSession, setSession, clearSession, requireAuth,
    applyStoredTheme, wireThemeToggle, renderShell, initials,
    loadJSON, fmtInt, fmtNum1, fmtPct, fmtBRL, fmtDate, fmtDateShort, within, isoDaysAgo,
  };
})();

GP.applyStoredTheme();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
