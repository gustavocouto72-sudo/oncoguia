# -*- coding: utf-8 -*-
"""Derivação MECÂNICA da composição estruturada a partir do TEXTO do `esquema`.

A pergunta que este arquivo responde: "que fármaco, em que dose, por que via, em que
dias do ciclo — segundo o texto que já está cadastrado?". Nada além do texto entra: nem
bula, nem o que 'costuma ser'. Onde o texto é ambíguo, oferece faixa ou oferece
alternativa, o item sai INDETERMINADO com nota — nunca com uma das opções escolhida.

Por que o parser é conservador de propósito: o consumidor deste dado é dinheiro
(frascos comprados, receita faturada). Um item errado não aparece como erro na tela —
aparece como um número plausível. Indeterminado aparece como "sem dado", que é visível.

Regras de INDETERMINADO por item:
  • sem dose no trecho do fármaco;
  • dose em faixa ("150-200 mg/m²") ou em alternativa ("8 → 6 mg/kg", "400/2.400 mg/m²");
  • mais de uma dose distinta no mesmo trecho ("200 mg ... ou 400 mg");
  • o mesmo fármaco citado duas vezes com doses diferentes;
  • frequência INTRA-DIÁRIA ou uso contínuo ("12/12h", "2x/dia", "mg/m²/dia",
    "continuamente") — a conta por ciclo precisaria de um nº de dias que o texto não dá.

Regras de INDETERMINADO por regime (bloco inteiro):
  • qualquer item indeterminado;
  • sigla de COMBINAÇÃO no texto ("AC", "FOLFOX", "TIP") — expandir escolheria doses;
  • termo GENÉRICO no lugar do fármaco ("quimioterapia", "inibidor de aromatase");
  • nenhum fármaco do léxico reconhecido.

`completa` (campo separado de `indeterminado`) é o sinal que o servidor usa para decidir
se pode calcular custo por insumo: só quando TODOS os itens estão resolvidos e nenhum
marcador de combinação/genérico ficou no texto.
"""
import re
import unicodedata

from lexico import CANONICO, COMBINACOES, GENERICOS, grafias

# Vocabulário FECHADO de unidade de dose. Fora desta lista, o item não nasce.
UNIDADES_VALIDAS = ["mg_m2", "mg_kg", "mg", "g", "g_m2", "mcg", "mcg_kg", "UI", "AUC", "GBq"]

VIAS_VALIDAS = ["EV", "VO", "SC", "IM", "IT", "IP", "intravesical"]


def norm(s):
    """Minúsculas, sem acento, com os símbolos que o texto usa reduzidos ao ASCII que o
    regex entende. Preserva o COMPRIMENTO onde é fácil, mas o parser não depende disso:
    todos os spans são calculados sobre o texto já normalizado."""
    s = (s or "")
    s = s.replace("²", "2").replace("³", "3")
    s = s.replace("–", "-").replace("—", "-").replace("×", "x").replace("−", "-")
    s = s.replace("≥", ">=").replace("≤", "<=")
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


# ---- número em pt-BR: 1.000 (milhar), 5,4 (decimal) --------------------------------
NUM = r"\d+(?:\.\d{3})*(?:,\d+)?"


def para_float(t):
    return float(t.replace(".", "").replace(",", "."))


# ---- unidades: (regex APÓS o número, unidade canônica) -----------------------------
# Ordem = do mais longo para o mais curto; 'mg' não pode ganhar de 'mg/m2'.
UNIDADES = [
    (r"mg\s*/\s*m2\s*/\s*(?:dia|d)\b", "mg_m2", True),
    (r"mg\s*/\s*m2\s*/\s*semana\b", "mg_m2", True),
    (r"mg\s*/\s*m2", "mg_m2", False),
    (r"mg\s*/\s*kg\s*/\s*(?:dia|d)\b", "mg_kg", True),
    (r"mg\s*/\s*kg", "mg_kg", False),
    (r"mcg\s*/\s*kg", "mcg_kg", False),
    (r"mcg\s*/\s*m2", "mcg", False),
    (r"g\s*/\s*m2", "g_m2", False),
    (r"mg\s*/\s*(?:dia|d)\b", "mg", True),
    (r"mg(?![a-z/])", "mg", False),
    (r"mcg(?![a-z])", "mcg", False),
    (r"ui(?![a-z])", "UI", False),
    (r"u(?![a-z])", "UI", False),
    (r"gbq(?![a-z])", "GBq", False),
    (r"g(?![a-z])", "g", False),
]

