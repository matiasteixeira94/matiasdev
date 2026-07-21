# Atualizacao diaria (casas + muros) - le direto da pasta do Dropbox
# sincronizada localmente neste computador (sem download da internet - evita
# o bloqueio de rede que existe no ambiente de nuvem). Pensado pra rodar via
# Agendador de Tarefas do Windows, 2x por dia (6h e 13h).
#
# So commita se algo realmente mudou nos JSONs de dados; se qualquer etapa
# falhar, para e loga o erro, sem commitar nada.

$ErrorActionPreference = "Stop"

$repo = "C:\Users\Viana e Moura\Documents\Projetos\matiasdev\matiasdev"
$pasta1 = "C:\Users\Viana e Moura\Desktop\Dropbox\01. INDUSTRIAL - PRODUÇÃO\2026\CONTROLE\1º semestre"
$pasta2 = "C:\Users\Viana e Moura\Desktop\Dropbox\01. INDUSTRIAL - PRODUÇÃO\2026\CONTROLE\2º semestre"
$casas1 = Join-Path $pasta1 "CONTROLE DE UGB - CA - 2026.1.xlsm"
$casas2 = Join-Path $pasta2 "CONTROLE DE UGB - CA - 2026.2.xlsm"
$muros = Join-Path $pasta2 "CONTROLE DE UGB - CA - 2026.2 - Muros.xlsm"
$log = Join-Path $repo "data\scripts\_log_atualizacao_diaria.txt"

function Log($msg) {
  $linha = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Add-Content -Path $log -Value $linha -Encoding UTF8
  Write-Output $linha
}

Set-Location $repo
Log "=== Iniciando atualizacao ==="

# Garante que está no branch main antes de mexer em qualquer coisa - já
# aconteceu de rodar isso com outro branch aberto (ex.: trabalho de refactor)
# e o commit ir parar no lugar errado.
$branchAtual = git rev-parse --abbrev-ref HEAD
if ($branchAtual -ne "main") {
  Log "Branch atual era '$branchAtual', trocando para 'main'."
  git checkout main
  if ($LASTEXITCODE -ne 0) { Log "ERRO: nao consegui trocar para o branch main (mudancas nao commitadas?). Abortando."; exit 1 }
}
git pull origin main --ff-only
if ($LASTEXITCODE -ne 0) { Log "ERRO: git pull falhou (main local pode estar divergente). Abortando."; exit 1 }

if (-not (Test-Path $casas1)) { Log "ERRO: planilha de casas (1o semestre) nao encontrada em $casas1"; exit 1 }
if (-not (Test-Path $casas2)) { Log "ERRO: planilha de casas (2o semestre) nao encontrada em $casas2"; exit 1 }
if (-not (Test-Path $muros)) { Log "ERRO: planilha de muros nao encontrada em $muros"; exit 1 }

try {
  # IMPORTANTE: passa os dois semestres juntos - casas concluidas só no
  # 2026.1 não aparecem na aba DADOS CASA do arquivo 2026.2 sozinho, e
  # extrair_casas_planilha.mjs SOBRESCREVE casas.json inteiro a cada rodada
  # (não faz merge incremental com o que já está no repositório). Passar só
  # um arquivo já causou uma regressão real (Amoreiras caiu de 189 para 79
  # casas concluídas em 21/07/2026) - não tirar o 2026.1 daqui.
  node data/scripts/extrair_casas_planilha.mjs $casas1 $casas2 2>&1 | ForEach-Object { Log $_ }
  node data/scripts/atualizar_em_producao_controle.mjs $casas2 2>&1 | ForEach-Object { Log $_ }
  node data/scripts/extrair_muros_planilha.mjs $muros 2>&1 | ForEach-Object { Log $_ }
  node data/scripts/gerar_produtividade_obras.mjs 2>&1 | ForEach-Object { Log $_ }
  node data/scripts/gerar_resumo_obras.mjs 2>&1 | ForEach-Object { Log $_ }
  node data/scripts/extrair_metas_semestre.mjs $casas2 $muros 2>&1 | ForEach-Object { Log $_ }
  node data/scripts/extrair_metas_mensais.mjs $casas2 $muros 2>&1 | ForEach-Object { Log $_ }
} catch {
  Log "ERRO na extracao: $_"
  exit 1
}

$arquivos = @(
  "data/processed/casas.json",
  "data/processed/casas_meta.json",
  "data/processed/muros.json",
  "data/processed/produtividade_obras.json",
  "data/processed/obras_reais.json",
  "data/processed/metas_2026_2.json",
  "data/processed/metas_mensais_2026_2.json"
)

$diff = git diff --stat -- $arquivos
if ([string]::IsNullOrWhiteSpace($diff)) {
  Log "Sem mudancas - nada pra commitar."
  exit 0
}

Log "Mudancas detectadas:"
Log ($diff -join "`n")

git add -- $arquivos
git commit -m "Atualiza dados de casas e muros (importacao automatica local)"
git push origin main

Log "=== Commit e push concluidos ==="



