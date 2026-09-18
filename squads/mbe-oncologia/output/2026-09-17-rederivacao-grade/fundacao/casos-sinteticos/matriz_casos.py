#!/usr/bin/env python3
"""Matriz caso sintético -> o que o check [11] devolve. Prova de que o portão barra cada regra
e que o controle passa. Escreve resultado-casos.md ao lado."""
import json, os, sys, re
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(AQUI, "..", "..", "..", "..")))
from verificar_dados import check_grade_schema2
casos = json.load(open(os.path.join(AQUI, "regimes-consolidados.json")))["regimes"]
linhas = ["# Casos sintéticos — resultado do check [11] (gerado por matriz_casos.py)", "",
          "| caso | esperado | falhas do portão | veredito |", "|---|---|---|---|"]
ok_total = True
for r in casos:
    bugs, warns = [], []
    check_grade_schema2(r, bugs, warns)
    esperado = r["_esperado"]
    msgs = [b.split(": ", 1)[1] for b in bugs]
    if esperado == "PASSA":
        ok = not bugs
    else:
        m = re.search(r"regra (\d)", esperado) or re.search(r"\b(C\d)\b", esperado)
        chave = (f"regra {m.group(1)}" if m.group(1).isdigit() else m.group(1)) if m else None
        ok = any(chave in x for x in msgs) if chave else any("≠ aritmética" in x for x in msgs)
    ok_total &= ok
    mtxt = ("—" if not msgs else "<br>".join(msgs)).replace("|", "\\|")
    ver = "✓ barrou na regra esperada" if (ok and msgs) else ("✓ passou" if ok else "✗ INESPERADO")
    linhas.append(f"| `{r['regimen_id']}` | {esperado} | {mtxt} | {ver} |")
    if warns:
        wtxt = "<br>".join(w.split(": ", 1)[1] for w in warns).replace("|", "\\|")
        linhas.append("| ↳ WARN | | " + wtxt + " | |")
linhas += ["", f"**Resultado: {'todos os casos se comportaram como esperado' if ok_total else 'ALGUM CASO FORA DO ESPERADO'}.**"]
open(os.path.join(AQUI, "resultado-casos.md"), "w").write("\n".join(linhas) + "\n")
print("\n".join(linhas))
sys.exit(0 if ok_total else 1)
