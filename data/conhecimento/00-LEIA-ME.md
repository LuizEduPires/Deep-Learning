# Como alimentar a base de conhecimento

Fonte: documentação interna do projeto

Esta pasta é a base própria de conhecimento — a fonte primária do chat e o que
diferencia este produto de um chatbot genérico.

## Com o `npm run dev` rodando, basta salvar o arquivo aqui

O servidor de desenvolvimento observa esta pasta. Salvar um `.md` aqui dispara
a ingestão daquele arquivo sozinho, e em poucos segundos ele já pode ser citado
pelo Dr. Pitaya — sem comando nenhum, sem reiniciar nada.

Você vê no terminal do `npm run dev`:

```
[conhecimento] Título do documento — 4 trecho(s) atualizados.
```

Se essa linha não aparecer ao salvar, o servidor foi iniciado antes desta
funcionalidade existir: pare e rode `npm run dev` de novo.

O Postgres precisa estar no ar (`npm run db:up`). A busca consulta o banco a
cada pergunta, então o conhecimento novo vale já na pergunta seguinte.

## Quando ainda é preciso rodar o comando

```
npm run db:seed
```

Ingere a pasta inteira. Serve para semear do zero, para reingerir tudo depois
de repor crédito de embeddings, e para máquinas onde o dev server não está no
ar. É idempotente por título: reimportar substitui a versão anterior daquele
documento, sem duplicar — inclusive se você renomear o arquivo.

**Apagar o arquivo não apaga o documento do banco.** Nem o observador nem o
`db:seed` removem o que saiu da pasta, porque o título vive dentro do arquivo
que deixou de existir. Para tirar um documento de circulação:

```
docker exec pitaya-db psql -U pitaya -d pitaya -c "delete from documents where title = 'Título exato do documento';"
```

Para conferir o que está na base:

```
docker exec pitaya-db psql -U pitaya -d pitaya -c "select d.title, count(c.id) from documents d join chunks c on c.document_id=d.id group by d.title order by 2 desc;"
```

Se o título do seu documento não aparecer nessa lista, ele não está na base —
independentemente de o arquivo existir na pasta.

## Formato de um documento

Um arquivo `.md` por tema, com duas convenções lidas pelo script de ingestão:

- A primeira linha `# Título` vira o título do documento. **É o que aparece
  como citação na resposta ao produtor**, então escreva um título que ele
  entenda ao ler ("Cultivo da Pitaya — cartilha", não "doc_v3_final").
- Uma linha `Fonte: ...` registra a origem: publicação, autor, ano, URL.

O resto é texto livre. O script quebra em trechos de ~1200 caracteres,
preferindo cortar em quebra de parágrafo. Trechos com menos de 50 caracteres
são descartados.

Sem `# Título`, o nome do arquivo vira o título — e nome de arquivo costuma dar
citação ruim. Vale sempre escrever a primeira linha.

## Três caminhos para entrar aqui

**1. Markdown.** Escreva o `.md` direto nesta pasta e rode `npm run db:seed`.
É o caminho com melhor resultado, porque você controla o recorte e o título.

**2. PDF com camada de texto.** Coloque o arquivo em `Rag/` e rode:

```
npm run rag:pdf
```

Ele gera o `.md` aqui, juntando linhas quebradas pelo layout, removendo
cabeçalho e rodapé repetidos e desfazendo hifenização. Depois rode o
`db:seed`. Se o título sair ruim — metadado de PDF costuma trazer hash ou nome
de documento do InDesign —, acrescente uma entrada no dicionário `TITULOS` em
`scripts/pdf-para-md.py`.

**3. PDF escaneado.** O `rag:pdf` detecta a ausência de camada de texto, pula o
arquivo e o lista no fim da execução. Esse caso precisa de transcrição antes de
virar `.md`.

## Como escrever para ser encontrado

A busca hoje é full-text: acha por palavra, não por sentido. Isso tem
consequência prática na hora de redigir.

- Use os termos que o produtor usaria na pergunta, não só o nome científico.
  Escreva "abelha irapuá (Trigona spinipes)", não apenas o nome em latim.
- Repita o assunto dentro do parágrafo. Um trecho que começa com "Nessa região
  o plantio vai de setembro a novembro" não casa com uma busca por
  "Centro-Oeste" se o nome da região só apareceu no parágrafo anterior — a
  quebra em trechos de 1200 caracteres separa os dois.
- Nomeie explicitamente estados, regiões, pragas e doenças em cada parágrafo
  que trate deles. É o que o produtor digita.
- Prefira parágrafos temáticos e completos a listas de uma linha.

Quando houver crédito na conta da OpenAI, a busca vetorial liga sozinha na
próxima ingestão e essa limitação diminui.

## Aviso sobre os documentos iniciais

Os arquivos que acompanham este projeto são um **ponto de partida** com práticas
consolidadas de cultivo da pitaya. Antes de usar em produção, revise-os com o
responsável técnico e substitua por material da sua própria operação e por
publicações da Embrapa, IAC e universidades — o valor da base vem da curadoria,
não do volume.
