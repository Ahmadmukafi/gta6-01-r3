// VERTEX CITY — Skyline Outlaw. gta6-01 round 3 entrypoint (Node 22,
// standard library only). The game is plain static files under game/;
// this program hands them in: it copies game/ and screenshots/ beside
// this file into the output directory and writes dossier.json with the
// kit's vendored buildDossier, byte for byte what the scorer rebuilds.
// Run locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader /output is used instead (MAKEFUN_OUTPUT_DIR unset).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps for this bounty (reference/gate.json): the text
// cap shapes the dossier bytes; the rest refuse an entry the scorer
// would refuse anyway, so a bad hand-in fails loudly here, not there.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(name) {
  const src = join(repoRoot, name);
  const dst = join(outDir, name);
  if (!existsSync(src)) {
    if (name === 'screenshots') {
      // Screenshots are added by the maker after the first hand-in check;
      // an empty folder still keeps the output layout the scorer expects.
      mkdirSync(dst, { recursive: true });
      return;
    }
    throw new Error(`missing ${name}/ beside main.ts`);
  }
  cpSync(src, dst, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, dossierCaps));
console.log(`vertex-city: handed in game/ + screenshots/ to ${outDir}`);
