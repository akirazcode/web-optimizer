#!/usr/bin/env bun

import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

type Mode = 'image' | 'video';

type CliOptions = {
  mode: Mode;
  input: string[];
  outputDir: string;
  quality: number;
  recursive: boolean;
  overwrite: boolean;
  preset: 'default' | 'photo' | 'drawing' | 'icon' | 'text';
  fps?: number;
  crf?: number;
  bitrate?: string;
};

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.tiff',
  '.bmp',
  '.avif',
  '.webp',
]);
const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.m4v',
  '.wmv',
  '.webm',
]);

const DEFAULT_INPUT_DIR = './input';
const DEFAULT_OUTPUT_DIR = './output';

function printHelp() {
  console.log(`\nweb-optimizer - Bun CLI to optimize and convert media files\n
Usage:
  bun run src/index.ts --mode <image|video> [options]

General options:
  --mode <image|video>      Conversion type (required)
  --input, -i <paths...>    One or more input files/folders (default: ${DEFAULT_INPUT_DIR})
  --output, -o <dir>        Output folder (default: ${DEFAULT_OUTPUT_DIR})
  --quality, -q <1-100>     Output quality (default: 80)
  --recursive, -r           Walk folders recursively
  --overwrite               Overwrite output file if it already exists

Image options (WebP):
  --preset <default|photo|drawing|icon|text> (default: default)

Video options (WebM via ffmpeg):
  --fps <n>                 Force FPS on output
  --crf <n>                 VP9 quality (lower = better, default: 32)
  --bitrate <value>         e.g. 1M, 800k

Examples:
  bun run src/index.ts --mode image
  bun run src/index.ts --mode image -i ./assets/a.png ./assets/b.jpg -o ./out -q 75
  bun run src/index.ts --mode video -i ./videos --recursive -o ./out --crf 30
`);
}

function parseArgs(argv: string[]): CliOptions {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let mode: Mode | undefined;
  const input: string[] = [];
  let outputDir = DEFAULT_OUTPUT_DIR;
  let quality = 80;
  let recursive = false;
  let overwrite = false;
  let preset: CliOptions['preset'] = 'default';
  let fps: number | undefined;
  let crf: number | undefined;
  let bitrate: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--mode') {
      const value = argv[++i];
      if (value !== 'image' && value !== 'video') {
        throw new Error('--mode must be image or video.');
      }
      mode = value;
      continue;
    }

    if (arg === '--input' || arg === '-i') {
      while (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        input.push(argv[++i]);
      }
      continue;
    }

    if (arg === '--output' || arg === '-o') {
      outputDir = argv[++i] ?? outputDir;
      continue;
    }

    if (arg === '--quality' || arg === '-q') {
      quality = Number(argv[++i]);
      continue;
    }

    if (arg === '--recursive' || arg === '-r') {
      recursive = true;
      continue;
    }

    if (arg === '--overwrite') {
      overwrite = true;
      continue;
    }

    if (arg === '--preset') {
      const value = argv[++i] as CliOptions['preset'];
      if (!['default', 'photo', 'drawing', 'icon', 'text'].includes(value)) {
        throw new Error(
          'Invalid preset. Use: default, photo, drawing, icon or text.',
        );
      }
      preset = value;
      continue;
    }

    if (arg === '--fps') {
      fps = Number(argv[++i]);
      continue;
    }

    if (arg === '--crf') {
      crf = Number(argv[++i]);
      continue;
    }

    if (arg === '--bitrate') {
      bitrate = argv[++i];
      continue;
    }

    if (!arg.startsWith('-')) {
      input.push(arg);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!mode) {
    throw new Error('Please provide --mode <image|video>.');
  }

  // Default to the ./input directory if no input was specified
  if (input.length === 0) {
    input.push(DEFAULT_INPUT_DIR);
  }

  if (!Number.isFinite(quality) || quality < 1 || quality > 100) {
    throw new Error('--quality must be a number between 1 and 100.');
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

async function collectFiles(
  pathsInput: string[],
  recursive: boolean,
  mode: Mode,
): Promise<string[]> {
  const extensions = mode === 'image' ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS;
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

async function outputPathFor(
  source: string,
  outputDir: string,
  extension: '.webp' | '.webm',
) {
  const base = path.basename(source, path.extname(source));
  const outPath = path.join(path.resolve(outputDir), `${base}${extension}`);
  await mkdir(path.dirname(outPath), { recursive: true });
  return outPath;
}

async function convertImage(source: string, options: CliOptions) {
  const outPath = await outputPathFor(source, options.outputDir, '.webp');

  if (!options.overwrite && (await Bun.file(outPath).exists())) {
    console.log(`⏭️  Skipped (already exists): ${outPath}`);
    return;
  }

  const { default: sharp } = await import('sharp');

  await sharp(source)
    .webp({ quality: options.quality, preset: options.preset })
    .toFile(outPath);

  console.log(`✅ Image converted: ${source} -> ${outPath}`);
}

function buildVideoArgs(
  source: string,
  outPath: string,
  options: CliOptions,
): string[] {
  const args = [
    '-y',
    '-i',
    source,
    '-c:v',
    'libvpx-vp9',
    '-crf',
    String(options.crf ?? 32),
    '-b:v',
    options.bitrate ?? '0',
  ];

  if (options.fps) {
    args.push('-r', String(options.fps));
  }

  args.push('-c:a', 'libopus', outPath);

  return args;
}

async function convertVideo(source: string, options: CliOptions) {
  const outPath = await outputPathFor(source, options.outputDir, '.webm');

  if (!options.overwrite && (await Bun.file(outPath).exists())) {
    console.log(`⏭️  Skipped (already exists): ${outPath}`);
    return;
  }

  const ffmpegCheck = Bun.spawn(['ffmpeg', '-version'], {
    stdout: 'ignore',
    stderr: 'ignore',
  });
  const ffmpegCheckCode = await ffmpegCheck.exited;
  if (ffmpegCheckCode !== 0) {
    throw new Error(
      'ffmpeg not found. Please install ffmpeg to convert videos.',
    );
  }

  const proc = Bun.spawn(
    ['ffmpeg', ...buildVideoArgs(source, outPath, options)],
    { stdout: 'inherit', stderr: 'inherit' },
  );
  const code = await proc.exited;

  if (code !== 0) {
    throw new Error(`Failed to convert video: ${source}`);
  }

  console.log(`✅ Video converted: ${source} -> ${outPath}`);
}

async function run() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const files = await collectFiles(
      options.input,
      options.recursive,
      options.mode,
    );

    if (files.length === 0) {
      throw new Error('No compatible files found to convert.');
    }

    console.log(
      `🔎 Found ${files.length} file(s) to convert (${options.mode}).`,
    );

    for (const file of files) {
      if (options.mode === 'image') {
        await convertImage(file, options);
      } else {
        await convertVideo(file, options);
      }
    }

    console.log('🎉 Conversion complete.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

void run();