# "AUC 5" — a unidade vem ANTES do número (carboplatina). Tratada à parte por isso.
RE_AUC = re.compile(r"auc\s*(?P<expr>" + NUM + r"(?:\s*(?:-|a|ou|->|/)\s*" + NUM + r")*)")

RE_DOSE = re.compile(
    r"(?<![\d.,])(?P<expr>" + NUM + r"(?:\s*(?:-|a|ou|->|→|/)\s*" + NUM + r")*)\s*"
    r"(?P<un>" + "|".join("(?:%s)" % u[0] for u in UNIDADES) + r")"
)

RE_MULTI = re.compile(r"\s*(?:-|a|ou|->|→|/)\s*")

# Frequência intra-diária / uso contínuo: o texto não delimita quantos dias do ciclo.
RE_CONTINUO = re.compile(
    r"\b\d+\s*x\s*/\s*dia\b|\b\d+\s*/\s*\d+\s*h\b|/\s*dia\b|\bdiariamente\b|"
    r"\bcontinuamente\b|\bcontinuo\b|\bcontinua\b|\bvo\s*/\s*dia\b")

# Cadência SEMANAL sem os dias escritos: "Gemcitabina 1.000 mg/m² EV semanal x3 + 1
# semana de descanso" são TRÊS aplicações no ciclo de 28 dias, mas o texto não escreve
# D1,D8,D15. Ler como uma aplicação por ciclo compraria um terço dos frascos.
# "a cada 3 semanas" NÃO cai aqui de propósito — ali o intervalo é o do próprio ciclo.
RE_SEMANAL = re.compile(r"\bsemanal(?:mente)?\b|/\s*semana\b|\binstila")

# "dose única" — a droga entra uma vez no tratamento inteiro, não uma vez por ciclo
# (tremelimumabe no HIMALAYA). Multiplicar por ciclos inventaria doses que ninguém dá.
RE_DOSE_UNICA = re.compile(r"\bdose unica\b|\bdose-unica\b|\buma unica dose\b")

RE_DIAS = re.compile(r"\bd\s?(\d{1,2})\b")
RE_DIAS_FAIXA = re.compile(r"\bd\s?(\d{1,2})\s*(?:-|a|ate)\s*d?\s?(\d{1,2})\b")

RE_VIA = re.compile(r"\b(ev|vo|sc|im|it|ip|intravesical)\b")

# ALTERNÂNCIA ENTRE FÁRMACOS — o achado que mais mudou este parser. "Pembrolizumabe
# 200 mg 21/21d; ou Atezolizumabe 1.200 mg; ou Cemiplimabe 350 mg" tem três fármacos
# com dose limpa, e ler isso como COMBINAÇÃO triplicaria o custo do ciclo. O sinal está
# no texto ENTRE duas menções: "ou", "/" colado entre dois nomes, "±", "opcional".
RE_ALTERNANCIA = re.compile(r"\bou\b|\bopcional\b|±|\balternativ")
VIA_CANON = {"ev": "EV", "vo": "VO", "sc": "SC", "im": "IM", "it": "IT",
             "ip": "IP", "intravesical": "intravesical"}

# Alcance máximo do trecho de um fármaco. Sem teto, o último fármaco do texto herdaria
# tudo que vem depois (durações, comentários) e acharia dose onde não há.
JANELA_MAX = 200


