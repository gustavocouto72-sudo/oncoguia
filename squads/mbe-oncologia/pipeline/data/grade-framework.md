# Framework — GRADE (força da recomendação + qualidade da evidência)

Objetivo: re-derivar, para cada regime, a **qualidade da evidência** e a **força da
recomendação**, devolvendo no formato número+letra usado pelo protocolo.

## Notação
- **Número = força da recomendação:** `1` forte, `2` condicional/fraca. (O protocolo Orizonti usa também a direção: condicional a favor = laranja; fortemente contra = vermelho.)
- **Letra = qualidade da evidência:** `A` alta, `B` moderada, `C` baixa.
- Ex.: `1A` = recomendação forte, evidência alta.

## Como re-derivar a QUALIDADE (letra)
Começar pelo desenho e rebaixar/elevar:
- Ponto de partida: RCT = alta; observacional = baixa.
- **Rebaixa:** risco de viés (randomização/cegamento/perdas), inconsistência, evidência indireta, imprecisão (IC largo cruzando o efeito nulo), viés de publicação.
- **Eleva** (observacional): efeito grande, gradiente dose-resposta, confundidores que reduziriam o efeito.

## Como re-derivar a FORÇA (número)
Equilíbrio benefício × risco, qualidade da evidência, valores/preferências e custo.
- Benefício claro e consistente + evidência ≥ moderada → tende a `1`.
- Evidência incerta, benefício marginal ou trade-off sensível → `2`.

## Saída
`status` (concorda/diverge/indeterminado vs. o protocolo) + `valor_rederivado` (ex.: `1B`) + `justificativa` citando desenho/IC/risco de viés + `fonte`.

> Escopo: este framework é operacional e resumido. Casos limítrofes vão para o Tumor Board (Step 08), não para um chute do agente.
