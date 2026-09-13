#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pendência do lote 2 autorizada pelo humano (2026-09-13): prostata-mcrpc-2l-cabazitaxel-
nao-incorporado sai de triagem_manual e executa como REFUTAR — mantém não-incorporado com a
justificativa do revisor verbatim e visível (bloco `incorporacao`, mesmo formato do PARP).
Sem primitivo novo, sem reprocessar eixos: o hash não muda (incorporacao/flags não entram nele).
Roda UMA vez sobre este run, depois do intake-lote2.py."""
import json, os, sys, importlib.util
from collections import OrderedDict, Counter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..", "..", "..", ".."))
RID = "prostata-mcrpc-2l-cabazitaxel-nao-incorporado"; HOJE = "2026-09-13"
spec = importlib.util.spec_from_file_location("bd", os.path.join(RAIZ, "app", "build-data.py"))
bd = importlib.util.module_from_spec(spec); sys.modules["bd"] = bd; spec.loader.exec_module(bd)

agg = os.path.join(AQUI, "regimes-consolidados.json")
data = json.load(open(agg, encoding="utf-8"), object_pairs_hook=OrderedDict)
r = next(x for x in data["regimes"] if x["regimen_id"] == RID)
dec = next(d for d in json.load(open(os.path.join(AQUI, "revisao-decisoes.json"), encoding="utf-8"))["decisoes"]
           if d["regimen_id"] == RID and d["data"] >= "2026-09-12")
h_antes = bd.content_hash(r)
assert r["consolidacao"]["decisao_revisao"] == "triagem_manual"

r["incorporacao"] = OrderedDict([
    ("status", "nao_incorporado"), ("motivo", "refutado"),
    ("nota_revisao", dec["justificativa"]), ("revisor", dec["revisor"]), ("data", dec["data"]),
    ("nota_squad", "Ação registrada como ajustar_elegibilidade; o texto pedia 'manter não incorporar, trocar a justificativa'. Balde refutar confirmado pelo humano em 2026-09-13 (pendência do lote 2). Sem primitivo novo, eixos não reprocessados."),
])
for lst in (r["consolidacao"]["flags"], r["flags"]):
    lst[:] = [f for f in lst if not str(f).startswith("nao_incorporado")]
    lst.insert(0, "nao_incorporado")
c = r["consolidacao"]
c["decisao_revisao"] = "refutado_revisao_clinica"
c.pop("spec_revisor_nao_computavel", None)
c["nota_revisao"] = dec["justificativa"]
for n in c.get("notas_revisao", []):
    if n.get("lote") == 2:
        n["acao"] = "refutar (balde confirmado pelo humano; acao original ajustar_elegibilidade)"
        n["nota_squad"] = r["incorporacao"]["nota_squad"]
r["versao"] = int(r["versao"]) + 1; r["atualizado_em"] = HOJE
r["historico_versoes"].append(OrderedDict([("versao", r["versao"]), ("data", HOJE), ("origem", "intake-lote2:refutar (pendência confirmada)"),
    ("mudanca", "Triagem manual resolvida pelo humano: executa como refutar — não-incorporação mantida com a justificativa do revisor verbatim (bloco incorporacao). Eixos, regra e referência intactos."),
    ("eixos_afetados", []), ("fonte", None), ("decidido_por", dec["revisor"])]))
assert bd.content_hash(r) == h_antes, "refutar não pode mudar o hash"

rh = data["meta"]["revisao_humana"]
for x in rh["resultado"]:
    if x["regimen_id"] == RID:
        x["status"] = "executado_como_refutar"; x["nota"] = "pendência confirmada pelo humano em 2026-09-13: não-incorporado + justificativa do revisor (balde refutar); hash intacto"
rh["triagem_manual"] = [t for t in rh["triagem_manual"] if t["regimen_id"] != RID]
rh["refutados"].append(OrderedDict([("regimen_id", RID), ("nota_revisao", dec["justificativa"]), ("revisor", dec["revisor"]), ("data", dec["data"]),
    ("origem", "triagem_manual → refutar, confirmado pelo humano em 2026-09-13")]))
for pa in rh["placar_por_acao"]:
    pa["status"] = dict(Counter(x["status"] for x in rh["resultado"] if x["acao"] == pa["acao"]))
rh["pendencias_resolvidas"] = [OrderedDict([("regimen_id", RID), ("de", "triagem_manual"), ("para", "refutar"), ("confirmado_por", "humano"), ("data", HOJE)])]
json.dump(data, open(agg, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# fatia por tumor idêntica ao agregado
f = os.path.join(AQUI, "prostata", "v1", "regimes-consolidados.json")
pt = json.load(open(f, encoding="utf-8"), object_pairs_hook=OrderedDict)
pt["regimes"] = [x for x in data["regimes"] if x["tumor"] == "prostata"]
json.dump(pt, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
# relatório
rel = json.load(open(os.path.join(AQUI, "relatorio-intake-lote2.json"), encoding="utf-8"), object_pairs_hook=OrderedDict)
rel["placar_por_acao"] = rh["placar_por_acao"]; rel["resultado"] = rh["resultado"]; rel["triagem_manual"] = rh["triagem_manual"]
rel["pendencias_resolvidas"] = rh["pendencias_resolvidas"]
json.dump(rel, open(os.path.join(AQUI, "relatorio-intake-lote2.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("ok — hash intacto:", h_antes, "| triagem_manual restante:", [t["regimen_id"] for t in rh["triagem_manual"]])
print(json.dumps(rh["placar_por_acao"], ensure_ascii=False))
