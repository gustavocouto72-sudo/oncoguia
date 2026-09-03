# -*- coding: utf-8 -*-
"""Regras mecânicas de expectativa_uso a partir do `esquema` já cadastrado.
Só decide o que o texto permite decidir; o resto sai como indeterminado
(ou é resolvido por override curado à mão)."""
import re, unicodedata

def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")

PERIOD = [
    (r"a cada (\d+)\s*dias", lambda m: int(m.group(1))),
    (r"a cada (\d+)\s*sem(?:anas?)?\b", lambda m: int(m.group(1)) * 7),
    (r"a cada (\d+)\s*meses", lambda m: int(m.group(1)) * 30),
    (r"\b(\d+)\s*em\s*\1\s*dias", lambda m: int(m.group(1))),
    (r"\b(\d+)/\1\s*d\b", lambda m: int(m.group(1))),
    (r"\b(\d+)/\1\s*dias", lambda m: int(m.group(1))),
    (r"\b(\d+)/\1\s*sem(?:anas?)?\b", lambda m: int(m.group(1)) * 7),
    (r"ciclos?\s*de\s*(\d+)\s*dias", lambda m: int(m.group(1))),
    (r"mg/(\d+)\s*sem", lambda m: int(m.group(1)) * 7),
    (r"\bsemanal(?:mente)?\b", lambda m: 7),
    (r"/\s*semana\b", lambda m: 7),
]

def periodicidades(txt):
    t = norm(txt)
    vals = []
    for pat, fn in PERIOD:
        for m in re.finditer(pat, t):
            v = fn(m)
            if 1 <= v <= 180 and v not in vals:
                vals.append(v)
    return sorted(vals)

CICLOS_RANGE = [r"[x×]\s*(\d+)\s*(?:a|-|–|ou)\s*(\d+)\s*ciclos", r"\b(\d+)\s*(?:a|-|–)\s*(\d+)\s*ciclos"]
CICLOS_UNIC = [r"[x×]\s*(\d+)\s*ciclos", r"\b(\d+)\s*ciclos", r"por\s*(\d+)\s*ciclos", r"[x×](\d+)\b"]

def ciclos(txt):
    """-> (n_unico, faixa (lo,hi), flag)"""
    t = norm(txt)
    if re.search(r"ate\s*(\d+)\s*ciclos", t) or re.search(r"por ate\s*(\d+)", t):
        m = re.search(r"ate\s*(\d+)\s*ciclos", t)
        return None, None, ("teto", int(m.group(1)) if m else None)
    faixas = set()
    for pat in CICLOS_RANGE:
        for m in re.finditer(pat, t):
            a, b = int(m.group(1)), int(m.group(2))
            faixas.add((min(a, b), max(a, b)))
    t2 = t
    for pat in CICLOS_RANGE:
        t2 = re.sub(pat, " ", t2)
    # posições, não valores: "4 ciclos de AC -> 4 ciclos de docetaxel" são DUAS fases
    # chave = span do NÚMERO (não do match): dois padrões que pegam a mesma
    # ocorrência ("× 4 ciclos") têm o mesmo span de número e contam uma vez só.
    pos = {}
    for pat in CICLOS_UNIC:
        for m in re.finditer(pat, t2):
            pos.setdefault(m.span(1), int(m.group(1)))
    n_oc = len(pos)
    if faixas and not n_oc:
        return (None, sorted(faixas)[0], None) if len(faixas) == 1 else (None, None, ("faixas_multiplas", sorted(faixas)))
    if n_oc and not faixas:
        if n_oc == 1:
            return list(pos.values())[0], None, None
        return None, None, ("fases_multiplas", sorted(pos.items()))
    if n_oc and faixas:
        return None, None, ("misto", sorted(pos.items()), sorted(faixas))
    return None, None, None

DUR = [
    (r"(?:por|durante|de|[-–])\s*(\d+)\s*anos?\b", lambda m: int(m.group(1)) * 52),
    (r"(?:por|durante|de|[-–])\s*(\d+)\s*meses\b", lambda m: round(int(m.group(1)) * 30.44 / 7)),
    (r"(?:por|durante)\s*(\d+)\s*semanas\b", lambda m: int(m.group(1))),
]

DUR_FAIXA = r"(\d+)\s*(?:a|-|–|ou)\s*(\d+)\s*(anos?|meses|semanas)\b"

def duracoes(txt):
    """-> (lista de durações únicas em semanas, houve_faixa)"""
    t = norm(txt)
    faixa = bool(re.search(DUR_FAIXA, t))
    t2 = re.sub(DUR_FAIXA, " ", t)          # faixa não vira número único
    vals = []
    for pat, fn in DUR:
        for m in re.finditer(pat, t2):
            v = fn(m)
            if v not in vals:
                vals.append(v)
    return sorted(vals), faixa

AP = ["ate progressao", "ate a progressao", "ate progressao/toxicidade", "ate toxicidade",
      "continuo", "continua", "continuamente", "manutencao"]

def sinal_ap(txt):
    t = norm(txt)
    return [s for s in AP if s in t]

CURATIVO = {"adjuvancia", "neoadjuvancia", "localizado", "localmente-avancado"}

def propor(reg):
    """Proposta mecânica. tipo/indeterminado/campos + rastro do porquê."""
    esq = reg.get("esquema") or ""
    cen = reg.get("cenario")
    per = periodicidades(esq)
    cic, faixa, cflag = ciclos(esq)
    dur, dur_faixa = duracoes(esq)
    ap = sinal_ap(esq)
    tr = {"periodicidades": per, "ciclos": cic, "faixa": faixa, "flag": cflag,
          "duracoes_sem": dur, "duracao_em_faixa": dur_faixa, "sinais_ap": ap}
    if ap:
        return {"tipo": "ate_progressao", "motivo": "sinal_ate_progressao_no_esquema"}, tr
    if cic is not None and len(per) == 1:
        return {"tipo": "fixa", "ciclos": cic, "periodicidade_dias": per[0],
                "duracao_total_semanas": round(cic * per[0] / 7, 1),
                "fonte": "esquema", "motivo": "ciclos+periodicidade unicos"}, tr
    if dur_faixa:
        return {"tipo": "indefinido", "motivo": "duracao declarada em faixa"}, tr
    if not cic and len(dur) == 1 and len(per) == 1 and cen in CURATIVO:
        n = round(dur[0] * 7 / per[0])
        # duração total = ciclos x periodicidade (mantém a aritmética fechada);
        # a duração declarada no esquema fica registrada na nota.
        return {"tipo": "fixa", "ciclos": n, "periodicidade_dias": per[0],
                "duracao_total_semanas": round(n * per[0] / 7, 1), "fonte": "esquema",
                "nota": f"nº de ciclos derivado da duração declarada no esquema "
                        f"(~{dur[0]} semanas) dividida pela periodicidade de {per[0]} dias",
                "motivo": f"duracao {dur[0]} sem / periodicidade {per[0]}d -> {n} ciclos"}, tr
    if not cic and len(dur) == 1 and not per:
        return {"tipo": "fixa", "ciclos": None, "periodicidade_dias": None,
                "duracao_total_semanas": dur[0], "fonte": "esquema",
                "motivo": "duracao total declarada, sem ciclos (uso continuo)"}, tr
    return {"tipo": "indefinido", "motivo": "esquema nao resolve"}, tr
