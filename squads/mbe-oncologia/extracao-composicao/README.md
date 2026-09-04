# Extração da composição estruturada

Proveniência do bloco `composicao` que existe em cada um dos 295 regimes do corpus — o
que o módulo de **recursos** precisa para sair do preço por protocolo e chegar no preço
por **insumo**: qual fármaco, em que dose, por que via, em que dias do ciclo.

Isto **não roda em produção**. É o pipeline que produziu o dado uma vez, versionado para
que os números possam ser conferidos e refeitos quando o squad re-rodar.

## O que cada campo é

```jsonc
"composicao": {
  "itens": [
    { "farmaco": "Docetaxel", "dose_valor": 75.0, "dose_unidade": "mg_m2",
      "via": "EV", "dias_do_ciclo": null, "indeterminado": false, "nota": null }
  ],
  "completa": true,        // TODOS os itens resolvidos e nenhum marcador de ambiguidade
  "indeterminado": false,  // o inverso de `completa`, no vocabulário do resto do corpus
  "nota": null,
  "fonte": "esquema",      // sempre; nenhuma bula, nenhum "costuma ser"
  "selo": "estimativa"     // sempre; isto é leitura de texto, não prescrição conferida
}
```

`dose_unidade` tem **vocabulário fechado**: `mg_m2`, `mg_kg`, `mg`, `g`, `g_m2`, `mcg`,
`mcg_kg`, `UI`, `AUC`, `GBq`. Unidade fora da lista faz `montar.py` abortar.
`via` idem: `EV`, `VO`, `SC`, `IM`, `IT`, `IP`, `intravesical`.

`dias_do_ciclo` é a lista dos dias que o texto **escreve** (`D1,D8,D15` → `[1,8,15]`;
`D1-D5` → `[1,2,3,4,5]`). `null` significa "o esquema não escreve dias" — que **não** é o
mesmo que `[1]`, e o servidor precisa dizer qual das duas leituras está usando.

## A regra que decide tudo: nunca escolher

Derivação **só do texto do `esquema`**. Onde o texto é ambíguo, oferece faixa ou oferece
alternativa, o item sai **indeterminado com nota** — nunca com uma das opções escolhida.
Um item errado aqui não aparece como erro na tela: aparece como um número plausível de
frascos e de reais. Indeterminado aparece como "sem dado", que é visível.

Motivos de indeterminado, por item:

| motivo | exemplo no corpus |
|---|---|
| dose não declarada | `… + G-CSF` |
| faixa | `Temozolomida 150-200 mg/m²` |
| alternativa de dose | `Trastuzumabe 8 → 6 mg/kg`, `400/2.400 mg/m²` |
| duas doses no mesmo trecho | `200 mg a cada 3 semanas (ou 400 mg a cada 6 sem)` |
| mesmo fármaco, doses diferentes | `Nivolumabe 3 mg/kg … seguido de Nivolumabe 240 mg` |
| frequência intra-diária / contínuo | `abemaciclibe 150 mg VO 12/12h`, `mg/m²/dia` |
| cadência semanal sem dias | `Gemcitabina 1.000 mg/m² EV semanal x3 + 1 de descanso` |
| dose única no tratamento | `Tremelimumabe 300 mg dose única` |
| dias em contagem corrida | `Cisplatina 100 mg/m² D1, D22, D43` num ciclo de 21 dias |

E, no bloco inteiro:

| motivo | exemplo |
|---|---|
| **alternativa entre fármacos** | `Pembrolizumabe 200 mg …; ou Atezolizumabe 1.200 mg …; ou Cemiplimabe 350 mg` |
| dias escritos para parte dos fármacos | `Nab-paclitaxel 125 mg/m² + Gemcitabina 1.000 mg/m² D1,D8,D15` |
| cobertura curta contra `farmacos[]` | `Ácido Zoledrônico 4 mg + Vitamina D e Cálcio` |
| sigla de combinação | `Zolbetuximabe + FOLFOX ou + CAPOX` |
| termo genérico | `Pembrolizumabe 200 mg + QT platina` |

As duas primeiras são as que mais mudaram este parser, e as duas que mais custariam:
ler `ou` entre fármacos como combinação **triplicaria** o custo do ciclo em regimes de
imunoterapia; atribuir `D1,D8,D15` só ao fármaco que está ao lado compraria **um terço**
dos frascos do outro.

## O placar honesto

**29 de 295 regimes (10%) têm composição completa. 266 (90%) são indeterminados.**
Itens: 640 no total, 249 resolvidos.

Isto é o resultado, não uma etapa incompleta. Texto de esquema de oncologia é feito de
faixa (`AUC 5-6`), alternativa (`cisplatina ou carboplatina`), fase (`AC → paclitaxel`) e
uso contínuo (`VO 12/12h`) — e nenhuma dessas fecha um número por aplicação. O check
`[10]` do portão de dados levanta **bandeira vermelha se o indeterminado cair abaixo de
30%**, pelo mesmo motivo que o `[9]` levanta quando a expectativa de uso fica completa
demais: placar bonito aqui quase sempre significa que alguém escolheu por conta própria.

Consequência prática para o módulo de recursos: **o caminho por insumo cobre uma minoria
dos protocolos, e o preço por protocolo continua sendo o caminho principal.** A tela tem
de dizer qual dos dois produziu cada número — é para isso que existe o campo de origem.

