# Backlog — pendências registradas (OncoGuia)

Itens deixados **explicitamente em aberto** no código, com o gancho já no lugar. Cada um
diz o que falta, quem decide e onde está o gancho. Pendência registrada é pendência que
alguém pode fechar; pendência implícita vira dado inventado.

---

## 1. Listas de exames de reestadiamento por tumor (guia SADT)

**Estado:** gancho no lugar, devolvendo vazio de propósito.

- **Gancho:** `examesReestadiamento(tumor)` em `app/index.html` — hoje `return []`.
- **Onde aparece:** botão **Gerar guia SADT** no item de reestadiamento da trilha do
  paciente. Com o gancho vazio, a guia abre com linhas em branco e o médico **digita os
  exames na hora** (campos livres, adicionar/remover linhas). O fluxo está completo e
  funcionando assim — a lista por tumor é conveniência, não pré-requisito.
- **O que falta:** as listas de exames por tumor (ex.: mama → TC de tórax/abdome, cintilografia
  óssea…) precisam ser **definidas pelo oncologista de referência na Revisão clínica**, do
  mesmo jeito que o resto da camada clínica: informação assinada por humano, não derivada
  por agente.
- **Por que NÃO foi feito agora:** escrever essas listas aqui seria protocolo escrito à mão
  dentro da app — exatamente o que este projeto não faz (tudo vem do corpus do squad ou da
  Revisão clínica). Um agente sugerindo "exames de rotina" é palpite com cara de protocolo.
- **Como fechar quando houver decisão clínica:** persistir as listas na camada de revisão
  (uma decisão por tumor, como os pareceres em `revisoes`), expor no payload que a app já
  carrega e trocar o corpo do gancho pela leitura desse dado. Nenhuma outra parte da guia
  muda: `abrirSADT()` já usa o retorno do gancho para pré-preencher as linhas.

**Portão:** o check `R14 gancho examesReestadiamento(tumor) devolve vazio (pendência
registrada)` em `scripts/portao-retorno.js` falha no dia em que alguém preencher isso à mão
sem passar pela Revisão clínica — é o alarme desta pendência.

---

## 2. Tipo "Autorização" na trilha do paciente

**Estado:** a trilha já sabe desenhar o item; a fonte de dados ainda não existe.

- **Gancho:** `trilha()` em `backend/src/retornos/retornos.service.ts` (TODO no método) e
  `autorizacaoEntryHtml()` em `app/index.html`.
- **O que falta:** quando existir o módulo de autorização/solicitação de exceção, basta
  empurrar itens `{tipo:'autorizacao', data, …}` na lista antes do `sort` — a mescla é
  genérica e a ordenação (dia → instante do registro → id) já vale para qualquer tipo.
- Hoje a trilha traz só `avaliacao` e `retorno`, e isso está declarado na tela.