def mencoes(t):
    """[(inicio, fim, canonico)] sobre o texto normalizado, casamento mais longo
    primeiro e sem sobreposição."""
    achados = []
    ocupado = [False] * len(t)
    for g, canon in grafias():
        for m in re.finditer(r"(?<![a-z0-9])" + re.escape(g) + r"(?![a-z])", t):
            i, f = m.span()
            if any(ocupado[i:f]):
                continue
            for k in range(i, f):
                ocupado[k] = True
            achados.append((i, f, canon))
    achados.sort()
    return achados


def dias_do_trecho(w):
    """Dias explícitos do ciclo no trecho. Faixa 'D1-D5' vira [1,2,3,4,5]; lista
    'D1, D8 e D15' vira [1,8,15]. Nada escrito -> None (não é o mesmo que [1])."""
    dias = set()
    resto = w
    for m in RE_DIAS_FAIXA.finditer(w):
        a, b = int(m.group(1)), int(m.group(2))
        if 1 <= a <= b <= 60:
            dias.update(range(a, b + 1))
    resto = RE_DIAS_FAIXA.sub(" ", w)
    for m in RE_DIAS.finditer(resto):
        v = int(m.group(1))
        if 1 <= v <= 60:
            dias.add(v)
    return sorted(dias) or None


def via_do_trecho(w):
    vias = {VIA_CANON[m.group(1)] for m in RE_VIA.finditer(w)}
    return vias.pop() if len(vias) == 1 else None


def doses_do_trecho(w):
    """[(valor|None, unidade, ambigua)] — todas as doses citadas no trecho.
    `ambigua` marca faixa/alternativa ('150-200', '8 -> 6', '400/2.400')."""
    out = []
    consumido = []
    for m in RE_AUC.finditer(w):
        partes = [p for p in RE_MULTI.split(m.group("expr")) if p]
        amb = len(partes) > 1
        out.append((None if amb else para_float(partes[0]), "AUC", amb))
        consumido.append(m.span())
    janela = list(w)
    for i, f in consumido:
        for k in range(i, f):
            janela[k] = " "
    janela = "".join(janela)
    for m in RE_DOSE.finditer(janela):
        un = None
        diario = False
        alvo = m.group("un")
        for pat, canon, dia in UNIDADES:
            if re.fullmatch(pat, alvo):
                un, diario = canon, dia
                break
        if un is None:
            continue
        partes = [p for p in RE_MULTI.split(m.group("expr")) if p]
        amb = len(partes) > 1
        out.append((None if amb else para_float(partes[0]), un, amb or diario))
    return out


def marcadores(t):
    """Siglas de combinação e termos genéricos presentes no texto — o que impede o
    bloco de ser considerado completo mesmo com todos os itens resolvidos."""
    combos = [nome for sigla, nome in COMBINACOES.items()
              if re.search(r"(?<![a-z0-9])" + re.escape(sigla) + r"(?![a-z0-9])", t)]
    gen = [g for g in GENERICOS if g in t]
    return combos, gen



def _fundir_por_farmaco(itens):
    """Colapsa menções repetidas do mesmo fármaco num item só. Ver comentário no
    chamador para os dois casos que isso separa."""
    ordem, grupos = [], {}
    for it in itens:
        if it["farmaco"] not in grupos:
            ordem.append(it["farmaco"])
            grupos[it["farmaco"]] = []
        grupos[it["farmaco"]].append(it)
    saida = []
    for canon in ordem:
        grupo = grupos[canon]
        if len(grupo) == 1:
            saida.append(grupo[0])
            continue
        dias = sorted({d for g in grupo for d in (g["dias_do_ciclo"] or [])}) or None
        vias = {g["via"] for g in grupo if g["via"]}
        via = vias.pop() if len(vias) == 1 else None
        doses = {(g["dose_valor"], g["dose_unidade"]) for g in grupo if not g["indeterminado"]}
        # Motivo de indeterminado que NÃO é "faltou dose ali" — faixa, alternativa,
        # uso contínuo: esse contamina o fármaco inteiro e não é curado por outra menção.
        duro = next((g["nota"] for g in grupo
                     if g["indeterminado"] and "dose não declarada" not in (g["nota"] or "")), None)
        if len(doses) > 1:
            nota = ("fármaco citado mais de uma vez no esquema com doses diferentes "
                    "(indução/manutenção ou alternativas)")
            valor = unidade = None
        elif duro:
            nota, valor, unidade = duro, None, None
        elif len(doses) == 1:
            valor, unidade = doses.pop()
            nota = None
        else:
            nota, valor, unidade = "dose não declarada no esquema para este fármaco", None, None
        saida.append({
            "farmaco": canon, "dose_valor": valor, "dose_unidade": unidade,
            "via": via, "dias_do_ciclo": dias,
            "indeterminado": valor is None, "nota": nota,
        })
    return saida