## Conferência humana — amostra sorteada

Comando (a semente fica visível para a amostra poder ser refeita, e outra semente dá
outras cinco):

```bash
python3 amostra.py --n 5 --semente 20260904
```

```
[1] nsclc-periop-pembrolizumabe-qt  (pulmao-nsclc · neoadjuvancia)
    ESQUEMA: Pembrolizumabe 200 mg + QT platina D1, 4 ciclos neoadjuvantes → cirurgia →
             pembrolizumabe adjuvante a cada 3 semanas por 1 ano
    completa=False
      · Pembrolizumabe: 200 mg | via=— | dias=[1]
    NOTA: cobertura curta: 1 item derivado para 2 fármacos cadastrados no regime;
          termo genérico no lugar do fármaco (qt platina, platina)

[2] prostata-rb-rt-salvamento-tda  (prostata · localmente-avancado)
    ESQUEMA: Radioterapia de salvamento (EBRT) + Terapia de Deprivação Androgênica
             concomitante
    completa=False
    NOTA: nenhum fármaco do léxico reconhecido no esquema

[3] renal-met-intalto-axitinibe-pembrolizumabe  (renal · metastatico)
    ESQUEMA: Axitinibe 5 mg VO 2x/dia contínuo + Pembrolizumabe 200 mg EV a cada 3 semanas
    completa=False
      · Axitinibe: indeterminado | via=VO | dias=—
          nota: frequência intra-diária/uso contínuo sem os dias do ciclo escritos
      · Pembrolizumabe: 200 mg | via=EV | dias=—
    NOTA: 1 de 2 itens indeterminados

[4] gastrico-zolbetuximabe-nao-incorporado  (esofago-estomago · metastatico)
    ESQUEMA: Zolbetuximabe + FOLFOX (SPOTLIGHT) ou + CAPOX (GLOW) — não incorporado
    completa=False
      · Zolbetuximabe: indeterminado — dose não declarada no esquema
    NOTA: sigla de combinação no esquema (FOLFOX, CAPOX) — as doses das drogas da sigla
          não estão escritas

[5] sarcoma-angiossarcoma-paclitaxel  (sarcomas · metastatico)
    ESQUEMA: Paclitaxel 90 mg/m² a cada 14 dias
    completa=True
      · Paclitaxel: 90 mg_m2 | via=— | dias=—
```

Os cinco conferem contra o texto ao lado. O caso [1] é o que mais vale ler: a dose do
pembrolizumabe está certa e mesmo assim o bloco é indeterminado, porque a **outra** droga
do esquema ("QT platina") não tem nome nem dose — e um custo por insumo montado só com o
pembrolizumabe seria um número que parece completo e não é.

## Arquivos

| arquivo | o que é |
|---|---|
| `lexico.py` | fármacos canônicos e suas grafias no texto; siglas de combinação (`AC`, `FOLFOX`) e termos genéricos (`quimioterapia`) que **impedem** o bloco de fechar. |
| `regras.py` | o parser. Menções → trecho de cada fármaco → dose/unidade/via/dias, com as regras de indeterminado acima. |
| `caminhos.py` | resolve repo e run a partir do `RUN_ATIVO` (fonte única) — nunca "o run mais novo". |
| `auditar.py` | roda as regras sobre o corpus e imprime o placar. Não escreve nada. |
| `montar.py` | regras → `composicao.json`. Aborta se alguma unidade sair do vocabulário fechado. |
| `aplicar.py` | injeta no consolidado e nos arquivos por tumor do run ativo. |
| `amostra.py` | amostra sorteada com o texto original ao lado, para conferência humana. |
| `composicao.json` | resultado aplicado (295 blocos). |

Não há arquivo de **overrides** aqui, ao contrário da extração de expectativa de uso, e é
de propósito: lá o julgamento humano escolhia qual número do abstract usar; aqui escolher
entre "cisplatina OU carboplatina" seria decidir a conduta em vez de ler o texto.

## Como refazer

```bash
cd squads/mbe-oncologia/extracao-composicao
python3 auditar.py                # o que as regras resolvem sozinhas
python3 montar.py                 # regras -> composicao.json
python3 aplicar.py                # ENSAIO: mostra o que mudaria, não escreve
python3 aplicar.py --aplicar      # grava no run ativo
python3 amostra.py --n 5 --semente 20260904
cd ../../.. && python3 app/build-data.py     # publica no backend/data/evidencia.json
python3 squads/mbe-oncologia/verificar_dados.py --check-dois
```

## Guardas que não podem cair

- **`content_hash` não muda.** O hash cobre selo, eixos de verificação, referência e
  regra de elegibilidade — não este bloco. Se algum hash mudasse, os pareceres do revisor
  daquele regime expirariam sem motivo. `aplicar.py` aborta se acontecer.
- **Nenhum DOI novo.** Composição sai do texto do esquema, e texto de esquema não
  introduz referência nenhuma.
- **Vocabulário fechado.** Unidade nova exige decidir como o servidor converte para mg —
  então ela entra em `UNIDADES_VALIDAS` **e** no cálculo, junto, ou não entra.
- **Nunca escolher.** Faixa, alternativa ou fase → indeterminado com nota. Um placar de
  composição com pouquíssimo indeterminado é bandeira vermelha, não progresso.
