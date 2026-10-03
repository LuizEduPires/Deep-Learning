# Análise de fotos de cladódios

No chat, selecione **Analisar folha**, escolha uma imagem e envie sua pergunta
junto dela; para análise sem pergunta, o chat pede ao Dr. Pitaya que explique o
resultado. A resposta mostra as três pontuações principais do classificador e
uma explicação em texto. O Dr. Pitaya recebe a classificação e as pontuações
como texto para manter o suporte a todos os provedores de LLM, inclusive os que
não aceitam imagens.

O resultado do MobileNetV3-Small é uma sugestão entre as dez classes treinadas,
e as pontuações não são probabilidades calibradas de diagnóstico. A foto
original não é vista pelo LLM nem armazenada. O histórico guarda apenas o nome
do arquivo e o resultado para que perguntas futuras mantenham esse contexto.
Envie uma foto por mensagem, JPEG, PNG, WebP, BMP ou TIFF, de até **20 MiB**
e **40 megapixels**. O total da requisição multipart pode chegar a **21 MiB**.

## Implantação

`deploy/classificador-folha/` é o pacote de implantação copiado do projeto de
treinamento. Ele mantém o modelo ONNX na memória e faz inferência por CPU. Ao
usar o Compose do Pitaya, o serviço inicia automaticamente na rede interna,
sem porta publicada. O app acessa `/classificar` por
`http://classificador-folha:8080`; o classificador não precisa de chave de LLM
nem de acesso à internet.

```bash
docker compose up -d --build
docker compose ps classificador-folha app gateway
```

`CLASSIFICADOR_FOLHA_URL` configura o destino do app. O valor padrão no Compose
é o endereço interno do serviço. Com `npm run dev` na máquina, deixe a variável
vazia para usar `http://127.0.0.1:8080` e inicie o serviço localmente:

```bash
docker build -t pitaya-classificador-folha ./deploy/classificador-folha
docker run --rm -p 8080:8080 pitaya-classificador-folha
curl http://localhost:8080/healthz
```

Para detalhes do endpoint, consulte o [README do serviço](../deploy/classificador-folha/README.md).
