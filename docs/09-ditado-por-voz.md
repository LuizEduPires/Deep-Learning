# Ditado por voz no chat

O produtor no pomar tem a mão suja, o sol na tela e muitas vezes só uma das
mãos livre. Digitar "antracnose em cladódio" nessas condições é o que separa
uma pergunta feita de uma pergunta abandonada. O botão de microfone ao lado do
campo de texto transcreve a fala direto no campo.

## Como funciona para quem usa

Toca no microfone, fala, toca de novo para parar. O texto reconhecido aparece
no campo de digitação, e acima dele um retorno ao vivo mostra o trecho ainda
não confirmado ("Ouvindo: …") enquanto a frase está sendo formada.

Duas decisões de comportamento que valem entender, porque não são as óbvias:

**A fala acrescenta, não substitui.** Dá para digitar metade, ditar o resto, ou
ditar em duas tomadas. O texto novo entra depois do que já estava no campo.

**Nada é enviado sozinho.** A transcrição para no campo de texto e espera o
Enviar. Reconhecimento de fala erra com ruído de trator, sotaque regional e
termo técnico — e uma pergunta errada indo direto ao agente gasta o tempo do
produtor e ainda pode gerar uma resposta sobre a coisa errada. Revisar antes de
mandar custa um segundo e evita isso.

## A tecnologia, e por que esta

Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), que é do
próprio navegador. Três consequências práticas:

- **O áudio nunca chega ao nosso servidor.** O reconhecimento acontece no
  dispositivo do usuário. Não passamos áudio de produtor por infraestrutura
  nossa, o que elimina uma classe inteira de preocupação com dado sensível.
- **Não há custo por minuto.** Não é Whisper, não é transcrição paga, não é
  chamada a LLM. Zero de custo marginal por uso.
- **Não depende do provedor de LLM.** Continua funcionando com a conta do
  OpenRouter zerada, coisa que já aconteceu neste projeto.

O preço dessa escolha é o suporte irregular entre navegadores, tratado abaixo.

## Onde está no código

| Arquivo | Papel |
|---|---|
| `src/frontend/usar-ditado.ts` | Todo o ciclo de vida do reconhecimento, exposto como hook `usarDitado`. |
| `src/frontend/icones-microfone.tsx` | Os dois ícones (`mic` e `mic_alert`) como componentes SVG inline. |
| `src/frontend/chat.tsx` | O botão, o retorno ao vivo e a ligação com o campo de texto. |
| `Icons/` | Os SVGs originais do Material Symbols, de onde os paths vieram. |

O hook devolve `{ suportado, gravando, bloqueado, parcial, erro, alternar }`.
A interface não sabe nada de `SpeechRecognition` — só consome esses seis
campos.

## Decisões de implementação

**O reconhecimento é criado uma vez, não a cada render.** O hook recebe um
callback (`aoTranscrever`) que muda de identidade a cada digitação do usuário.
Se ele entrasse na lista de dependências do `useEffect`, o objeto de
reconhecimento seria destruído e recriado no meio da fala, cortando a gravação.
A solução é guardar o callback em uma `ref` e atualizá-la num efeito separado —
o reconhecimento nasce e morre uma vez só, na montagem e desmontagem.

**O botão some onde a API não existe.** `construtorDisponivel()` procura
`SpeechRecognition` e depois `webkitSpeechRecognition`. Sem nenhum dos dois,
`suportado` fica `false` e o `chat.tsx` simplesmente não renderiza o botão. É
melhor não oferecer o recurso do que oferecer um botão que não faz nada.

A leitura é feita por indexação em `window`, não por `declare global`, para não
colidir com a tipagem que o `lib.dom` do TypeScript possa já trazer para esses
nomes.

**O bloqueio é detectado antes da primeira tentativa.** Um efeito separado
consulta o Permissions API (`navigator.permissions.query({ name: "microphone" })`)
e escuta o `onchange`. Quem já negou o microfone abre a tela com o ícone de
alerta e o rótulo "Microfone sem acesso — libere no navegador", em vez de
descobrir o problema clicando. Nem todo navegador expõe `microphone` nesse API;
onde não expõe, o estado só se revela no `onerror`, e o código aceita isso sem
quebrar.

Só três códigos de erro trocam o ícone — `not-allowed`, `service-not-allowed` e
`audio-capture`. Falha de rede ou silêncio não dizem nada sobre a permissão, e
marcar o ícone de bloqueado nesses casos seria mentira.

**Os ícones são componentes, não `<img>`.** Um SVG carregado como imagem
mantém o `fill` gravado no arquivo. Inline, o `fill="currentColor"` herda a cor
do botão, então o ícone acompanha o tema claro/escuro e fica branco sobre o
vermelho durante a gravação, sem precisar de um segundo arquivo por estado.

**`continuous` e `interimResults` ligados.** O primeiro deixa falar frases
longas sem o reconhecimento encerrar na primeira pausa. O segundo é o que
alimenta o "Ouvindo: …" — sem ele o usuário fala vários segundos olhando para
uma tela parada, sem saber se está funcionando.

**`start()` dentro de `try`.** Chamar `start()` com uma sessão já ativa lança
exceção. Como o estado se corrige sozinho no `onend`, o `catch` apenas evita
derrubar a interface.

## Mensagens de erro

| Código | O que o usuário vê |
|---|---|
| `not-allowed`, `service-not-allowed` | Permissão negada, com instrução de liberar no cadeado da barra de endereço e o aviso sobre https em rede local. |
| `audio-capture` | Nenhum microfone encontrado. |
| `no-speech` | Não ouvi nada — fale mais perto. |
| `network` | O reconhecimento não conseguiu se conectar. |
| `aborted` | Nada. É o que acontece ao parar normalmente; mensagem aqui seria ruído. |
| outros | O código bruto, para não esconder um caso não previsto. |

## Limitações

**Firefox não implementa a API.** Lá o botão não aparece. Chrome e Edge
funcionam; Safari tem suporte parcial. Cobrir o Firefox exigiria transcrição no
servidor, o que traria custo por minuto e faria o áudio trafegar — as duas
coisas que esta escolha evita.

**Exige contexto seguro.** `localhost` conta como seguro, então o
desenvolvimento funciona. Mas abrir o app pelo IP da rede local
(`http://192.168.x.x:3000`) para testar no celular no meio do pomar **não**
funciona: o navegador recusa o microfone. Nesse cenário é preciso https ou um
túnel. A mensagem de permissão negada cita isso justamente porque é o engano
mais provável.

**O reconhecimento do Chrome envia áudio aos servidores do Google.** É do
navegador, não nosso, e não passa pela nossa infraestrutura — mas não é
processamento estritamente local, e vale saber disso antes de prometer o
contrário a alguém.

**Vocabulário técnico erra.** "Cladódio", "irapuá" e nomes de princípio ativo
não estão no vocabulário comum do reconhecimento. Não há como treinar o modelo
do navegador. É mais uma razão para a transcrição parar no campo de texto em
vez de ir direto ao agente.

## Como testar

Precisa de microfone real e de `http://localhost:3000` ou https.

1. `npm run dev` e abrir o chat.
2. Tocar no microfone. Na primeira vez o navegador pede permissão.
3. Falar uma frase e conferir se o "Ouvindo: …" acompanha.
4. Parar e verificar se o texto ficou no campo, sem envio automático.
5. Negar a permissão e recarregar: o botão deve abrir já com o ícone de alerta,
   sem precisar de clique.

O painel de navegador embutido no Claude Code bloqueia captura de dispositivo,
então por ali só dá para validar os caminhos de erro e de bloqueio — nunca a
transcrição em si.
