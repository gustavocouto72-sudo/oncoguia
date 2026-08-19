#!/usr/bin/env python3
"""
build-data.py — gera backend/data/evidencia.json a partir da saída do squad mbe-oncologia.

Por quê existe: o corpus de protocolos NÃO pode ser um arquivo estático público
(qualquer um baixaria tudo sem login). Este script empacota o output do squad num
JSON que o backend serve APENAS autenticado, em GET /api/evidencia (JWT).

Fonte de dados (ÚNICA, sem heurística):
  squads/mbe-oncologia/RUN_ATIVO  →  output/<run>/<versão>/regimes-consolidados.json

O run publicado é o que está escrito no RUN_ATIVO — este script NÃO descobre "o run
mais novo" sozinho e NÃO cai em fallback silencioso: RUN_ATIVO ausente/inválido é
ERRO. Promover um run novo = editar o RUN_ATIVO, rodar este script, reiniciar o
backend. (Já publicamos batch rejeitado por peças resolvendo run por conta própria.)

A interface NÃO é alterada por este script — ele só reempacota o JSON do squad.
Rode sempre que o squad gerar/atualizar o output:  python3 build-data.py
"""
import hashlib
import json
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = APP_DIR.parent
SQUAD_DIR = PROJECT_DIR / "squads" / "mbe-oncologia"
OUTPUT_DIR = SQUAD_DIR / "output"
BACKEND_DATA = PROJECT_DIR / "backend" / "data"
OUT = BACKEND_DATA / "evidencia.json"
# FONTE ÚNICA do run publicado: squads/mbe-oncologia/RUN_ATIVO (<run>/<versão>).
# Nada aqui resolve "o run mais novo" por heurística — já publicamos batch
# rejeitado 3x por peças resolvendo run por conta própria. Promover um run =
# editar o RUN_ATIVO, rodar este script e reiniciar o backend.
RUN_ATIVO_FILE = SQUAD_DIR / "RUN_ATIVO"


def resolve_run_ativo():
    """Lê o RUN_ATIVO (linhas '#' são comentário) e devolve o rel '<run>/<versão>'.
    Sem RUN_ATIVO válido, ERRO alto — nunca cair em heurística ou exemplo em silêncio."""
    if not RUN_ATIVO_FILE.is_file():
        sys.exit(f"[build-data] ERRO: {RUN_ATIVO_FILE} não existe. Crie-o com o run "
                 "publicado (ex.: 2026-07-22-refeito-completo/v1) — é a fonte única.")
    for line in RUN_ATIVO_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            return line
    sys.exit(f"[build-data] ERRO: {RUN_ATIVO_FILE} não tem nenhuma linha de run.")


def load_source():
    rel = resolve_run_ativo()
    f = OUTPUT_DIR / rel / "regimes-consolidados.json"
    if not f.is_file():
        sys.exit(f"[build-data] ERRO: RUN_ATIVO aponta '{rel}' mas {f} não existe. "
                 "Corrija o RUN_ATIVO — não publico outro run no lugar.")
    return f, json.loads(f.read_text(encoding="utf-8")), "squad"


# =========================================================================
# TEMPORALIDADE DOS CAMPOS PRIMITIVOS (flag `estavel`)
# -------------------------------------------------------------------------
# estavel:true  = biologia do tumor que NÃO muda no tempo (histologia, subtipo
#   molecular, invasão linfovascular, risco IGCCCG, HER2/RH, grau, mutações).
#   A app pré-preenche E TRAVA esses campos na reavaliação (correção só via
#   "corrigir dado estável", p.ex. re-biópsia).
# estavel:false = estado clínico DINÂMICO (estadio, performance status, exames,
#   linha de tratamento, peso). Pré-preenchidos e editáveis a cada reavaliação.
#
# Isto é APENAS temporalidade — não altera nenhuma regra de elegibilidade nem
# o motor evalExpr. Classificação por nome do campo (padrões conhecidos) com
# fallback pela `secao`; o desconhecido cai em dinâmico (false), o lado seguro
# (nunca travar um dado do qual não temos certeza).
# =========================================================================
_ESTAVEL_PATTERNS = (
    "histolog", "subtipo", "molecular", "mutac", "brca", "her2", "receptor",
    "hormonal", "invasao_linfovascular", "linfovascular", "igcccg", "gleason",
    "msi", "mmr", "biomarcador", "imuno", "ki67", "pdl1", "pd_l1", "grau",
)
_DINAMICO_PATTERNS = (
    "estadio", "estadiamento", "tstage", "nstage", "mstage", "metast",
    "cenario", "linha", "ecog", "performance", "karnofsky", "peso", "altura",
    "imc", "clcr", "creatinina", "feve", "psa", "hemoglobina", "plaqueta",
    "bilirrubina", "albumina", "exame", "sintoma", "crise", "resposta",
)


