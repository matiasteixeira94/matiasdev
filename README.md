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
├── casas.html             # Casas — dados reais de produção por casa
├── indicadores.html       # Produtividade e Qualidade
├── faltas.html            # Faltas e Absenteísmo
├── seguranca.html          # Saúde e Segurança
├── css/styles.css          # Tokens de design + componentes compartilhados
├── js/
│   ├── app.js               # Shell (sidebar/topbar), sessão, tema, utilidades
│   ├── charts.js             # Gráficos em SVG puro (linha, barras, ranking)
│   ├── dashboard.js           # Lógica da Visão Geral
│   ├── casas.js                # Lógica da tela Casas (dados reais)
│   ├── indicadores.js          # Lógica de Produtividade e Qualidade
│   ├── faltas.js                # Lógica de Faltas/Absenteísmo
│   └── seguranca.js              # Lógica de Saúde e Segurança
├── data/
│   ├── raw/config_obras.json          # Configuração-fonte das obras fictícias (entrada do gerador mock)
│   ├── scripts/
│   │   ├── gerar_dados_mock.py          # Gera os data/processed/*.json fictícios a partir de raw/
│   │   └── extrair_casas_planilha.mjs    # Extrai a aba "DADOS CASA" de planilhas .xlsm reais → casas.json
│   └── processed/
│       ├── casas.json / casas_meta.json   # Dados REAIS (produção por casa, ver seção abaixo)
│       └── *.json                          # Demais dados fictícios de demonstração
└── docs/
    ├── estrutura-banco-dados.md      # Modelo relacional completo + DDL PostgreSQL
    └── funcionalidades-e-roadmap.md   # Prioridades, fluxo diário e roadmap
```

## Dados reais — tela "Casas"

`data/processed/casas.json` (2.679 casas) e `casas_meta.json` foram extraídos
das planilhas reais de controle de produção **"CONTROLE DE UGB - CA -
2026.1.xlsm"** e **"2026.2.xlsm"** (aba `DADOS CASA`), com o script
`data/scripts/extrair_casas_planilha.mjs`. Diferente do restante do site
(que usa dados fictícios da Viana & Moura para fins de demonstração), esta
tela reflete produção real: equipes (GA), supervisores, empreendimentos e
o progresso de cada casa pelas 5 macroetapas (Radier → Alvenaria → Acab.2 +
Coberta → Reboco Int.+Ext. → Acab.1). Para regenerar a partir de uma
planilha nova:

```bash
npm install xlsx
node data/scripts/extrair_casas_planilha.mjs "CONTROLE DE UGB - CA - AAAA.S.xlsm" [...]
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

Depois acesse `http://localhost:8080/index.html` — sem tela de login: a
sessão de demonstração (perfil **Administrador**) é criada automaticamente
no primeiro acesso. Para simular os outros perfis (**Gestor** ou
**Supervisor de obra**, com escopo restrito a uma obra), use o seletor de
perfil no rodapé da barra lateral.

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
