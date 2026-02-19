#!/usr/bin/env bun

import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

type Mode = "image" | "video";

type CliOptions = {
  mode: Mode;
  input: string[];
  outputDir: string;
  quality: number;
  recursive: boolean;
  overwrite: boolean;
  preset: "default" | "photo" | "drawing" | "icon" | "text";
  fps?: number;
  crf?: number;
  bitrate?: string;
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".tiff", ".bmp", ".avif", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".avi", ".m4v", ".wmv", ".webm"]);

function printHelp() {
  console.log(`\nweb-optimizer - CLI Bun para otimizar e converter arquivos\n
Uso:
  bun run src/index.ts --mode <image|video> --input <arquivo...|pasta...> [opções]

Opções gerais:
  --mode <image|video>      Tipo de conversão (obrigatório)
  --input, -i <paths...>    Um ou mais arquivos/pastas de entrada (obrigatório)
  --output, -o <dir>        Pasta de saída (default: ./dist)
  --quality, -q <1-100>     Qualidade da saída (default: 80)
  --recursive, -r           Percorre pastas recursivamente
  --overwrite               Sobrescreve arquivo de saída se existir

Opções imagem (WebP):
  --preset <default|photo|drawing|icon|text> (default: default)

Opções vídeo (WebM via ffmpeg):
  --fps <n>                 Força FPS na saída
  --crf <n>                 Qualidade VP9 (menor = melhor, default: 32)
  --bitrate <valor>         Ex.: 1M, 800k

Exemplos:
  bun run src/index.ts --mode image -i ./assets/a.png ./assets/b.jpg -o ./out -q 75
  bun run src/index.ts --mode video -i ./videos --recursive -o ./out --crf 30
`);
}

function parseArgs(argv: string[]): CliOptions {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  let mode: Mode | undefined;
  const input: string[] = [];
  let outputDir = "dist";
  let quality = 80;
  let recursive = false;
  let overwrite = false;
  let preset: CliOptions["preset"] = "default";
  let fps: number | undefined;
  let crf: number | undefined;
  let bitrate: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--mode") {
      const value = argv[++i];
      if (value !== "image" && value !== "video") {
        throw new Error("--mode deve ser image ou video.");
      }
      mode = value;
      continue;
    }

    if (arg === "--input" || arg === "-i") {
      while (argv[i + 1] && !argv[i + 1].startsWith("-")) {
        input.push(argv[++i]);
      }
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      outputDir = argv[++i] ?? outputDir;
      continue;
    }

    if (arg === "--quality" || arg === "-q") {
      quality = Number(argv[++i]);
      continue;
    }

    if (arg === "--recursive" || arg === "-r") {
      recursive = true;
      continue;
    }

    if (arg === "--overwrite") {
      overwrite = true;
      continue;
    }

    if (arg === "--preset") {
      const value = argv[++i] as CliOptions["preset"];
      if (!["default", "photo", "drawing", "icon", "text"].includes(value)) {
        throw new Error("Preset inválido. Use: default, photo, drawing, icon ou text.");
      }
      preset = value;
      continue;
    }

    if (arg === "--fps") {
      fps = Number(argv[++i]);
      continue;
    }

    if (arg === "--crf") {
      crf = Number(argv[++i]);
      continue;
    }

    if (arg === "--bitrate") {
      bitrate = argv[++i];
      continue;
    }

    if (!arg.startsWith("-")) {
      input.push(arg);
      continue;
    }

    throw new Error(`Argumento desconhecido: ${arg}`);
  }

  if (!mode) {
    throw new Error("Informe --mode <image|video>.");
  }

  if (input.length === 0) {
    throw new Error("Informe ao menos um caminho de entrada com --input.");
  }

  if (!Number.isFinite(quality) || quality < 1 || quality > 100) {
    throw new Error("--quality deve ser um número entre 1 e 100.");
  }

  return {
    mode,
    input,
    outputDir,
    quality,
    recursive,
    overwrite,
    preset,
    fps,
    crf,
    bitrate,
  };
}

async function collectFiles(pathsInput: string[], recursive: boolean, mode: Mode): Promise<string[]> {
  const extensions = mode === "image" ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS;
  const files: string[] = [];

  async function walk(targetPath: string): Promise<void> {
    const targetStat = await stat(targetPath);

    if (targetStat.isDirectory()) {
      const items = await readdir(targetPath);
      for (const item of items) {
        const fullPath = path.join(targetPath, item);
        const itemStat = await stat(fullPath);
        if (itemStat.isDirectory()) {
          if (recursive) {
            await walk(fullPath);
          }
          continue;
        }

        if (extensions.has(path.extname(fullPath).toLowerCase())) {
          files.push(fullPath);
        }
      }
      return;
    }

    if (extensions.has(path.extname(targetPath).toLowerCase())) {
      files.push(targetPath);
    }
  }

  for (const inputPath of pathsInput) {
    await walk(path.resolve(inputPath));
  }

  return [...new Set(files)];
}

async function outputPathFor(source: string, outputDir: string, extension: ".webp" | ".webm") {
  const base = path.basename(source, path.extname(source));
  const outPath = path.join(path.resolve(outputDir), `${base}${extension}`);
  await mkdir(path.dirname(outPath), { recursive: true });
  return outPath;
}

async function convertImage(source: string, options: CliOptions) {
  const outPath = await outputPathFor(source, options.outputDir, ".webp");

  if (!options.overwrite && (await Bun.file(outPath).exists())) {
    console.log(`⏭️  Ignorado (já existe): ${outPath}`);
    return;
  }

  const { default: sharp } = await import("sharp");

  await sharp(source)
    .webp({ quality: options.quality, preset: options.preset })
    .toFile(outPath);

  console.log(`✅ Imagem convertida: ${source} -> ${outPath}`);
}

function buildVideoArgs(source: string, outPath: string, options: CliOptions): string[] {
  const args = ["-y", "-i", source, "-c:v", "libvpx-vp9", "-crf", String(options.crf ?? 32), "-b:v", options.bitrate ?? "0"];

  if (options.fps) {
    args.push("-r", String(options.fps));
  }

  args.push("-c:a", "libopus", outPath);

  return args;
}

async function convertVideo(source: string, options: CliOptions) {
  const outPath = await outputPathFor(source, options.outputDir, ".webm");

  if (!options.overwrite && (await Bun.file(outPath).exists())) {
    console.log(`⏭️  Ignorado (já existe): ${outPath}`);
    return;
  }

  const ffmpegCheck = Bun.spawn(["ffmpeg", "-version"], { stdout: "ignore", stderr: "ignore" });
  const ffmpegCheckCode = await ffmpegCheck.exited;
  if (ffmpegCheckCode !== 0) {
    throw new Error("ffmpeg não encontrado. Instale ffmpeg para converter vídeos.");
  }

  const proc = Bun.spawn(["ffmpeg", ...buildVideoArgs(source, outPath, options)], { stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;

  if (code !== 0) {
    throw new Error(`Falha ao converter vídeo: ${source}`);
  }

  console.log(`✅ Vídeo convertido: ${source} -> ${outPath}`);
}

async function run() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const files = await collectFiles(options.input, options.recursive, options.mode);

    if (files.length === 0) {
      throw new Error("Nenhum arquivo compatível encontrado para converter.");
    }

    console.log(`🔎 Encontrados ${files.length} arquivo(s) para conversão (${options.mode}).`);

    for (const file of files) {
      if (options.mode === "image") {
        await convertImage(file, options);
      } else {
        await convertVideo(file, options);
      }
    }

    console.log("🎉 Conversão concluída.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

void run();
