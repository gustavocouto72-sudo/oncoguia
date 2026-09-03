# Extração da expectativa de tempo de uso

Proveniência do bloco `expectativa_uso` que existe em cada um dos 295 regimes do corpus —
a metade "tempo" do custo global por paciente (`custo/ciclo × ciclos esperados`).

Isto **não roda em produção**. É o pipeline que produziu o dado uma vez, versionado para
que os números possam ser conferidos e refeitos quando o squad re-rodar.

## O que cada número é

Todo bloco nasce e permanece com `"selo": "estimativa"`. Nenhum vira `confirmado`:
duração de trial não é duração na vida real, e a calibração virá da trilha do paciente.

- **`tipo: "fixa"`** — nº de ciclos derivado do próprio `esquema` já cadastrado. Puramente
  mecânico, sem fonte externa (`"fonte": "esquema"`).
- **`tipo: "ate_progressao"`** — precisa de um tempo do pivotal. Ordem de preferência:
  1. duração mediana de tratamento reportada (`duracao_mediana_tratamento_meses`);
  2. PFS mediana como proxy **declarado** (`proxy: "pfs"`);
  3. nada reportado → `indeterminado: true` com nota.
- **`indeterminado: true`** sempre traz `nota` dizendo por quê.

**67% do corpus é indeterminado, e isso é o resultado honesto.** Placar: fixa 46 · fixa
indeterminada 81 · até-progressão com duração 1 · com proxy de PFS 48 · indeterminado 119.

## O achado que vale lembrar

Abstract quase nunca reporta duração mediana de tratamento. Varredura ampla sobre os 222
abstracts válidos encontrou **um**: FLAURA, exposição mediana de 20,7 meses. A primeira
passagem achou **zero** porque o padrão exigia `duration of exposure` e o texto diz
`median exposure was` — se for reescrever o extrator, comece por aí.

A FLAURA também mostra por que PFS é piso: 20,7 meses de exposição contra ~18,9 de PFS.
Trata-se além da progressão, então os 48 proxies puxam o custo para **baixo**.

## Arquivos

| arquivo | o que é |
|---|---|
| `fetch_abstracts.py` | baixa do PubMed o abstract de cada DOI **já presente** no corpus. Não introduz referência nova: resolve o DOI que o regime já cita. Gera `abstracts.json` (~1,3 MB, **não versionado**). |
| `corpo.py` | isola o corpo do abstract no formato texto do PubMed (descarta citação, autores, comentários, rodapé). |
| `extrair_abstract.py` | extrai as **frases candidatas** com duração mediana de tratamento e PFS mediana. Não decide nada — atribuir o braço certo exige leitura humana. |
| `regras.py` | derivação mecânica do lado `fixa` a partir do texto do `esquema`. |
| `auditar.py` | roda `regras.py` sobre o corpus e imprime o que a máquina resolve sozinha e o que sobra. |
| `overrides_a.py`, `overrides_b.py` | as decisões **curadas à mão**, regime a regime, com a justificativa em cada nota. É aqui que mora o julgamento. |
| `montar.py` | regras + overrides → `expectativa_uso.json`. Falha alto se algum regime ficar sem decisão. |
| `aplicar.py` | injeta no consolidado e nos arquivos por tumor do run ativo. Guardas: nenhum `content_hash` pode mudar e nenhum DOI novo pode aparecer. |
| `expectativa_uso.json` | resultado aplicado (295 regimes). |
| `fontes-extraidas.json` | **a proveniência dos 49 números**: para cada um, o DOI, o PMID e a **frase exata** do abstract de onde saiu. |

`abstracts.json` e `candidatos.json` **não são versionados** — são ~1,9 MB de texto de
abstract de editora, e redistribuí-los num repositório é outra coisa que cacheá-los para
trabalhar. `fetch_abstracts.py` os regenera; `fontes-extraidas.json` guarda a citação
pontual de cada número usado, que é a proveniência que importa.

## Como refazer

```bash
cd squads/mbe-oncologia/extracao-expectativa-uso
python3 fetch_abstracts.py        # ~3 min, rede (PubMed E-utilities)
python3 extrair_abstract.py       # frases candidatas para leitura humana
python3 auditar.py                # o que as regras resolvem sozinhas
python3 montar.py                 # regras + overrides -> expectativa_uso.json
python3 aplicar.py                # ENSAIO: mostra o que mudaria, não escreve
python3 aplicar.py --aplicar      # grava no run ativo
```

Os caminhos saem do `RUN_ATIVO` (fonte única), resolvido a partir da posição destes
arquivos — nunca "o run mais novo" nem caminho absoluto de máquina.

Depois de aplicar, o portão de dados é obrigatório:

```bash
python3 ../verificar_dados.py --check-dois     # check [9] cobre este bloco
```

## Guardas que não podem cair

- **`content_hash` não muda.** O hash cobre selo, eixos de verificação, referência e regra
  de elegibilidade — não este bloco. Se algum hash mudar, os pareceres do revisor daquele
  regime expiram sem motivo, e isso é erro grave. `aplicar.py` aborta se acontecer.
- **Nenhum DOI novo.** O número só pode sair do pivotal que o regime **já** cita. Se
  existir em outro paper, vai para a `nota` como triagem humana — não para o dado.
- **Nunca inventar número.** Abstract não reporta → `indeterminado`. Honestidade vale mais
  que completude bonita, e um placar com pouquíssimo indeterminado é bandeira vermelha.
