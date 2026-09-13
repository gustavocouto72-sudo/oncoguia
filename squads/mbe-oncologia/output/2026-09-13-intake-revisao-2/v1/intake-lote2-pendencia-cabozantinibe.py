#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Triagem do lote 2 fechada: renal-met-2l-pos-io-cabozantinibe.
Decisão do revisor recebida POR MENSAGEM (fora da app) em 2026-09-13, relatada pelo
Gustavo Couto: "incorporar segunda linha apenas". METEOR mantido, regra inalterada — o DOI
indicado no parecer (10.1002/cncr.33169, CABOSUN Q-TWiST 1ª linha) NÃO entra.
Fecha como manter_anotar (dado intacto, hash intacto). Roda uma vez, depois dos outros patches."""
import json, os, sys, importlib.util
from collections import OrderedDict, Counter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..", "..", "..", ".."))
RID = "renal-met-2l-pos-io-cabozantinibe"; HOJE = "2026-09-13"
spec = importlib.util.spec_from_file_location("bd", os.path.join(RAIZ, "app", "build-data.py"))
bd = importlib.util.module_from_spec(spec); sys.modules["bd"] = bd; spec.loader.exec_module(bd)

agg = os.path.join(AQUI, "regimes-consolidados.json")
data = json.load(open(agg, encoding="utf-8"), object_pairs_hook=OrderedDict)
r = next(x for x in data["regimes"] if x["regimen_id"] == RID)
h = bd.content_hash(r)
c = r["consolidacao"]; assert c["decisao_revisao"] == "triagem_manual"
assert r["referencia"]["estudo"] == "METEOR"
DECISAO = "incorporar segunda linha apenas"
ORIGEM = OrderedDict([("canal", "mensagem ao Gustavo Couto (fora da app)"), ("decidido_por", "Gustavo Drummond Pinho Ribeiro (revisor)"),
                      ("data", HOJE), ("texto", DECISAO), ("efeito", "manter: METEOR mantido, regra inalterada; DOI do parecer (CABOSUN Q-TWiST, 1ª linha) não entra")])
c["decisao_revisao"] = "revisado_com_ressalva"
c["spec_revisor_nao_computavel"] = None
c["triagem_resolvida"] = ORIGEM
c["nota_revisao"] = f"Decisão do revisor (por mensagem, {HOJE}): {DECISAO}. Referência METEOR e regra de 2ª linha pós-imunoterapia mantidas."
c.setdefault("notas_revisao", []).append(OrderedDict([("lote", 2), ("data", HOJE), ("revisor", "Gustavo Drummond Pinho Ribeiro"),
    ("acao", "manter_anotar (triagem resolvida por mensagem)"), ("natureza", "dado"), ("eixo", None),
    ("nota", f"{DECISAO} — decisão recebida por mensagem, fora do fluxo de parecer da app."),
    ("nota_squad", "Fecha a triagem do parecer de 2026-09-12 (corrigir_referencia com DOI 10.1002/cncr.33169, que resolve para o CABOSUN Q-TWiST de 1ª linha): referência METEOR mantida, regra inalterada, hash intacto.")]))
for lst in (c["flags"], r["flags"]):
    lst[:] = [f for f in lst if not str(f).startswith("triagem")]
    lst.append("nota_revisor (por mensagem, 2026-09-13): incorporar segunda linha apenas — METEOR mantido")
r["revisado_por"] = "Gustavo Drummond Pinho Ribeiro"; r["revisado_em"] = HOJE
r["versao"] = int(r["versao"]) + 1; r["atualizado_em"] = HOJE
r["historico_versoes"].append(OrderedDict([("versao", r["versao"]), ("data", HOJE), ("origem", "intake-lote2:triagem resolvida (manter_anotar)"),
    ("mudanca", "Triagem fechada por decisão do revisor recebida por mensagem: 'incorporar segunda linha apenas'. METEOR mantido, regra inalterada; DOI do parecer não incorporado."),
    ("eixos_afetados", []), ("fonte", None), ("decidido_por", "Gustavo Drummond Pinho Ribeiro (por mensagem; relatado por Gustavo Couto)")]))
assert bd.content_hash(r) == h, "manter não muda hash"

rh = data["meta"]["revisao_humana"]
for x in rh["resultado"]:
    if x["regimen_id"] == RID:
        x["status"] = "resolvido_manter"; x["nota"] = "triagem fechada por decisão do revisor recebida por mensagem (2026-09-13): 'incorporar segunda linha apenas'; METEOR mantido, regra inalterada, hash intacto"
rh["triagem_manual"] = [t for t in rh["triagem_manual"] if t["regimen_id"] != RID]
rh.setdefault("pendencias_resolvidas", []).append(OrderedDict([("regimen_id", RID), ("de", "triagem_manual"), ("para", "manter_anotar"), ("origem", ORIGEM)]))
for pa in rh["placar_por_acao"]:
    pa["status"] = dict(Counter(x["status"] for x in rh["resultado"] if x["acao"] == pa["acao"]))
json.dump(data, open(agg, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
f = os.path.join(AQUI, "renal", "v1", "regimes-consolidados.json")
pt = json.load(open(f, encoding="utf-8"), object_pairs_hook=OrderedDict)
pt["regimes"] = [x for x in data["regimes"] if x["tumor"] == "renal"]
json.dump(pt, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
rel = json.load(open(os.path.join(AQUI, "relatorio-intake-lote2.json"), encoding="utf-8"), object_pairs_hook=OrderedDict)
rel["placar_por_acao"] = rh["placar_por_acao"]; rel["resultado"] = rh["resultado"]; rel["triagem_manual"] = rh["triagem_manual"]; rel["pendencias_resolvidas"] = rh["pendencias_resolvidas"]
json.dump(rel, open(os.path.join(AQUI, "relatorio-intake-lote2.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("ok — hash intacto:", h, "| triagem_manual restante:", rh["triagem_manual"])
