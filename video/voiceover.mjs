/**
 * Voix off du film de présentation, générée avec ElevenLabs.
 *
 *   npm run voix    (= node --env-file=../.env.local voiceover.mjs)
 *   npm run render  rend ensuite le film calé sur la voix
 *
 * Chaque réplique est générée à part. Le script mesure sa durée réelle, en déduit
 * le minutage des scènes (audio/timing.js, lu par composition.html) et assemble
 * la piste audio/voix-off.wav au même minutage. Les répliques déjà générées sont
 * gardées dans audio/ et ne sont pas refacturées tant que leur texte ne change pas.
 */
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ffmpeg = createRequire(import.meta.url)("ffmpeg-static");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUDIO = path.join(HERE, "audio");

// Voix française « publicité et bande-annonce » de la bibliothèque ElevenLabs (forfaits payants),
// avec repli sur Daniel (voix intégrée, ton posé) si la première n'est pas accessible.
const VOICES = [
  { id: "ecxPjiGTvAfpGEams6ec", name: "Paul K (voix pub française)" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel (voix intégrée)" },
];
const MODEL = "eleven_v4";
const SETTINGS = { stability: 0.6, similarityBoost: 0.75 };

const LINES = [
  "Six heures trente… Vos locaux sont encore fermés. Nous ? On est déjà là.",
  "France Propreté Hygiène. Votre environnement, notre priorité.",
  "Six secteurs. Un seul interlocuteur.",
  "Bureaux.",
  "Copropriétés.",
  "Commerces.",
  "Médical et paramédical.",
  "Industrie et entrepôts.",
  "Nettoyage spécifique.",
  "Décapage de sols et de façades. L'éclat d'origine, retrouvé.",
  "Disponibles sept jours sur sept, vingt-quatre heures sur vingt-quatre. Visite technique et devis… gratuits.",
  "Demandez votre devis gratuit. En ligne, ou par téléphone.",
];

// Retire les silences de début et de fin d'une réplique
const TRIM = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse";

const client = new ElevenLabsClient();

async function speak(voice, i) {
  const audio = await client.textToSpeech.convert(voice.id, {
    text: LINES[i],
    modelId: MODEL,
    languageCode: "fr",
    voiceSettings: SETTINGS,
    outputFormat: "mp3_44100_128",
    previousText: LINES[i - 1],
    nextText: LINES[i + 1],
  });
  return buffer(Readable.fromWeb(audio));
}

// Essaie chaque voix sur la première réplique : la première accessible avec ce compte est retenue
async function pickVoice(manifest) {
  const known = VOICES.find((v) => v.id === manifest.voice);
  if (known) return { voice: known };
  for (const voice of VOICES) {
    try {
      return { voice, first: await speak(voice, 0) };
    } catch (err) {
      if (![400, 401, 402, 403, 404, 422].includes(err.statusCode)) throw err;
      console.warn(`Voix « ${voice.name} » indisponible (${err.statusCode}).`);
    }
  }
  throw new Error("Aucune voix accessible avec cette clé ElevenLabs.");
}

async function generate() {
  mkdirSync(AUDIO, { recursive: true });
  const manifestPath = path.join(AUDIO, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const { voice, first } = await pickVoice(manifest);
  manifest.voice = voice.id;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const files = [];
  for (const i of LINES.keys()) {
    const key = createHash("sha1").update(voice.id + MODEL + LINES[i]).digest("hex").slice(0, 10);
    const file = path.join(AUDIO, `replique-${String(i + 1).padStart(2, "0")}-${key}.mp3`);
    if (!existsSync(file)) {
      writeFileSync(file, i === 0 && first ? first : await speak(voice, i));
      console.log(`Réplique ${i + 1} générée : ${LINES[i]}`);
    }
    files.push(file);
  }
  return { files, voice };
}

// Durée d'une réplique sans ses silences
function spokenLength(file) {
  const { stderr } = spawnSync(ffmpeg, ["-hide_banner", "-i", file, "-af", TRIM, "-f", "null", "-"], { encoding: "utf8" });
  const all = [...stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)];
  const m = all[all.length - 1];
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}

// Minutage des scènes : chaque scène dure au moins le temps de son animation et de sa réplique
function layout(len) {
  const r = (x) => Math.round(x * 100) / 100;
  const at = [];
  const T = {};
  at[0] = 0.4;
  T.lineB = r(at[0] + len[0] * 0.66);
  T.s2 = r(Math.max(4.9, at[0] + len[0] + 0.7));
  at[1] = T.s2 + 0.4;
  T.s3 = r(T.s2 + Math.max(4.0, 0.4 + len[1] + 0.8));
  at[2] = T.s3 + 0.15;
  T.slides = [r(T.s3 + Math.max(1.6, 0.15 + len[2] + 0.4))];
  for (let i = 0; i < 6; i++) {
    at[3 + i] = T.slides[i] + 0.3;
    const next = T.slides[i] + Math.max(1.75, 0.3 + len[3 + i] + 0.45);
    if (i < 5) T.slides.push(r(next));
    else T.s4 = r(next);
  }
  at[9] = T.s4 + 0.6;
  T.s5 = r(T.s4 + Math.max(4.5, 0.6 + len[9] + 0.6));
  at[10] = T.s5 + 0.35;
  T.s6 = r(T.s5 + Math.max(5.2, 0.35 + len[10] + 0.6));
  at[11] = T.s6 + 0.8;
  T.end = r(T.s6 + Math.max(6.0, 0.8 + len[11] + 1.8));
  return { T, at };
}

function mix(files, at, end) {
  const inputs = files.flatMap((f) => ["-i", f]);
  const chains = files.map((_, i) => {
    const ms = Math.round(at[i] * 1000);
    return `[${i}:a]${TRIM},adelay=${ms}|${ms}[a${i}]`;
  });
  const labels = files.map((_, i) => `[a${i}]`).join("");
  const graph = `${chains.join(";")};${labels}amix=inputs=${files.length}:normalize=0,apad,atrim=0:${end},loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  const out = path.join(AUDIO, "voix-off.wav");
  const r = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", graph, "-map", "[out]", "-ar", "48000", "-ac", "2", out], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("Échec du mixage de la voix off");
  return out;
}

const { files, voice } = await generate();
const { T, at } = layout(files.map(spokenLength));
writeFileSync(path.join(AUDIO, "timing.js"), `window.TIMING = ${JSON.stringify(T)};\n`);
mix(files, at, T.end);
console.log(`Voix off prête (${voice.name}), film de ${T.end.toFixed(1)} s : audio/voix-off.wav et audio/timing.js`);
