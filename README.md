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

Depois acesse `http://localhost:8080/inicio.html` — tela de login (usuário +
senha + código de WhatsApp, ver seção abaixo). Um servidor estático puro
(`http-server`/`serve`) não roda as funções serverless de `api/`, então o
login completo só funciona rodando com `vercel dev` (precisa de `vercel
login` e do projeto linkado) ou já em produção na Vercel.

## Login e segunda validação por WhatsApp

Login em duas etapas, sem conta de usuário nem banco de dados:

1. **Usuário/senha** — validados em `api/send-otp.js` (nunca no navegador).
   Credenciais cadastradas em `api/_usuarios.js` (mantido em sincronia manual
   com o mesmo conceito, sem senha, em `js/app.js`).
2. **Código de 6 dígitos por WhatsApp** — enviado sempre para o WhatsApp do
   gerente de UGB (Alisson Matias) via [Z-API](https://z-api.io), qualquer
   que seja o usuário logando. `api/verify-otp.js` confere o código contra
   um token assinado (HMAC), sem precisar guardar nada em banco — o token
   expira em 5 minutos.

Variáveis de ambiente necessárias (configurar em **Vercel → Project →
Settings → Environment Variables**):

| Variável | O que é |
|---|---|
| `ZAPI_INSTANCE_ID` | ID da instância Z-API (painel Z-API, após criar a instância) |
| `ZAPI_TOKEN` | Token da instância (mesmo painel) |
| `ZAPI_CLIENT_TOKEN` | "Client-Token" de segurança da conta Z-API (Segurança → Client-Token no painel) |
| `ALISSON_WHATSAPP_NUMBER` | Número que recebe os códigos, formato `55DDNNNNNNNNN` (ex.: `5581999999999`) |
| `OTP_SECRET` | Uma string aleatória longa qualquer (ex.: gerada com `openssl rand -hex 32`), só pra assinar o token — não precisa decorar |

Passo a passo no Z-API:
1. Criar conta em [z-api.io](https://z-api.io) e uma instância.
2. Conectar um número de WhatsApp à instância escaneando o QR code — **use
   um número diferente do que vai receber os códigos** (não dá pra mandar
   mensagem de um número pra ele mesmo). Pode ser um chip dedicado só pra
   isso.
3. Copiar o ID da instância e o Token na tela da instância, e o Client-Token
   em Segurança.
4. Adicionar as 5 variáveis acima no projeto na Vercel e fazer um novo
   deploy (ou "Redeploy") pra elas entrarem em vigor.

**Sem essas variáveis configuradas, ninguém consegue logar** — `api/send-otp.js`
recusa o pedido com um erro claro em vez de travar, mas a segunda etapa do
login simplesmente não funciona até isso ser configurado.

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
