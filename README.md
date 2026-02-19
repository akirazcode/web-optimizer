# web-optimizer-cli

CLI em **Bun** para otimizar e converter:

- Imagens para **WebP**
- Vídeos para **WebM**

Com suporte a **múltiplos arquivos/pastas** em uma única execução.

## Requisitos

- [Bun](https://bun.sh)
- `ffmpeg` instalado no sistema (apenas para vídeo)

## Instalação

```bash
bun install
```

## Uso rápido

### Converter múltiplas imagens para WebP

```bash
bun run src/index.ts --mode image --input ./imgs/a.png ./imgs/b.jpg --output ./saida --quality 80
```

### Converter todos os vídeos de uma pasta (recursivo) para WebM

```bash
bun run src/index.ts --mode video --input ./videos --recursive --output ./saida --crf 30
```

## Opções

- `--mode <image|video>` (obrigatório)
- `--input, -i <paths...>` (obrigatório, aceita múltiplos)
- `--output, -o <dir>` (default: `dist`)
- `--quality, -q <1-100>` (default: `80`)
- `--recursive, -r` (varre subpastas)
- `--overwrite` (sobrescreve arquivo existente)

### Extras para imagem (WebP)

- `--preset <default|photo|drawing|icon|text>`

### Extras para vídeo (WebM)

- `--fps <n>`
- `--crf <n>` (default: `32`)
- `--bitrate <valor>` (ex: `1M`, `800k`)

## Binário

Você também pode usar via binário:

```bash
bun run web-optimizer --mode image -i ./imgs --recursive
```
