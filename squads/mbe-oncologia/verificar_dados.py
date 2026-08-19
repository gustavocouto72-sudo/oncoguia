#!/usr/bin/env python3
"""
Portão de verificação de DADOS do OncoGuia.
Roda os invariantes mecânicos sobre a saída do squad — sem depender do
self-report do agente. Um confirmado só é confirmado se sobrevive a estes checks.

Uso:
    python3 verificar_dados.py [arquivo-ou-pasta] [--check-dois]

    (sem caminho)       valida a PASTA do run ativo (RUN_ATIVO) — consolidado
                        publicado + campos_primitivos por tumor (check de órfãos roda).
    <arquivo-ou-pasta>  um regimes-consolidados.json específico, OU uma pasta
                        (busca recursiva; dedupe com o agregado como canônico).
                        Caminho fora do run ativo imprime ATENÇÃO.
    --check-dois        além dos checks offline, resolve cada DOI de confirmado
                        no registro Crossref (200 vs 404). Usa rede; mais lento.

Saída: relatório por check. Exit code 0 = passou tudo; 1 = algum FALHOU.
Trate exit!=0 como "NÃO confie neste lote — volta pro agente".

------------------------------------------------------------------
Getters afinados ao schema do squad mbe-oncologia (2026-07):
  - selo:            regime.consolidacao.selo_confianca
  - doi:             regime.referencia.doi
  - regra:           regime.elegibilidade.regra   (JSON-logic: and/or/not/eq/...)
  - custo:           regime.verificacao.nccn_affordability
  - campos válidos:  campos_primitivos NO TOPO DO ARQUIVO (por tumor),
                     mapeados tumor -> {campos} no load e consultados por regime.
Duplicatas (ex.: um agregado v1 que repete todos os tumores) são removidas
por regimen_id no load, então apontar para a pasta inteira é seguro.
------------------------------------------------------------------
"""
import sys, os, json, re, glob, time

# ---- estado de load: mapa tumor -> conjunto de campos válidos -----
TUMOR_CAMPOS = {}

# ---- CONFIG: caminhos de campo (com fallbacks) --------------------
def get_selo(r):
    return (r.get("consolidacao", {}).get("selo_confianca")
            or r.get("consolidacao", {}).get("selo")
            or r.get("selo_confianca") or r.get("selo"))

def get_doi(r):
    ref = r.get("referencia", {}) or {}
    return ref.get("doi") or r.get("doi")

def get_tumor(r):
    return r.get("tumor") or r.get("sistema_tumor") or "??"

def get_id(r):
    return r.get("regimen_id") or r.get("id") or "??"

def get_rule(r):
    el = r.get("elegibilidade", {}) or {}
    return el.get("regra") or el.get("rule")

def get_primitivos(r):
    # campos_primitivos vive no topo do arquivo (por tumor); resolvido no load.
    campos = TUMOR_CAMPOS.get(get_tumor(r))
    return list(campos) if campos else None

def get_custo_verif(r):
    # custo do squad = bloco NCCN affordability dentro de verificacao.
    return (r.get("verificacao", {}) or {}).get("nccn_affordability", {}) or {}

def campos_from_file(data):
    """Extrai os nomes de campo de campos_primitivos no topo do arquivo."""
    cp = data.get("campos_primitivos") if isinstance(data, dict) else None
    if not cp:
        return None
    out = []
    if isinstance(cp, dict):
        return list(cp.keys())
    for x in cp:
        if isinstance(x, dict):
            out.append(x.get("campo") or x.get("nome"))
        else:
            out.append(x)
    return [x for x in out if x]

# ---- helpers ------------------------------------------------------
COMPARE_OPS = {"eq", "ne", "gt", "gte", "lt", "lte", "in"}
ORDINAL_OPS = {"gt", "gte", "lt", "lte"}
STAGING_RE = re.compile(r"^(T[0-4isa-d]|N[0-3a-c]|M[01a-c]|I{1,3}V?|IV|V)[A-C]?\d?$", re.I)

