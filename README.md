# Gestão da Produção — Viana & Moura Construções

Plataforma web de acompanhamento de obras: produtividade, qualidade, faltas
e saúde/segurança, atualizada diariamente. Protótipo em HTML/CSS/JS puro
(sem build step), mesmo padrão do repositório
[`disserta-o_matias`](https://github.com/matiasteixeira94/disserta-o_matias) —
site estático com os dados separados em `data/` e a documentação em `docs/`.

## Estrutura

```
.
├── index.html            # Dashboard principal (Visão Geral)
├── indicadores.html       # Produtividade e Qualidade
├── faltas.html            # Faltas e Absenteísmo
├── seguranca.html          # Saúde e Segurança
├── login.html              # Autenticação (mock, com seleção de perfil)
├── css/styles.css          # Tokens de design + componentes compartilhados
├── js/
│   ├── app.js               # Shell (sidebar/topbar), sessão, tema, utilidades
│   ├── charts.js             # Gráficos em SVG puro (linha, barras, ranking)
│   ├── dashboard.js           # Lógica da Visão Geral
│   ├── indicadores.js          # Lógica de Produtividade e Qualidade
│   ├── faltas.js                # Lógica de Faltas/Absenteísmo
│   └── seguranca.js              # Lógica de Saúde e Segurança
├── data/
│   ├── raw/config_obras.json      # Configuração-fonte das obras (entrada do gerador)
│   ├── scripts/gerar_dados_mock.py # Gera data/processed/*.json a partir de raw/
│   └── processed/*.json            # Dados consumidos pelas páginas (fetch client-side)
└── docs/
    ├── estrutura-banco-dados.md      # Modelo relacional completo + DDL PostgreSQL
    └── funcionalidades-e-roadmap.md   # Prioridades, fluxo diário e roadmap
```

## Rodando localmente

As páginas carregam os dados via `fetch("data/processed/...json")`, então
precisam ser servidas por HTTP (abrir o arquivo direto no navegador não
funciona). Qualquer servidor estático resolve:

```bash
npx http-server . -p 8080
# ou
npx serve -l 8080
```

Depois acesse `http://localhost:8080/login.html`. É um login de demonstração
(sem senha): escolha um perfil — **Administrador**, **Gestor** ou
**Supervisor de obra** — para simular o escopo de acesso de cada um.

## Regenerar os dados de demonstração

```bash
python data/scripts/gerar_dados_mock.py
```

Lê `data/raw/config_obras.json` e regrava `data/processed/*.json` com uma
massa de dados determinística (mesma seed). Em produção, esses arquivos
seriam substituídos pelas respostas de uma API real — ver
`docs/estrutura-banco-dados.md`.

## Deploy (GitHub + Vercel)

```bash
git init
git add .
git commit -m "Estrutura inicial do projeto Gestão da Produção"
git remote add origin https://github.com/matiasteixeira94/matiasdev.git
git push -u origin main
```

Na Vercel: **Add New → Project → Import Git Repository** e selecione o
repositório. Como é um site estático (sem framework), a Vercel detecta
automaticamente — não é necessário definir *build command* nem *output
directory*. O `vercel.json` já cuida do cache dos JSON em `data/processed/`.

## Documentação

- [`docs/estrutura-banco-dados.md`](docs/estrutura-banco-dados.md) — modelo de dados completo (ER + DDL)
- [`docs/funcionalidades-e-roadmap.md`](docs/funcionalidades-e-roadmap.md) — funcionalidades priorizadas, fluxo de atualização diária e roadmap de implementação
