# web-optimizer-cli

**Bun** CLI to optimize and convert:

- Images → **WebP**
- Videos → **WebM**

Supports **multiple files/folders** in a single run. By default it reads from `./input` and writes to `./output` — just drop your files in and run.

## Requirements

- [Bun](https://bun.sh)
- `ffmpeg` installed on the system (video conversion only)

## Installation

```bash
bun install
```

## Quick start

### Convert all images in `./input` to WebP

```bash
bun run src/index.ts --mode image
```

### Convert specific images

```bash
bun run src/index.ts --mode image -i ./assets/a.png ./assets/b.jpg -o ./out -q 75
```

### Convert all videos in a folder (recursive) to WebM

```bash
bun run src/index.ts --mode video -i ./videos --recursive --crf 30
```

## Options

| Flag                     | Description                     | Default    |
| ------------------------ | ------------------------------- | ---------- |
| `--mode <image\|video>`  | Conversion type **(required)**  | —          |
| `--input, -i <paths...>` | One or more input files/folders | `./input`  |
| `--output, -o <dir>`     | Output folder                   | `./output` |
| `--quality, -q <1-100>`  | Output quality                  | `80`       |
| `--recursive, -r`        | Walk sub-folders                | `false`    |
| `--overwrite`            | Overwrite existing output files | `false`    |

### Image extras (WebP)

| Flag                                             | Description       | Default   |
| ------------------------------------------------ | ----------------- | --------- |
| `--preset <default\|photo\|drawing\|icon\|text>` | Sharp WebP preset | `default` |

### Video extras (WebM via ffmpeg)

| Flag                | Description                  | Default |
| ------------------- | ---------------------------- | ------- |
| `--fps <n>`         | Force output FPS             | —       |
| `--crf <n>`         | VP9 quality (lower = better) | `32`    |
| `--bitrate <value>` | e.g. `1M`, `800k`            | —       |

## Binary usage

```bash
bun run web-optimizer --mode image --recursive
```
