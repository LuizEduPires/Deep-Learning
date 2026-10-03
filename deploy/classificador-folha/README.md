# Serviço do classificador de pitaia

API HTTP local para classificar uma imagem de cladódio em nove doenças e
`Saudável`. Usa o modelo ONNX treinado no ROCm e ONNX Runtime com provedor CPU
para inferência portátil. O processo mantém o modelo na memória e limita a
leitura de imagens a 20 MiB e 40 megapixels.

## Rotas

- `GET /healthz`: disponibilidade, nome do modelo e número de classes.
- `POST /classificar`: corpo binário da imagem, com `Content-Type` JPEG, PNG,
  WebP, BMP ou TIFF. A resposta contém `classe`, `confianca` e `top_3`.

Exemplo:

```bash
curl -X POST http://localhost:8080/classificar \
  -H 'Content-Type: image/jpeg' \
  --data-binary @folha.jpg
```

## Docker

```bash
docker build -t pitaya-classificador-folha .
docker run --rm -p 8080:8080 pitaya-classificador-folha
```

Para uma implantação Compose interna, conecte o contêiner somente à rede
privada do Pitaya e não publique a porta do serviço na internet. O processo
aceita `PORT`, `ORT_THREADS` e `MAX_IMAGE_MB` como variáveis de ambiente.

O serviço não armazena as imagens. Restringir quem consegue acessá-lo e
encaminhar arquivos do usuário com tamanho/tipo validados continuam sendo
responsabilidades do backend que o integra.
