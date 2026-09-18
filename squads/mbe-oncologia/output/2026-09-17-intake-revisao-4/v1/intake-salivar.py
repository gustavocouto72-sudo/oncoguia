#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
INTAKE — 3 REGIMES DE GLÂNDULA SALIVAR (item D7 do lote 4). Roda SOBRE ESTE RUN, DEPOIS de
`intake-lote4.py` (re-lê a fatia cabeca-pescoco/v1 já gravada pelo lote 4 antes de anexar o
vocabulário). Fonte: `../../2026-09-16-salivar-proposta/regimes-propostos-salivar.json`
(proposta da sessão oncoguia-2d, aprovada "como está" pelo Gustavo Couto em 17/09 — HANDOFF-para-lote4.md).

Decisão fora do fluxo (revisor por WhatsApp, 16/09, relatada por Gustavo Couto) — registro no
formato do precedente do cabozantinibe (lote 2). Invariantes: 0 hashes existentes mudam,
0 aprovações expiram, 0 código de app; os 3 hashes novos batem com meta.hashes_previstos.
"""
import json, os, sys, copy, importlib.util
from collections import Counter, OrderedDict

AQUI = os.path.dirname(os.path.abspath(__file__))
SQUAD = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
RAIZ = os.path.abspath(os.path.join(SQUAD, "..", ".."))
AGG = os.path.join(AQUI, "regimes-consolidados.json")
FATIA = os.path.join(AQUI, "cabeca-pescoco", "v1", "regimes-consolidados.json")
PROPOSTA = os.path.join(SQUAD, "output", "2026-09-16-salivar-proposta", "regimes-propostos-salivar.json")
HOJE = "2026-09-17"
ESTE_RUN = "2026-09-17-intake-revisao-4/v1"
TUMOR = "cabeca-pescoco"

spec = importlib.util.spec_from_file_location("bd", os.path.join(RAIZ, "app", "build-data.py"))
bd = importlib.util.module_from_spec(spec); sys.modules["bd"] = bd; spec.loader.exec_module(bd)
content_hash = bd.content_hash

def carregar(p):
    return json.load(open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)

def main():
    data = carregar(AGG); regimes = data["regimes"]; by = {r["regimen_id"]: r for r in regimes}
    assert data["meta"]["revisao_humana"]["lote"] == 4, "rodar DEPOIS do intake-lote4.py"
    assert not any(r["regimen_id"].startswith("cp-salivar-") for r in regimes), "já inserido — copie o run de novo"
    prop = carregar(PROPOSTA)
    novos = prop["regimes"]; assert len(novos) == 3
    previstos = prop["meta"]["hashes_previstos"]
    assert set(previstos) == {"cp-salivar-met-cap", "cp-salivar-met-carboplatina-paclitaxel", "cp-salivar-met-cisplatina-vinorelbina"}
    hashes_antes = {r["regimen_id"]: content_hash(r) for r in regimes}

    # ---- 1. vocabulário de cabeca-pescoco: RE-LIDO da fatia gravada pelo lote 4 ----
    pt = carregar(FATIA)
    assert pt["meta"]["revisao_humana"]["status"] == "lote 4 aplicado", pt["meta"]["revisao_humana"]
    campos = pt["campos_primitivos"]; idx = {c["campo"]: c for c in campos}
    voc = prop["meta"]["vocabulario_cabeca_pescoco"]
    assert idx["tumor"]["tipo"] == "enum" and "glandula_salivar" not in idx["tumor"]["opcoes"] and "histologia_salivar" not in idx
    idx["tumor"]["opcoes"].append(voc["tumor"]["opcao_nova"])
    idx["tumor"].setdefault("rotulos", OrderedDict())[voc["tumor"]["opcao_nova"]] = voc["tumor"]["rotulo"]
    h = voc["histologia_salivar"]
    campos.append(OrderedDict([("campo", h["campo"]), ("tipo", h["tipo"]), ("label", h["label"]), ("secao", h["secao"]),
                               ("opcoes", h["opcoes"]), ("indeterminado", h["indeterminado"]), ("rotulos", h["rotulos"]), ("nota", h["nota"])]))
    # nenhuma regra existente de C&P dispara para glandula_salivar (todas fixam tumor=<outro>)
    for r in regimes:
        if r["tumor"] == TUMOR:
            s = json.dumps(r["elegibilidade"]["regra"]); assert '"tumor"' in s and "glandula_salivar" not in s, r["regimen_id"]

    # ---- 2. os 3 regimes: inseridos como estão (conteúdo hashado intocado); só a marca do intake ----
    inseridos = []
    for n in novos:
        r = copy.deepcopy(n)
        assert r["regimen_id"] not in by and r["tumor"] == TUMOR
        assert content_hash(r) == previstos[r["regimen_id"]], (r["regimen_id"], content_hash(r), previstos[r["regimen_id"]])
        r["atualizado_em"] = HOJE
        r["historico_versoes"].append(OrderedDict([("versao", r["versao"]), ("data", HOJE), ("origem", "intake-salivar:inserido"),
            ("mudanca", f"Inserido no run {ESTE_RUN} (item D7 do lote 4) a partir da proposta 2026-09-16-salivar-proposta, aprovada como está pelo Gustavo Couto em 17/09. Conteúdo revisável idêntico à proposta (hash conferido)."),
            ("eixos_afetados", []), ("fonte", None), ("decidido_por", "Gustavo Couto (aprovação da proposta, 2026-09-17)")]))
        r["consolidacao"]["origem"]["run"] = ESTE_RUN
        assert content_hash(r) == previstos[r["regimen_id"]]
        regimes.append(r); by[r["regimen_id"]] = r; inseridos.append(r)

    # ---- 3. consequências ----
    hashes_depois = {r["regimen_id"]: content_hash(r) for r in regimes}
    for rid, hh in hashes_antes.items():
        assert hashes_depois[rid] == hh, f"hash existente mudou: {rid}"
    placar = Counter(r["consolidacao"]["selo_confianca"] for r in regimes)
    por_tumor = []
    for t in sorted({r["tumor"] for r in regimes}, key=lambda t: [x["tumor"] for x in regimes].index(t)):
        rs = [r for r in regimes if r["tumor"] == t]
        por_tumor.append(OrderedDict([("tumor", t), ("regimes", len(rs)), ("selo", dict(Counter(r["consolidacao"]["selo_confianca"] for r in rs)))]))
    meta = data["meta"]
    meta["titulo"] = meta["titulo"].replace("(re-run 2026-07-22, 25 tumores)", "+ 3 regimes de glândula salivar (decisão do revisor 16/09, D7) (re-run 2026-07-22, 25 tumores)")
    meta["total_regimes"] = len(regimes); meta["distribuicao_selo"] = dict(placar); meta["por_tumor"] = por_tumor
    rh = meta["revisao_humana"]
    rh["regimes_novos"] = [OrderedDict([("regimen_id", r["regimen_id"]), ("origem_decisao", "decisão fora do fluxo — revisor por WhatsApp 2026-09-16 (D7)"), ("selo", r["consolidacao"]["selo_confianca"]), ("doi", r["referencia"]["doi"]), ("content_hash", hashes_depois[r["regimen_id"]])]) for r in inseridos]
    rh["salivar"] = OrderedDict([
        ("decisao_fora_do_fluxo", prop["meta"]["decisao_fora_do_fluxo"]),
        ("aprovacao_da_proposta", "Gustavo Couto, 2026-09-17 ('como está'; HANDOFF-para-lote4.md)"),
        ("proposta", "squads/mbe-oncologia/output/2026-09-16-salivar-proposta/"),
        ("vocabulario", OrderedDict([("tumor_opcao_nova", "glandula_salivar"), ("campo_novo", "histologia_salivar (registrado; não condiciona regra)")])),
        ("referencias_verificadas", prop["meta"]["referencias_verificadas"]),
        ("pendencias_referendo", prop["meta"]["pendencias_referendo"]),
        ("invariantes", OrderedDict([("hashes_existentes_que_mudaram", 0), ("aprovacoes_expiradas", 0), ("codigo_de_app", 0)])),
    ])
    rh["referencias_verificadas"] = list(rh["referencias_verificadas"]) + [OrderedDict([("doi", x["doi"]), ("congruente", x.get("congruente_com_pedido")), ("primeiro_autor", x["primeiro_autor"]), ("ano", x["ano"]), ("estudo", x.get("tipo")), ("tema", x["citacao"]), ("tipo_publicacao", "artigo")]) for x in prop["meta"]["referencias_verificadas"]]
    rh["primitivos_novos"] = list(rh.get("primitivos_novos") or []) + [OrderedDict([("campo", "histologia_salivar"), ("tumor", TUMOR), ("tipo", "enum"), ("label", h["label"]), ("secao", h["secao"]), ("opcoes", h["opcoes"]), ("motivo", "salivar D7 — registrado, não condiciona regra")]),
                                                                        OrderedDict([("campo", "tumor"), ("tumor", TUMOR), ("tipo", "enum (opção nova)"), ("label", voc["tumor"]["rotulo"]), ("secao", idx["tumor"].get("secao")), ("opcoes", ["glandula_salivar"]), ("motivo", "salivar D7")])]
    for p in prop["meta"]["pendencias_referendo"]:
        rh["re_revisao"].append(OrderedDict([("regimen_id", "cp-salivar-*"), ("item", "salivar_referendo"), ("descricao", p), ("status", "aberto"), ("data", HOJE)]))
    meta["publicacao"] = meta["publicacao"].replace("aguarda intake-salivar.py neste run, ", "salivar (D7) aplicado; aguarda ")
    with open(AGG, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)

    rs = [r for r in regimes if r["tumor"] == TUMOR]
    pt["meta"]["gerado_em"] = HOJE; pt["meta"]["total_regimes"] = len(rs)
    pt["meta"]["distribuicao_selo"] = dict(Counter(r["consolidacao"]["selo_confianca"] for r in rs))
    pt["meta"]["derivado_de"] = f"{ESTE_RUN} (agregado; lote 4 + salivar D7)"
    pt["meta"]["revisao_humana"] = OrderedDict([("status", "lote 4 + salivar (D7) aplicados"), ("data", HOJE)])
    pt["campos_primitivos"] = campos; pt["regimes"] = rs
    with open(FATIA, "w", encoding="utf-8") as fh:
        json.dump(pt, fh, ensure_ascii=False, indent=2)
    with open(os.path.join(AQUI, "content-hashes.json"), "w", encoding="utf-8") as fh:
        json.dump({"gerado_em": HOJE, "run": ESTE_RUN, "hashes": hashes_depois}, fh, ensure_ascii=False, indent=0)

    relatorio = OrderedDict([("total_regimes", len(regimes)), ("placar_selo", dict(placar)), ("cabeca_pescoco", [x for x in por_tumor if x["tumor"] == TUMOR][0]),
                             ("regimes_novos", rh["regimes_novos"]), ("hashes_previstos_conferem", True), ("hashes_existentes_que_mudaram", 0),
                             ("vocabulario", OrderedDict([("tumor.opcoes", idx["tumor"]["opcoes"]), ("histologia_salivar", campos[-1])])),
                             ("pendencias_referendo", prop["meta"]["pendencias_referendo"]), ("decisao_fora_do_fluxo", prop["meta"]["decisao_fora_do_fluxo"])])
    with open(os.path.join(AQUI, "relatorio-intake-salivar.json"), "w", encoding="utf-8") as fh:
        json.dump(relatorio, fh, ensure_ascii=False, indent=2)
    print(json.dumps(OrderedDict([("total_regimes", len(regimes)), ("placar_selo", dict(placar)), ("cabeca_pescoco", relatorio["cabeca_pescoco"]), ("novos", [(r["regimen_id"], hashes_depois[r["regimen_id"]]) for r in inseridos])]), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