def compor(regime):
    """-> bloco `composicao` do regime (sem selo/fonte, que montar.py acrescenta)."""
    esq = regime.get("esquema") or ""
    t = norm(esq)
    ment = mencoes(t)
    combos, gen = marcadores(t)

    # Periodicidade JÁ AUDITADA do regime (check [9] do portão de dados a confere
    # contra o texto). Serve para uma coisa só aqui: separar "dia do ciclo" de
    # "dia do tratamento". "Cisplatina 100 mg/m² D1, D22, D43" num ciclo de 21 dias
    # não são três dias de um ciclo — são três ciclos escritos em contagem corrida, e
    # somá-los como se fossem do mesmo ciclo triplicaria os frascos do ciclo.
    per_auditada = (regime.get("expectativa_uso") or {}).get("periodicidade_dias")

    itens, notas = [], []
    if not ment:
        return {
            "itens": [],
            "completa": False,
            "indeterminado": True,
            "nota": "nenhum fármaco do léxico reconhecido no esquema"
                    + (f"; texto usa termo genérico ({', '.join(gen)})" if gen else "")
                    + (f"; sigla de combinação ({', '.join(combos)})" if combos else ""),
        }

    # Trecho de cada fármaco: até a próxima menção (ou JANELA_MAX).
    for k, (i, f, canon) in enumerate(ment):
        fim = ment[k + 1][0] if k + 1 < len(ment) else len(t)
        w = t[f:min(fim, f + JANELA_MAX)]
        doses = doses_do_trecho(w)
        continuo = bool(RE_CONTINUO.search(w))
        dias = dias_do_trecho(w)
        via = via_do_trecho(w)

        indet, nota = False, None
        if not doses:
            indet, nota = True, "dose não declarada no esquema para este fármaco"
        elif len({(d[0], d[1]) for d in doses}) > 1:
            indet, nota = True, ("mais de uma dose no mesmo trecho — o esquema oferece "
                                 "alternativas e escolher uma seria decisão nossa")
        elif doses[0][2]:
            indet, nota = True, ("dose em faixa/alternativa ou uso contínuo diário no "
                                 "esquema — sem número único por aplicação")
        elif continuo and not dias:
            indet, nota = True, ("frequência intra-diária/uso contínuo sem os dias do "
                                 "ciclo escritos — nº de aplicações por ciclo indefinido")
        elif continuo and dias:
            indet, nota = True, ("frequência intra-diária declarada (ex.: 12/12h) sobre "
                                 "os dias listados — doses por dia não escritas")
        elif RE_DOSE_UNICA.search(w):
            indet, nota = True, ("declarada como dose única no tratamento — não é dose "
                                 "por ciclo, e multiplicar por ciclos inventaria doses")
        elif RE_SEMANAL.search(w) and not dias:
            indet, nota = True, ("cadência semanal sem os dias do ciclo escritos — nº de "
                                 "aplicações por ciclo indefinido")
        elif dias and per_auditada and max(dias) > per_auditada:
            indet, nota = True, (f"dias escritos em contagem corrida do tratamento "
                                 f"(D{max(dias)}) e não do ciclo de {per_auditada} dias")

        itens.append({
            "farmaco": canon,
            "dose_valor": None if indet else doses[0][0],
            "dose_unidade": None if indet else doses[0][1],
            "via": via,
            "dias_do_ciclo": dias,
            "indeterminado": indet,
            "nota": nota,
        })

    # ---- um item por FÁRMACO ----------------------------------------------------
    # O mesmo fármaco aparece mais de uma vez por dois motivos bem diferentes, e a
    # fusão precisa distinguir:
    #   • APELIDO na sequência — "Trastuzumabe emtansina (TDM-1) 3,6 mg/kg": duas
    #     menções do MESMO fármaco, uma sem dose ao lado e outra com. Fundir é
    #     reconhecer que é a mesma droga, não escolher dose nenhuma.
    #   • DUAS FASES ou alternativas — "Nivolumabe 3 mg/kg ... seguido de Nivolumabe
    #     240 mg": duas doses distintas de verdade. Aí o item cai para indeterminado,
    #     porque qual delas usar é decisão que o texto não toma.
    itens = _fundir_por_farmaco(itens)

    # (A) ALTERNÂNCIA entre fármacos: o texto oferece escolha, não soma. Ver
    # RE_ALTERNANCIA. Só vale com dois ou mais fármacos citados — num regime de droga
    # única, "até progressão ou toxicidade" não é alternativa de fármaco.
    alternancia = []
    if len(ment) > 1:
        for k in range(len(ment) - 1):
            sep = t[ment[k][1]:ment[k + 1][0]]
            if RE_ALTERNANCIA.search(sep) or sep.strip() in ("/", "\\"):
                alternancia.append(f"{ment[k][2]} … {ment[k + 1][2]}")
    if alternancia:
        notas.append("o esquema oferece ALTERNATIVA entre fármacos (" +
                     "; ".join(alternancia[:3]) + ") — somar as doses seria ler escolha "
                     "como combinação")

    # (B) DIAS declarados para PARTE dos fármacos. "Nab-paclitaxel 125 mg/m² +
    # Gemcitabina 1.000 mg/m² D1,D8,D15": os dias vêm depois da gencitabina mas
    # governam as duas. Atribuí-los só a quem está ao lado daria 1 aplicação por ciclo
    # para o outro — três vezes menos frasco do que o real.
    resolvidos = [i for i in itens if not i["indeterminado"]]
    com_dias = [i for i in resolvidos if i["dias_do_ciclo"]]
    if len(resolvidos) > 1 and com_dias and len(com_dias) != len(resolvidos):
        notas.append("dias do ciclo escritos para parte dos fármacos (" +
                     ", ".join(i["farmaco"] for i in com_dias) + ") — o texto não diz se "
                     "valem para os demais")

    # (C) COBERTURA contra o bloco `farmacos` já cadastrado. Duas derivações do MESMO
    # texto discordando sobre quantas drogas há é motivo para não confiar em nenhuma:
    # fármaco fora do léxico (vitamina D, cálcio) sai invisível daqui, e invisível é o
    # modo de falha que ninguém vê na tela.
    n_farmacos = len(regime.get("farmacos") or [])
    cobertura_curta = n_farmacos > len(itens)
    if cobertura_curta:
        notas.append(f"cobertura curta: {len(itens)} item(ns) derivados para "
                     f"{n_farmacos} fármaco(s) cadastrados no regime")

    if combos:
        notas.append("sigla de combinação no esquema (" + ", ".join(combos) +
                     ") — as doses das drogas da sigla não estão escritas")
    if gen:
        notas.append("termo genérico no lugar do fármaco (" + ", ".join(gen) + ")")
    n_indet = sum(1 for it in itens if it["indeterminado"])
    if n_indet:
        notas.append(f"{n_indet} de {len(itens)} itens indeterminados")

    completa = (n_indet == 0) and not combos and not gen and not notas
    return {
        "itens": itens,
        "completa": completa,
        "indeterminado": not completa,
        "nota": "; ".join(notas) or None,
    }
