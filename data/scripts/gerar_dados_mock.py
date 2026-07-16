#!/usr/bin/env python3
"""
Gera os arquivos em data/processed/*.json a partir da configuração em
data/raw/config_obras.json.

Uso:
    python data/scripts/gerar_dados_mock.py

Este script existe para permitir regenerar/expandir a base de dados de
demonstração sem depender de um backend real. Em produção, estes arquivos
processed/*.json seriam substituídos pelas respostas da API (ver
docs/estrutura-banco-dados.md).
"""
import json
import random
from datetime import date, timedelta
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
RAW = BASE / "raw"
PROCESSED = BASE / "processed"
HOJE = date(2026, 7, 16)

random.seed(20260716)

GRUPOS = ["estrutura", "alvenaria", "acabamento", "administrativo"]
FUNCOES = {
    "estrutura": ["Armador", "Carpinteiro de Forma", "Servente de Estrutura", "Operador de Betoneira", "Ferramenteiro"],
    "alvenaria": ["Pedreiro", "Servente de Alvenaria", "Meio-Oficial de Alvenaria"],
    "acabamento": ["Pintor", "Azulejista", "Gesseiro", "Marceneiro", "Servente de Acabamento"],
    "administrativo": ["Engenheiro de Obra", "Encarregado Geral", "Técnico de Segurança", "Almoxarife", "Auxiliar Administrativo"],
}
NOMES = ["João", "Maria", "Pedro", "Ana", "Carlos", "Juliana", "Marcos", "Fernanda", "Paulo", "Camila",
         "Lucas", "Patrícia", "André", "Bianca", "Rafael", "Larissa", "Diego", "Tatiane", "Bruno", "Vanessa"]
SOBRENOMES = ["Silva", "Santos", "Souza", "Oliveira", "Pereira", "Costa", "Rodrigues", "Almeida",
              "Nascimento", "Lima", "Araújo", "Fernandes", "Carvalho", "Gomes", "Martins", "Ribeiro"]
METAS = {"estrutura": 42, "alvenaria": 55, "acabamento": 38}
TIPOS_OCORRENCIA = ["quase_acidente", "acidente_leve", "acidente_grave"]
DESCRICOES_OCORRENCIA = {
    "quase_acidente": ["Queda de material de andaime sem vítima", "Piso escorregadio identificado a tempo",
                        "Cabo elétrico exposto próximo à circulação"],
    "acidente_leve": ["Corte superficial na mão ao manusear ferragem", "Torção de tornozelo em deslocamento no piso térreo"],
    "acidente_grave": ["Queda de nível com afastamento", "Prensamento de mão em içamento de carga"],
}


def dias_uteis(qtd, a_partir_de=HOJE):
    dias, d = [], a_partir_de
    while len(dias) < qtd:
        if d.weekday() != 6:  # pula domingo
            dias.append(d)
        d -= timedelta(days=1)
    return list(reversed(dias))


def carregar_obras():
    with open(RAW / "config_obras.json", encoding="utf-8") as f:
        return json.load(f)


def gerar_colaboradores(obras):
    colaboradores, seq = [], 1
    for obra in obras:
        if obra["status"] == "concluida":
            continue
        for _ in range(obra["_tamanho_equipe"]):
            grupo = random.choices(GRUPOS, weights=[3, 3, 2, 1.2])[0]
            colaboradores.append({
                "id": f"COL-{seq:04d}",
                "nome": f"{random.choice(NOMES)} {random.choice(SOBRENOMES)} {random.choice(SOBRENOMES)}",
                "funcao": random.choice(FUNCOES[grupo]),
                "grupo": grupo,
                "obra_id": obra["id"],
                "data_admissao": (HOJE - timedelta(days=random.randint(90, 2500))).isoformat(),
                "ativo": random.random() > 0.045,
            })
            seq += 1
    return colaboradores


