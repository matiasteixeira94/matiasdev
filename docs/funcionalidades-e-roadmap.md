# Funcionalidades, fluxo de atualização diária e roadmap

## Funcionalidades prioritárias

Priorização por valor de negócio (visibilidade gerencial e obrigações
legais de S&S vêm primeiro) e por dependência técnica (não dá para medir
produtividade sem cadastro de obras/colaboradores).

### P0 — Fundação (pré-requisito de tudo)
- Cadastro de obras (CRUD, responsáveis, orçamento previsto)
- Cadastro de colaboradores + histórico de alocação por obra/grupo
- Autenticação com perfis (admin, gestor, supervisor) e escopo de obra por perfil
- Apontamento diário de produção (quantidade x meta, horas trabalhadas)

### P1 — Visibilidade gerencial (Dashboard + Faltas)
- Dashboard principal com filtros por período/obra/grupo
- Registro e listagem de faltas (falta, atraso, saída antecipada)
- Taxa de absenteísmo (global, por obra, por grupo) e identificação de padrões crônicos
- Pendências de justificativa de falta

### P2 — Qualidade e Segurança (obrigação regulatória)
- Registro de ocorrências de S&S com categorização (quase-acidente / leve / grave)
- Índice de frequência de acidentes
- Controle de EPIs vencidos/faltando e treinamentos (NRs) pendentes
- Registro de não conformidades e retrabalho por grupo

### P3 — Analítico e conformidade
- Evolução temporal / tendências (produtividade, retrabalho, absenteísmo)
- Exportação de relatórios (PDF, Excel)
- Notificações automáticas para alertas críticos (acidente grave, EPI vencido, NC aberta há X dias)
- Histórico auditável de alterações (trilha de auditoria)

### P4 — Escala e integração
- Visão de produtividade por colaborador (view restrita a admin/gestor)
- Relatórios de inspeção de canteiro
- Integração com sistemas de RH/folha (faltas) e financeiro (orçamento realizado)
- App/PWA offline-first para apontamento em campo sem sinal

## Fluxo de atualização diária

Dados de obra são lançados no canteiro (muitas vezes com conectividade
instável) e precisam estar consolidados nos dashboards antes do início do
expediente seguinte.

```mermaid
flowchart TD
    A["Encarregado / Técnico de Segurança\nregistra no canteiro"] --> B{Conectividade?}
    B -- "Online" --> C["App/PWA envia direto\nà API"]
    B -- "Offline" --> D["Fica em fila local\n(IndexedDB)"]
    D -- "Conexão restabelecida" --> C
    C --> E["API valida o registro\n(regras de negócio + duplicidade)"]
    E -- "Inválido" --> F["Devolve erro ao app\ncom o campo a corrigir"]
    F --> A
    E -- "Válido" --> G["Grava em registro_producao /\nfalta / ocorrencia_seguranca / registro_qualidade"]
    G --> H["Job de consolidação\n(agregações e índices, ~de hora em hora)"]
    H --> I["Materialized views:\nprodutividade, absenteísmo,\níndice de frequência, qualidade"]
    I --> J["Dashboards atualizados\n(Visão Geral, Indicadores, Faltas, S&S)"]
    I --> K{"Regra de alerta\natingida?"}
    K -- "Sim" --> L["Notificação push/e-mail\n(admin, gestor, supervisor da obra)"]
    K -- "Não" --> M["Sem ação"]
```

**Janela de corte diária**: os apontamentos referentes ao dia `D` devem ser
lançados até as 08h00 do dia `D+1` (início do expediente); o job de
consolidação roda a cada hora durante o expediente e uma vez de madrugada
para o fechamento definitivo do dia — o dashboard sempre mostra "última
atualização às HH:MM" para deixar clara a defasagem.

**Regras de alerta (exemplos)**: acidente grave → notificação imediata;
EPI vencido há mais de 5 dias → alerta diário até regularização; não
conformidade aberta há mais de 3 dias → escalonamento ao gestor; taxa de
absenteísmo de um grupo acima de 8% na semana → alerta ao gestor da obra.

## Roadmap de implementação

```mermaid
gantt
    dateFormat  YYYY-MM-DD
    title Roadmap — Gestão da Produção
    section Fase 0 — Descoberta
    Levantamento com encarregados e gestores :f0, 2026-08-03, 10d
    Modelagem de dados e definição de perfis  :f0b, after f0, 5d
    section Fase 1 — MVP (P0+P1)
    Cadastros (obras, colaboradores) + auth   :f1a, after f0b, 15d
    Apontamento diário de produção            :f1b, after f1a, 10d
    Dashboard principal + Faltas              :f1c, after f1b, 12d
    Piloto em 1 obra                          :f1d, after f1c, 10d
    section Fase 2 — Qualidade e Segurança (P2)
    Ocorrências de S&S + EPIs + treinamentos  :f2a, after f1d, 15d
    Qualidade (retrabalho, não conformidades) :f2b, after f2a, 10d
    Rollout para todas as obras               :f2c, after f2b, 10d
    section Fase 3 — Analítico e conformidade (P3)
    Evolução temporal e exportação (PDF/Excel):f3a, after f2c, 12d
    Notificações de alertas críticos          :f3b, after f3a, 8d
    Trilha de auditoria                       :f3c, after f3b, 8d
    section Fase 4 — Escala (P4)
    Produtividade por colaborador (view restrita) :f4a, after f3c, 10d
    Inspeções de canteiro                     :f4b, after f4a, 8d
    PWA offline-first                         :f4c, after f4b, 15d
    Integrações RH/financeiro                 :f4d, after f4c, 15d
```

| Fase | Duração estimada | Entrega principal |
|---|---|---|
| 0 — Descoberta | ~3 semanas | Modelo de dados validado com o time de campo |
| 1 — MVP | ~9 semanas | Obras, colaboradores, apontamento, dashboard e faltas em produção numa obra-piloto |
| 2 — Qualidade e Segurança | ~7 semanas | Módulo de S&S completo, rollout para todas as obras |
| 3 — Analítico e conformidade | ~5,5 semanas | Relatórios exportáveis, alertas automáticos, auditoria |
| 4 — Escala | ~7 semanas | Visão individual, inspeções, app offline, integrações |

O piloto em uma única obra ao fim da Fase 1 é o ponto de decisão: valida se
o fluxo de apontamento diário é rápido o suficiente para o encarregado usar
todo dia antes de investir nas fases seguintes.
