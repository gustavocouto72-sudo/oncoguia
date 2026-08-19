# Fontes manuais — intake de PDFs baixados à mão

Esta pasta é o **canal de entrada de estudos-pivô que o pipeline não conseguiu acessar sozinho**
(paywall, página JS, link quebrado, ou referência ausente no protocolo). Você baixa o PDF, larga
aqui, re-roda o squad, e **apenas os regimes correspondentes são reprocessados** — o resto do
`regimes-consolidados.json` fica intacto.

De onde vem a lista do que baixar: `output/<run>/v<n>/fontes-a-buscar.md` (e `.json`), gerada a
partir dos regimes com selo `incompleto` cuja lacuna é `grade_sem_estudo_pivo`.

## Como nomear o arquivo

Cada PDF precisa ser casável a um ou mais regimes. Duas formas (qualquer uma serve):

1. **Por `regimen_id`** — nome do arquivo = o `regimen_id` exato + `.pdf`.
   `mama-met-hrpos-2l-docetaxel.pdf`
   Um regime por arquivo. É a forma mais direta.

2. **Por DOI** — nome do arquivo = o DOI com `/` trocado por `_` + `.pdf`.
   DOI `10.1200/JCO.1999.17.8.2341` → `10.1200_JCO.1999.17.8.2341.pdf`
   O casamento é feito contra o `referencia.doi` do regime **ou** contra o DOI de um candidato
   confirmado (ver mapa abaixo). Útil quando um mesmo estudo-pivô cobre vários regimes.

Regras de nome:
- Extensão `.pdf` (minúscula). Sem espaços; use `-` ou `_`.
- Sufixos livres depois de `--` são ignorados no casamento:
  `mama-met-hrpos-2l-docetaxel--chan1999.pdf` casa com `mama-met-hrpos-2l-docetaxel`.

## Mapa opcional (`fontes-manuais.map.json`)

Quando o nome do arquivo não basta (um PDF para vários regimes; DOI de um candidato ainda não
gravado no regime; confirmar um candidato que estava "a confirmar"), crie
`fontes-manuais.map.json` **nesta pasta**:

```json
{
  "arquivos": [
    {
      "arquivo": "10.1200_JCO.1999.17.8.2341.pdf",
      "doi": "10.1200/JCO.1999.17.8.2341",
      "aplica_a": ["mama-met-hrpos-2l-docetaxel"],
      "confirma_candidato": true,
      "nota": "303 Study — pivô do docetaxel monoterápico, confirmado."
    },
    {
      "arquivo": "impassion131.pdf",
      "doi": "10.1016/j.annonc.2021.05.801",
      "aplica_a": ["mama-met-tnbc-1l-atezolizumabe-nao-incorporado"],
      "confirma_candidato": true
    }
  ]
}
```

- `aplica_a`: lista de `regimen_id` que este PDF deve reprocessar. É a fonte de verdade do
  casamento quando presente (tem precedência sobre o nome do arquivo).
- `confirma_candidato`: `true` marca que este PDF **confirma** um candidato que estava
  `a confirmar` em `fontes-a-buscar.json` — o intake grava o DOI/estudo em `referencia` do regime.
- `doi`, `nota`: opcionais, para rastreabilidade.

## O que acontece ao re-rodar

Ver `pipeline/steps/step-02b-fontes-manuais.md`. Em resumo, para cada regime casado:
1. o **Extrator** lê o PDF e atualiza `referencia` / `beneficio` / `toxicidades`;
2. os eixos que dependiam do pivô ausente (sobretudo **GRADE**; também ESMO-MCBS e elegibilidade
   quando o pivô os informa) são **re-derivados** — só para esses regimes;
3. o **Consolidador** recalcula o selo e **acrescenta** uma entrada em `historico_versoes`
   (`origem: "fonte-manual"`), incrementa `versao` e preenche `atualizado_em`;
4. os demais regimes são **copiados sem alteração**.

Um relatório do casamento é escrito em `output/<run>/v<n+1>/fontes-manuais-intake.json`
(casados, não-casados, e PDFs órfãos que não bateram com nenhum regime).

## Privacidade

Esta pasta contém PDFs de artigos possivelmente sob copyright — mantenha-a **fora do versionamento**
(gitignore) e local à sua máquina.