def gerar_producao_qualidade_faltas(obras, colaboradores):
    producao, qualidade, faltas = [], [], []
    dias = dias_uteis(42)
    por_obra = {o["id"]: [c for c in colaboradores if c["obra_id"] == o["id"] and c["ativo"]] for o in obras}

    for dia in dias:
        d = dia.isoformat()
        for obra in obras:
            if obra["status"] == "concluida":
                continue
            equipe_obra = por_obra.get(obra["id"], [])
            for grupo, meta in METAS.items():
                equipe = [c for c in equipe_obra if c["grupo"] == grupo]
                if not equipe:
                    continue
                fator = 0.78 + random.random() * 0.34
                producao.append({
                    "data": d, "obra_id": obra["id"], "grupo": grupo,
                    "quantidade_produzida": round(meta * len(equipe) / 3 * fator, 1),
                    "unidade": "m2" if grupo in ("alvenaria", "acabamento") else "m3",
                    "meta_diaria": round(meta * len(equipe) / 3, 1),
                    "horas_trabalhadas": round(len(equipe) * (7.8 + random.random() * 0.6), 1),
                })
                if random.random() < 0.4:
                    gerou_nc = random.random() < 0.22
                    qualidade.append({
                        "data": d, "obra_id": obra["id"], "grupo": grupo,
                        "retrabalho_pct": round(max(0, (random.random() - 0.55) * 12), 1),
                        "nao_conformidade": gerou_nc,
                        "nc_status": random.choice(["aberta", "em_correcao", "corrigida"]) if gerou_nc else None,
                    })
            for c in equipe_obra:
                if c["grupo"] == "administrativo":
                    continue
                if random.random() < 0.055:
                    faltas.append({
                        "data": d, "colaborador_id": c["id"], "obra_id": obra["id"], "grupo": c["grupo"],
                        "tipo": random.choice(["falta", "atraso", "saida_antecipada"]),
                        "justificada": random.random() < 0.5,
                        "motivo": random.choice(["Atestado médico", "Problema familiar", "Transporte", None]),
                    })
    return producao, qualidade, faltas


def gerar_seguranca(obras, colaboradores):
    por_obra = {o["id"]: [c for c in colaboradores if c["obra_id"] == o["id"] and c["ativo"]] for o in obras}
    ocorrencias, seq = [], 1
    for dia in dias_uteis(90):
        d = dia.isoformat()
        for obra in obras:
            if obra["status"] == "concluida" or random.random() > 0.16:
                continue
            equipe = por_obra.get(obra["id"], [])
            if not equipe:
                continue
            tipo = random.choices(TIPOS_OCORRENCIA, weights=[3, 1.4, 0.4])[0]
            colaborador = random.choice(equipe)
            ocorrencias.append({
                "id": f"OC-{seq:04d}", "data": d, "obra_id": obra["id"],
                "colaborador_id": colaborador["id"], "grupo": colaborador["grupo"], "tipo": tipo,
                "descricao": random.choice(DESCRICOES_OCORRENCIA[tipo]),
                "dias_afastamento": random.randint(5, 30) if tipo == "acidente_grave" else
                                    (random.randint(0, 3) if tipo == "acidente_leve" else 0),
            })
            seq += 1
    return ocorrencias


def main():
    PROCESSED.mkdir(parents=True, exist_ok=True)
    obras = carregar_obras()
    colaboradores = gerar_colaboradores(obras)
    producao, qualidade, faltas = gerar_producao_qualidade_faltas(obras, colaboradores)
    ocorrencias = gerar_seguranca(obras, colaboradores)

    obras_saida = [{k: v for k, v in o.items() if not k.startswith("_")} for o in obras]

    saidas = {
        "obras.json": obras_saida,
        "colaboradores.json": colaboradores,
        "producao.json": producao,
        "qualidade.json": qualidade,
        "faltas.json": faltas,
        "ocorrencias_seguranca.json": ocorrencias,
    }
    for nome, dados in saidas.items():
        with open(PROCESSED / nome, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        print(f"  {nome}: {len(dados)} registros")


if __name__ == "__main__":
    main()