def walk_rule(rule, fields, ordinal, refs):
    if not isinstance(rule, dict):
        return
    for op, val in rule.items():
        if op in ("and", "or") and isinstance(val, list):
            for sub in val:
                walk_rule(sub, fields, ordinal, refs)
        elif op == "not":
            walk_rule(val, fields, ordinal, refs)
        elif op == "ref":
            refs.add(val)
        elif op in COMPARE_OPS and isinstance(val, list) and val and isinstance(val[0], str):
            fields.add(val[0])
            if op in ORDINAL_OPS and len(val) > 1:
                ordinal.append((val[0], val[1]))

def normalize(data):
    """Devolve lista plana de regimes a partir de formatos variados."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ("regimes", "regimens", "protocolos"):
            if isinstance(data.get(k), list):
                return data[k]
        flat = []
        looks_grouped = all(isinstance(v, list) for v in data.values()) and data
        if looks_grouped:
            for v in data.values():
                flat.extend(v)
            return flat
        return [data]
    return []

# Duplicatas cujo CONTEÚDO difere da versão mantida no dedupe (por-tumor ≠ agregado
# publicado): fonte dupla inconsistente — vira FALHA no veredito (check [8]).
DUP_DIVERGENTES = []

def load_all(path):
    del DUP_DIVERGENTES[:]
    files = []
    if os.path.isdir(path):
        files = glob.glob(os.path.join(path, "**", "regimes-consolidados.json"), recursive=True)
        if not files:
            files = glob.glob(os.path.join(path, "**", "*.json"), recursive=True)
    else:
        files = [path]

    entries = []
    for f in files:
        try:
            with open(f, encoding="utf-8") as fh:
                data = json.load(fh)
        except Exception as e:
            print(f"  ! erro lendo {f}: {e}")
            continue
        regimes = normalize(data)
        # mapa tumor -> campos válidos, a partir de arquivos de um único tumor
        campos = campos_from_file(data)
        if campos:
            tumores = {r.get("tumor") for r in regimes if isinstance(r, dict)}
            tumores.discard(None)
            if len(tumores) == 1:                       # arquivo por-tumor
                TUMOR_CAMPOS.setdefault(next(iter(tumores)), set()).update(campos)
        entries.append((f, regimes))

    # dedupe por regimen_id, com o AGREGADO PUBLICADO como canônico: o arquivo com
    # mais tumores entra primeiro (ordem alfabética deixaria o por-tumor vencer, e
    # um conserto aplicado só no agregado seria validado na versão velha por-tumor).
    # Duplicata que diverge do mantido é registrada em DUP_DIVERGENTES → FALHA.
    def n_tumores(regs):
        return len({r.get("tumor") for r in regs if isinstance(r, dict)} - {None})
    entries.sort(key=lambda e: (-n_tumores(e[1]), e[0]))

    seen, regimes = {}, []
    dups = 0
    for f, regs in entries:
        for r in regs:
            rid = get_id(r)
            if rid in seen:
                dups += 1
                if json.dumps(r, sort_keys=True) != json.dumps(seen[rid], sort_keys=True):
                    DUP_DIVERGENTES.append(rid)
                continue
            seen[rid] = r
            regimes.append(r)
    if dups:
        print(f"  (dedupe: {dups} duplicata(s) removida(s) por regimen_id — o agregado publicado é o canônico)")
    return regimes, [f for f, _ in entries]

def resolve_doi(doi, timeout=12):
    # Valida no REGISTRO (Crossref), não seguindo o redirect do doi.org até o
    # publisher — publishers (NEJM, JCO, ...) bloqueiam o bot com 403/paywall,
    # o que faria DOIs válidos parecerem mortos. Crossref: 200 = registrado,
    # 404 = inexistente. Etiqueta Crossref pede User-Agent com mailto.
    import urllib.request, urllib.error
    url = "https://api.crossref.org/works/" + doi.strip()
    req = urllib.request.Request(
        url, method="HEAD",
        headers={"User-Agent": "oncoguia-gate/1 (mailto:gustavocouto72@gmail.com)"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status < 400
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False        # DOI não registrado -> morto de verdade
        return None             # 403/429/5xx -> indeterminado, não condena
    except Exception:
        return None             # rede indeterminada

# ---- fonte única: RUN_ATIVO ---------------------------------------
# O run publicado é o que está em squads/mbe-oncologia/RUN_ATIVO (mesma constante
# que o app/build-data.py usa). Sem argumento, o portão valida ELE. Com argumento
# apontando para outro run, o portão avisa em alto e bom som — validar um run que
# não é o publicado já causou diagnóstico em corpus rejeitado (3x).
SQUAD_DIR = os.path.dirname(os.path.abspath(__file__))
RUN_ATIVO_FILE = os.path.join(SQUAD_DIR, "RUN_ATIVO")

def run_ativo_rel():
    try:
        with open(RUN_ATIVO_FILE, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#"):
                    return line
    except FileNotFoundError:
        pass
    return None

# ---- checks -------------------------------------------------------
def main():
    args = [a for a in sys.argv[1:] if a != "--check-dois"]
    check_dois = "--check-dois" in sys.argv
    rel = run_ativo_rel()
    ativo = os.path.join(SQUAD_DIR, "output", rel, "regimes-consolidados.json") if rel else None
    run_root = os.path.join(SQUAD_DIR, "output", rel.split("/")[0]) if rel else None
    if args:
        path = args[0]
    else:
        if not ativo or not os.path.exists(ativo):
            print(f"ERRO: RUN_ATIVO ausente/inválido ({RUN_ATIVO_FILE} -> {rel}). "
                  "Sem argumento, o portão valida o run ativo — corrija o RUN_ATIVO "
                  "ou passe um caminho explícito."); sys.exit(2)
        # A PASTA do run, não só o consolidado: assim os campos_primitivos por tumor
        # entram no load e o check [4] (órfãos) roda em vez de dar SKIP. O dedupe
        # mantém o agregado publicado como canônico (ver load_all).
        path = run_root

    regimes, files = load_all(path)
    if not regimes:
        print("Nenhum regime carregado. Confira o caminho."); sys.exit(2)

    print(f"= Portão de dados — {len(regimes)} regimes de {len(files)} arquivo(s) =")
    print(f"= Corpus: {os.path.abspath(path)}")
    if run_root and not os.path.abspath(path).startswith(os.path.abspath(run_root)):
        print(f"\n!!! ATENÇÃO: este caminho NÃO é o RUN_ATIVO ({rel}). Você está validando")
        print("!!! um corpus que NÃO é o publicado — o veredito não vale para o que está no ar.")
    print()
    fails, warns = [], []

    placar = {}
    por_tumor = {}
    for r in regimes:
        s = (get_selo(r) or "??").lower()
        placar[s] = placar.get(s, 0) + 1
        t = get_tumor(r)
        por_tumor.setdefault(t, {}).setdefault(s, 0)
        por_tumor[t][s] += 1
    print("Placar:", " · ".join(f"{k}={v}" for k, v in sorted(placar.items())))
    print(f"Tumores: {len(por_tumor)}\n")

    # 1) confirmado precisa de DOI não-vazio
    sem_doi = [get_id(r) for r in regimes
               if (get_selo(r) or "").lower() == "confirmado" and not get_doi(r)]
    if sem_doi:
        fails.append(("confirmado sem DOI", sem_doi))
    else:
        print("✓ [1] Nenhum confirmado com DOI ausente.")

    # 2) incompleto>0 por tumor (WARN, não bloqueia)
    zero_inc = [t for t, d in por_tumor.items() if d.get("incompleto", 0) == 0]
    if zero_inc:
        warns.append(("tumores com 0 incompletos (olhe se é honesto)", zero_inc))
    else:
        print("✓ [2] Todo tumor tem incompleto > 0.")

    # 3) custo que "confirma" o protocolo precisa de afirmação/fonte;
    #    senão deveria ser estimativa (honestidade do NCCN affordability).
    custo_bug = []
    for r in regimes:
        c = get_custo_verif(r)
        st = (c.get("status") or "").lower()
        fonte = c.get("fonte") or c.get("referencia")
        afirmado = c.get("afirmado_protocolo")
        if st in ("confirmado", "concorda") and not (fonte or afirmado):
            custo_bug.append(get_id(r))
    if custo_bug:
        fails.append(("custo 'confirmado' sem afirmação/fonte (deveria ser estimativa)", custo_bug))
    else:
        print("✓ [3] Nenhum custo confirmado sem lastro (todos coerentes).")

    # 4) campos órfãos (regra referencia campo fora de campos_primitivos)
    if not TUMOR_CAMPOS:
        print("~ [4] SKIP órfãos: campos_primitivos não encontrado (arquivo por-tumor ausente).")
    else:
        orfaos, sem_vocab = [], set()
        for r in regimes:
            rule = get_rule(r)
            if not rule:
                continue
            valid = TUMOR_CAMPOS.get(get_tumor(r))
            if valid is None:
                # tumor sem campos_primitivos carregados: não dá para julgar órfão —
                # não inventa falha, mas também não passa em silêncio (WARN nominal).
                sem_vocab.add(get_tumor(r))
                continue
            fields, ordinal, refs = set(), [], set()
            walk_rule(rule, fields, ordinal, refs)
            for f in fields:
                if f not in valid and f not in refs:
                    orfaos.append(f"{get_id(r)}:{f}")
        if sem_vocab:
            warns.append(("tumores com regra mas SEM vocabulário (campos_primitivos ausentes do load — órfãos não checados)", sorted(sem_vocab)))
        if orfaos:
            fails.append(("campos órfãos (regra -> campo inexistente)", orfaos))
        else:
            print(f"✓ [4] Zero campos órfãos{' (nos tumores com vocabulário)' if sem_vocab else ''}.")

    # 5) comparações ordinais de estadiamento -> confirmar mapa
    staging_cmp = []
    for r in regimes:
        rule = get_rule(r)
        if not rule:
            continue
        fields, ordinal, refs = set(), [], set()
        walk_rule(rule, fields, ordinal, refs)
        for campo, valor in ordinal:
            if isinstance(valor, str) and STAGING_RE.match(valor):
                staging_cmp.append(f"{get_id(r)}: {campo} vs {valor}")
    if staging_cmp:
        warns.append(("comparações ordinais de estadiamento — confirme que usam o mapa canônico", staging_cmp))
    else:
        print("✓ [5] Nenhuma comparação ordinal de estadiamento crua detectada.")

    # 7) contrato de incorporação/refutação: refutado NÃO some — fica marcado e visível.
    #    - campo legado `removido` é proibido (aposentado: rejeição clínica não apaga);
    #    - `incorporacao` explícita (Step 08, ação refutar) precisa ser consistente:
    #      motivo na taxonomia, flag `nao_incorporado` nos DOIS lugares que o app lê
    #      (consolidacao.flags e flags top-level) e, se refutado por revisor,
    #      nota_revisao + revisor + data presentes.
    #    A soma-invariante (total = candidatos + não incorporados) é reportada.
    MOTIVOS_INCORP = {"refutado", "indisponivel", "evidencia_insuficiente", "custo"}
    inc_bug, removidos_legado = [], []
    n_nao_inc = 0
    for r in regimes:
        if "removido" in r:
            removidos_legado.append(get_id(r))
        inc = r.get("incorporacao") or {}
        flags_top = [str(f) for f in (r.get("flags") or [])]
        flags_cons = [str(f) for f in (r.get("consolidacao", {}).get("flags") or [])]
        tem_flag = lambda fl: any(re.match(r"^nao_(incorporad|inclu)", f, re.I) for f in fl)
        eh_nao_inc = (inc.get("status") == "nao_incorporado" or tem_flag(flags_top)
                      or re.search(r"-nao-(incorporad|inclu)", str(get_id(r))))
        if eh_nao_inc:
            n_nao_inc += 1
        if inc.get("status") == "nao_incorporado":
            if inc.get("motivo") not in MOTIVOS_INCORP:
                inc_bug.append(f"{get_id(r)}: motivo '{inc.get('motivo')}' fora da taxonomia")
            if not (tem_flag(flags_top) and tem_flag(flags_cons)):
                inc_bug.append(f"{get_id(r)}: flag nao_incorporado ausente em flags/consolidacao.flags")
            if inc.get("revisor") and not (inc.get("nota_revisao") and inc.get("data")):
                inc_bug.append(f"{get_id(r)}: refutado por revisor sem nota_revisao/data")
    if removidos_legado:
        fails.append(("campo legado 'removido' presente — refutado fica visível, não some", removidos_legado))
    if inc_bug:
        fails.append(("incorporacao explícita inconsistente", inc_bug))
    if not removidos_legado and not inc_bug:
        print(f"✓ [7] Contrato de incorporação ok — soma: {len(regimes)} total = "
              f"{len(regimes) - n_nao_inc} candidatos + {n_nao_inc} não incorporados (visíveis).")

    # 8) fonte dupla consistente: duplicata por-tumor tem que ser idêntica ao
    #    agregado publicado (o canônico do dedupe). Divergência = conserto aplicado
    #    num lado só — exatamente o padrão que gerou o batch rejeitado de 07-21.
    if DUP_DIVERGENTES:
        fails.append(("por-tumor DIVERGE do agregado publicado (fonte dupla inconsistente)",
                      sorted(set(DUP_DIVERGENTES))))
    elif len(files) > 1:
        print("✓ [8] Agregado e por-tumor idênticos (fonte dupla consistente).")

    # 6) DOIs de confirmado resolvem (opcional, rede)
    if check_dois:
        print("\n  validando DOIs de confirmados no registro Crossref...")
        mortos, indet = [], []
        for r in regimes:
            if (get_selo(r) or "").lower() != "confirmado":
                continue
            doi = get_doi(r)
            if not doi:
                continue
            ok = resolve_doi(doi)
            time.sleep(0.3)
            if ok is False:
                mortos.append(f"{get_id(r)}:{doi}")
            elif ok is None:
                indet.append(f"{get_id(r)}:{doi}")
        if mortos:
            fails.append(("confirmado com DOI que NÃO resolve (404)", mortos))
        else:
            print("✓ [6] Todos os DOIs de confirmado resolvem.")
        if indet:
            warns.append(("DOIs indeterminados (rede) — recheque", indet))

    # ---- veredito ----
    print("\n" + "=" * 52)
    for titulo, itens in warns:
        print(f"⚠ WARN: {titulo} ({len(itens)})")
        print("   " + ", ".join(map(str, itens[:12])) + (" ..." if len(itens) > 12 else ""))
    for titulo, itens in fails:
        print(f"✗ FALHA: {titulo} ({len(itens)})")
        print("   " + ", ".join(map(str, itens[:12])) + (" ..." if len(itens) > 12 else ""))
    print("=" * 52)
    if fails:
        print(f"\nRESULTADO: {len(fails)} check(s) FALHARAM — NÃO confie neste lote. Volta pro agente.")
        sys.exit(1)
    print("\nRESULTADO: passou os invariantes offline." +
          ("" if check_dois else " (rode com --check-dois pra fechar os DOIs)"))
    print("Lembrete: isto cobre a forma, não o mérito clínico — esse é do oncologista na Revisão.")
    sys.exit(0)

if __name__ == "__main__":
    main()