def _classifica_estavel(campo, secao):
    nome = str(campo or "").strip().lower()
    if any(p in nome for p in _DINAMICO_PATTERNS):
        return False
    if any(p in nome for p in _ESTAVEL_PATTERNS):
        return True
    # T/N/M isolados (estadiamento) são dinâmicos
    if nome in ("t", "n", "m", "node", "estadio"):
        return False
    sec = str(secao or "").strip().lower()
    if "biolog" in sec:
        return True
    if any(k in sec for k in ("estadi", "context", "clinic", "laborat", "exame")):
        return False
    return False  # desconhecido → dinâmico (não travar sem certeza)


def _resolve_campos_primitivos_por_tumor():
    """Varre APENAS o run ativo (RUN_ATIVO) e devolve {tumor: [campos_primitivos]},
    com o flag `estavel` já anexado a cada campo.

    Um campo_primitivo não carrega o tumor; associamos pelo `tumor` dos regimes do
    mesmo arquivo (um tumor por lote na re-extração). Antes isto varria todos os
    runs ("o mais novo vence" por tumor) — o que podia misturar dado de run
    rejeitado no corpus publicado; agora só o run ativo alimenta a app."""
    run_dir = OUTPUT_DIR / resolve_run_ativo().split("/")[0]
    if not run_dir.is_dir():
        return {}
    por_tumor = {}
    for run in [run_dir]:
        for f in run.rglob("regimes-*.json"):
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
            except Exception:
                continue
            if not isinstance(d, dict):
                continue
            campos = d.get("campos_primitivos")
            if not campos:
                continue
            tumores = sorted({r.get("tumor") for r in d.get("regimes", []) if r.get("tumor")})
            for t in tumores:
                if t in por_tumor:
                    continue  # run mais novo já definiu
                por_tumor[t] = [
                    {**c, "estavel": _classifica_estavel(c.get("campo"), c.get("secao"))}
                    for c in campos
                ]
    return por_tumor


def anexar_campos_primitivos(payload):
    """Anexa `campos_primitivos` como dict por tumor (com `estavel`) ao payload.

    Só emite para tumores que TAMBÉM têm `elegibilidade.regra` em algum regime do
    payload — assim a app liga a elegibilidade computável apenas onde há regra, sem
    trocar o caminho legado (ex.: mama) por um vazio. Aditivo e sem regressão."""
    tumores_com_regra = {
        r.get("tumor")
        for r in payload.get("regimes", [])
        if (r.get("elegibilidade") or {}).get("regra")
    }
    todos = _resolve_campos_primitivos_por_tumor()
    emit = {t: campos for t, campos in todos.items() if t in tumores_com_regra}
    if emit:
        payload["campos_primitivos"] = emit
    return payload


def merge_elegibilidade_computavel(src_path, payload):
    """Traz `campos_primitivos` (vocabulário do tumor) + `elegibilidade` (regra/criterios)
    para o payload que a app consome.

    O consolidado (regimes-consolidados.json) ainda não carrega esses campos — eles nascem
    na re-extração (regimes-extraidos.json, mesmo run/versão). Enquanto o resto do pipeline não
    os propaga, este merge os anexa a partir do irmão `regimes-extraidos.json`, casando por
    `regimen_id`. Se o consolidado JÁ os tiver, mantém os do consolidado. Se o irmão não existir,
    não faz nada — a app cai no fallback e avisa (não inventa regra).
    """
    if payload.get("campos_primitivos") and all(
        "elegibilidade" in r for r in payload.get("regimes", [])
    ):
        return payload  # consolidado já é auto-suficiente

    extraidos = src_path.parent / "regimes-extraidos.json"
    if not extraidos.is_file():
        return payload
    try:
        ext = json.loads(extraidos.read_text(encoding="utf-8"))
    except Exception:
        return payload

    if not payload.get("campos_primitivos") and ext.get("campos_primitivos"):
        payload["campos_primitivos"] = ext["campos_primitivos"]

    elig_by_id = {r.get("regimen_id"): r.get("elegibilidade")
                  for r in ext.get("regimes", []) if r.get("elegibilidade")}
    for r in payload.get("regimes", []):
        if "elegibilidade" not in r and r.get("regimen_id") in elig_by_id:
            r["elegibilidade"] = elig_by_id[r["regimen_id"]]
    return payload


def anexar_vigilancia_candidatos(src_path, payload):
    """Anexa `vigilancia_candidatos` ao payload a partir do irmão do consolidado.

    Restaura o "motivo NOVIDADE" da Mesa aposentada: os candidatos da vigilância
    (ensaios que podem mudar uma linha/protocolo) voltam a alimentar a Revisão
    clínica. Prefere `vigilancia-candidatos.json` (formato novo, sem regimen_id) e
    cai em `candidatos-atualizacao.json` (formato antigo, com regimen_id). Aditivo:
    só acrescenta uma chave — não toca em selo, verificação nem dado do regime.
    """
    if src_path is None:
        return payload
    for nome in ("vigilancia-candidatos.json", "candidatos-atualizacao.json"):
        f = src_path.parent / nome
        if not f.is_file():
            continue
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        cands = d.get("candidatos") if isinstance(d, dict) else d
        if isinstance(cands, list) and cands:
            payload["vigilancia_candidatos"] = cands
            break
    return payload


