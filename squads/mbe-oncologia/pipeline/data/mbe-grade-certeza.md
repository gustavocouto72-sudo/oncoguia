# Ficha MBE — GRADE: graduação da certeza da evidência
> Base: Guyatt, *Users' Guides to the Medical Literature*, 3ª ed. (cap. 1–5). Ficha operacional para o verificador de evidência (Gael).

## Regra-mestra
`Certeza final = Certeza inicial − Rebaixamentos + Elevações`
Avaliar **por desfecho** (PICO), não por estudo. Um mesmo estudo pode dar certeza alta para mortalidade e baixa para um desfecho subjetivo.

## Certeza inicial (pelo desenho)
- **RCT → Alta.** (randomização protege de seleção/confusão)
- **Observacional → Baixa.**
Ponto de partida plástico: é só o patamar; os domínios refinam.

## Rebaixar (−1 sério / −2 muito sério) — 5 domínios
1. **Risco de viés** — falha em sigilo de alocação, cegamento, perdas de seguimento, ITT.
2. **Inconsistência** — heterogeneidade inexplicada (I² alto, IC com pouca sobreposição).
3. **Evidência indireta** — ver ficha `mbe-indirectness.md` (população/intervenção/comparador/desfecho ≠ PICO; desfecho substituto).
4. **Imprecisão** — ver ficha `mbe-magnitude-precisao.md` (IC cruza limiar de decisão; OIS; nº de eventos < 300).
5. **Viés de publicação** — assimetria de funnel plot; influência de financiamento.

## Elevar (só observacional)
- **Magnitude grande** +1 (RR >2 ou <0,5) · **muito grande** +2 (RR >5 ou <0,2; ex.: insulina em cetoacidose).
- **Gradiente dose-resposta** +1.
- **Confusão residual oposta** +1 (todos os confundidores plausíveis reduziriam o efeito, mas ele persiste).

## Regra final (rigor > selo do desenho)
Um RCT com imprecisão grave ou risco de viés crítico pode terminar com certeza **inferior** a um observacional bem conduzido com efeito de grande magnitude.

## Saída do verificador (notação número+letra)
`valor_rederivado` = força(1|2) + qualidade(A|B|C). Ex.: `1B` = recomendação forte, evidência moderada.
- Alta (A): muito confiantes; novas pesquisas improváveis de mudar.
- Moderada (B): provavelmente próximo, mas pode diferir.
- Baixa (C): pode ser substancialmente diferente.
- Muito baixa: qualquer estimativa é muito incerta.
Sempre `status` (concorda|diverge|indeterminado vs. protocolo) + `justificativa` (citar o domínio decisivo) + `fonte`.