def content_hash(regime):
    """Hash estável do CONTEÚDO revisável do regime: selo + eixos (verificação) +
    referência + regra de elegibilidade. Muda quando a vigilância/squad re-derivar
    qualquer um desses — assim uma revisão gravada nesse hash "expira" sozinha e o
    protocolo volta a pendente_re_revisao. Não depende de campos voláteis (datas,
    histórico, ordem de chaves)."""
    v = regime.get("verificacao") or {}
    eixos = {}
    for ax in ("grade", "esmo_mcbs", "nccn_affordability", "elegibilidade"):
        a = v.get(ax) or {}
        eixos[ax] = {
            "status": a.get("status"),
            "valor_rederivado": a.get("valor_rederivado"),
            "afirmado_protocolo": a.get("afirmado_protocolo"),
            "amplitude": a.get("amplitude"),
            "fonte": a.get("fonte"),
        }
    ref = regime.get("referencia") or {}
    alvo = {
        "selo": ((regime.get("consolidacao") or {}).get("selo_confianca")),
        "eixos": eixos,
        "referencia": {
            "doi": ref.get("doi"),
            "estudo": ref.get("estudo"),
            "ano": ref.get("ano"),
            "primeiro_autor": ref.get("primeiro_autor"),
            "pivos": ref.get("pivos"),
        },
        "regra_elegibilidade": ((regime.get("elegibilidade") or {}).get("regra")),
    }
    blob = json.dumps(alvo, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def anexar_content_hash(payload):
    """Adiciona content_hash a cada regime e emite o sidecar content-hashes.json
    (regimen_id → content_hash) que o backend lê para o /revisoes/resumo — sem
    duplicar a lógica de hash no backend."""
    mapa = {}
    for r in payload.get("regimes", []):
        h = content_hash(r)
        r["content_hash"] = h
        rid = r.get("regimen_id")
        if rid:
            mapa[rid] = h
    (BACKEND_DATA / "content-hashes.json").write_text(
        json.dumps({"gerado_em": None, "hashes": mapa}, ensure_ascii=False, indent=0),
        encoding="utf-8",
    )
    return payload


def main():
    BACKEND_DATA.mkdir(parents=True, exist_ok=True)
    src_path, data, kind = load_source()
    # Normaliza para sempre expor { regimes: [...], _source: ... }
    if isinstance(data, list):
        payload = {"regimes": data}
    elif isinstance(data, dict) and "regimes" in data:
        payload = data
    else:
        # objeto com regimes soltos? empacota o que houver como lista de valores
        payload = {"regimes": list(data.values()) if isinstance(data, dict) else []}

    payload = dict(payload)
    if kind == "squad":
        payload = merge_elegibilidade_computavel(src_path, payload)
    # Temporalidade: campos_primitivos por tumor com flag `estavel` (biologia x estado clínico).
    payload = anexar_campos_primitivos(payload)
    # content_hash por regime (revisão clínica ancora nele) + sidecar para o backend.
    payload = anexar_content_hash(payload)
    # Candidatos da vigilância (motivo NOVIDADE da Revisão clínica) — irmão do consolidado.
    if kind == "squad":
        payload = anexar_vigilancia_candidatos(src_path, payload)
    cp = payload.get("campos_primitivos") or {}
    n_prim = sum(len(v) for v in cp.values()) if isinstance(cp, dict) else len(cp)
    n_elig = sum(1 for r in payload.get("regimes", []) if r.get("elegibilidade"))
    n_vig = len(payload.get("vigilancia_candidatos") or [])
    payload["_source"] = {
        "kind": kind,
        "path": str(src_path.relative_to(PROJECT_DIR)),
        "regimes_count": len(payload.get("regimes", [])),
    }

    BACKEND_DATA.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    n = payload["_source"]["regimes_count"]
    print(f"[build-data] fonte: {kind} ({src_path.relative_to(PROJECT_DIR)})")
    print(f"[build-data] {n} regime(s) → {OUT.relative_to(PROJECT_DIR)}")
    print(f"[build-data] elegibilidade computável: {n_prim} campo(s) primitivo(s), {n_elig} regime(s) com regra.")
    print(f"[build-data] vigilância: {n_vig} candidato(s) (motivo NOVIDADE da Revisão clínica).")
    if kind == "squad" and n_prim == 0:
        print("[build-data] AVISO: sem campos_primitivos (squad não re-extraído) — a app usará o fallback de elegibilidade.")


if __name__ == "__main__":
    sys.exit(main())
