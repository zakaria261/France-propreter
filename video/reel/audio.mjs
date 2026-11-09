/**
 * Bande son du Reel Instagram : voix off, bruitages et musique générés avec ElevenLabs.
 *
 *   npm run reel:audio   (= node --env-file=../.env.local reel/audio.mjs)
 *   npm run reel         rend ensuite le Reel
 *
 * La voix est générée avec l'horodatage de chaque lettre : le script en déduit le moment
 * de chaque mot et fixe tout le minutage du Reel (reel/audio/timing.js, lu par reel.html).
 * Il assemble ensuite voix, bruitages et musique dans reel/audio/mix.wav.
 * Tout ce qui a déjà été généré est gardé dans reel/audio/ et n'est pas refacturé.
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
const OUT = path.join(HERE, "audio");

// Daniel : voix intégrée, accessible avec le forfait gratuit
const VOICE = "onwK4e9ZLuTAKqWW03F9";
const MODEL = "eleven_v4";
const SETTINGS = { stability: 0.45, similarityBoost: 0.8 };

const LINES = {
  hook: "Ce hall… on nous l'a confié comme ça.",
  look: "Regardez bien.",
  facades: "Les façades…",
  bureaux: "Les bureaux…",
  brand: "France Propreté Hygiène.",
  list: "Bureaux. Copropriétés. Commerces. Cabinets médicaux. Entrepôts.",
  dispo: "Sept jours sur sept. Vingt-quatre heures sur vingt-quatre.",
  zone: "Partout en Rhône-Alpes.",
  cta: "Votre devis est gratuit. Le lien est en bio !",
};

const SFX = {
  impact: { text: "Deep punchy cinematic boom impact hit with short sub bass tail", duration: 1.6 },
  whoosh: { text: "Fast airy whoosh swoosh transition, clean, modern", duration: 0.8 },
  squeegee: { text: "Rubber window squeegee wiping across wet glass in one long satisfying squeaky swipe", duration: 1.3 },
  shine: { text: "Bright sparkling shimmer chime, magical clean shine sound", duration: 1.4 },
  glitch: { text: "Short digital glitch stutter, electronic", duration: 0.6 },
  ticks: { text: "Fast mechanical slot machine reels rolling then stopping with a click", duration: 1.2 },
  pop: { text: "Soft bubbly UI pop", duration: 0.5 },
  riser: { text: "Short cinematic tension riser swelling up", duration: 1.6 },
};

const MUSIC = "Energetic premium trap-house instrumental for a punchy Instagram ad: deep 808 bass, crisp hi-hats, confident driving groove, modern and clean, 122 BPM, no vocals";

const client = new ElevenLabsClient();
const hash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 10);
const toBuffer = (s) => buffer(typeof s.pipe === "function" ? s : Readable.fromWeb(s));

// ---------- Génération (avec cache) ----------

async function voiceLine(id, i, ids) {
  const text = LINES[id];
  const base = path.join(OUT, `voix-${id}-${hash(VOICE + MODEL + text)}`);
  if (!existsSync(base + ".json")) {
    const res = await client.textToSpeech.convertWithTimestamps(VOICE, {
      text,
      modelId: MODEL,
      languageCode: "fr",
      voiceSettings: SETTINGS,
      outputFormat: "mp3_44100_128",
      previousText: LINES[ids[i - 1]],
      nextText: LINES[ids[i + 1]],
    });
    writeFileSync(base + ".mp3", Buffer.from(res.audioBase64, "base64"));
    writeFileSync(base + ".json", JSON.stringify(res.alignment));
    console.log(`Voix « ${id} » générée`);
  }
  const a = JSON.parse(readFileSync(base + ".json", "utf8"));
  // Regroupe les lettres en mots, avec leur début et leur fin
  const words = [];
  let cur = null;
  a.characters.forEach((c, k) => {
    if (/\s/.test(c)) { cur = null; return; }
    if (!cur) { cur = { w: "", t: a.characterStartTimesSeconds[k] }; words.push(cur); }
    cur.w += c;
    cur.e = a.characterEndTimesSeconds[k];
  });
  const s0 = words[0].t;
  const len = words[words.length - 1].e - s0;
  return { file: base + ".mp3", s0, len, words: words.map((w) => ({ w: w.w, t: w.t - s0, e: w.e - s0 })) };
}

async function sfx(name) {
  const { text, duration } = SFX[name];
  const file = path.join(OUT, `sfx-${name}-${hash(text + duration)}.mp3`);
  if (!existsSync(file)) {
    const audio = await client.textToSoundEffects.convert({
      text,
      modelId: "eleven_text_to_sound_v3",
      durationSeconds: duration,
      promptInfluence: 0.6,
    });
    writeFileSync(file, await toBuffer(audio));
    console.log(`Bruitage « ${name} » généré`);
  }
  return file;
}

async function music(seconds) {
  const length = Math.ceil(seconds + 1);
  const file = path.join(OUT, `musique-${hash(MUSIC + length)}.mp3`);
  if (!existsSync(file)) {
    try {
      const audio = await client.music.compose({ prompt: MUSIC, musicLengthMs: length * 1000, modelId: "music_v2_5", forceInstrumental: true });
      writeFileSync(file, await toBuffer(audio));
      console.log("Musique générée");
    } catch (err) {
      if (err.statusCode !== 402 && err.statusCode !== 403) throw err;
      return beatLoop();
    }
  }
  return { file, loop: false };
}

// Forfait sans accès à la musique : boucle rythmique produite par le générateur de bruitages
async function beatLoop() {
  const text = "Energetic trap-house drum and 808 bass groove loop, crisp hi-hats, punchy kick, modern premium advertising beat, 122 BPM, instrumental";
  const file = path.join(OUT, `boucle-${hash(text)}.mp3`);
  if (!existsSync(file)) {
    const audio = await client.textToSoundEffects.convert({ text, modelId: "eleven_text_to_sound_v3", durationSeconds: 30, loop: true, promptInfluence: 0.7 });
    writeFileSync(file, await toBuffer(audio));
    console.log("Musique indisponible avec ce forfait : boucle rythmique générée à la place");
  }
  return { file, loop: true };
}

// ---------- Minutage ----------

function layout(V) {
  const ev = {};
  const voice = [];
  const cues = [];
  const words = {};
  const r = (x) => Math.round(x * 1000) / 1000;
  const say = (id, at) => {
    voice.push({ file: V[id].file, at: at - V[id].s0 });
    words[id] = V[id].words.map((w) => ({ w: w.w, t: r(at + w.t), e: r(at + w.e) }));
    return at + V[id].len;
  };
  const cue = (name, at, gain = 1) => cues.push({ name, at, gain });

  // 1. Accroche : le « avant »
  ev.tagAvant = 0.3; cue("impact", 0.25, 0.9); cue("glitch", 0.05, 0.6);
  const hookEnd = say("hook", 0.5);
  // 2. La raclette révèle le « après »
  ev.look = hookEnd + 0.35;
  const lookEnd = say("look", ev.look);
  ev.wipe = lookEnd + 0.15; cue("squeegee", ev.wipe, 1); cue("riser", ev.wipe - 1.2, 0.5);
  ev.apres = ev.wipe + 1.1; cue("impact", ev.apres - 0.05, 0.8); cue("shine", ev.apres + 0.1, 0.8);
  // 3. Façades : comparateur glissé
  ev.facade = ev.apres + 1.5; cue("whoosh", ev.facade - 0.15);
  const facEnd = say("facades", ev.facade + 0.35);
  // 4. Bureaux : révélation en cercle
  ev.bureaux = Math.max(ev.facade + 3.2, facEnd + 1.6); cue("whoosh", ev.bureaux - 0.1); cue("shine", ev.bureaux + 0.6, 0.6);
  const burEnd = say("bureaux", ev.bureaux + 0.3);
  // 5. Marque
  ev.brand = Math.max(ev.bureaux + 2.6, burEnd + 1.2); cue("whoosh", ev.brand - 0.05);
  ev.slam = ev.brand + 0.45; cue("impact", ev.slam);
  const brandEnd = say("brand", ev.brand + 0.6);
  // 6. Les secteurs, au rythme des mots
  ev.list = Math.max(ev.brand + 2.4, brandEnd + 0.5);
  const listEnd = say("list", ev.list + 0.2);
  words.list.forEach((w) => cue("pop", w.t - 0.02, 0.5));
  // 7. Disponibilité
  ev.dispo = listEnd + 0.45; cue("whoosh", ev.dispo - 0.1); cue("ticks", ev.dispo + 0.1, 0.7);
  const dispoEnd = say("dispo", ev.dispo + 0.25);
  // 8. Zone
  ev.zone = dispoEnd + 0.4; cue("whoosh", ev.zone - 0.1); cue("pop", ev.zone + 0.35, 0.8);
  const zoneEnd = say("zone", ev.zone + 0.3);
  // 9. Appel à l'action
  ev.cta = zoneEnd + 0.9; cue("whoosh", ev.cta - 0.1); cue("impact", ev.cta + 0.3, 0.9);
  const ctaEnd = say("cta", ev.cta + 0.6);
  ev.end = ctaEnd + 2.6;

  for (const k of Object.keys(ev)) ev[k] = r(ev[k]);
  return { ev, voice, cues, words };
}

// ---------- Mixage ----------

function mix({ voice, cues, ev }, sfxFiles, musicFile) {
  const inputs = [];
  const parts = [];
  let count = 0;
  const add = (file, loop = false) => { inputs.push(...(loop ? ["-stream_loop", "-1"] : []), "-i", file); return count++; };
  const delay = (s) => { const ms = Math.max(0, Math.round(s * 1000)); return `adelay=${ms}|${ms}`; };

  const vLabels = voice.map((v, i) => { const k = add(v.file); parts.push(`[${k}:a]${delay(v.at)}[v${i}]`); return `[v${i}]`; });
  parts.push(`${vLabels.join("")}amix=inputs=${vLabels.length}:normalize=0,asplit=2[voice][key]`);

  const sLabels = cues.map((c, i) => { const k = add(sfxFiles[c.name]); parts.push(`[${k}:a]volume=${c.gain * 0.55},${delay(c.at)}[s${i}]`); return `[s${i}]`; });
  parts.push(`${sLabels.join("")}amix=inputs=${sLabels.length}:normalize=0[fx]`);

  let bus = "[voice][fx]";
  let n = 2;
  if (musicFile) {
    const k = add(musicFile.file, musicFile.loop);
    parts.push(`[${k}:a]atrim=0:${ev.end},volume=0.5,afade=t=in:d=0.4,afade=t=out:st=${ev.end - 1.6}:d=1.5[mus]`);
    parts.push(`[mus][key]sidechaincompress=threshold=0.04:ratio=6:attack=15:release=350[duck]`);
    bus += "[duck]";
    n = 3;
  } else {
    parts.push(`[key]anullsink`);
  }
  parts.push(`${bus}amix=inputs=${n}:normalize=0,atrim=0:${ev.end},apad=whole_dur=${ev.end},alimiter=limit=0.9,loudnorm=I=-14:TP=-1:LRA=9[out]`);

  const out = path.join(OUT, "mix.wav");
  const res = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", parts.join(";"), "-map", "[out]", "-ar", "48000", "-ac", "2", out], { stdio: "inherit" });
  if (res.status !== 0) throw new Error("Échec du mixage");
}

// ---------- Programme ----------

mkdirSync(OUT, { recursive: true });
const ids = Object.keys(LINES);
const V = {};
for (const [i, id] of ids.entries()) V[id] = await voiceLine(id, i, ids);

const plan = layout(V);
const sfxFiles = {};
for (const name of new Set(plan.cues.map((c) => c.name))) sfxFiles[name] = await sfx(name);
const musicFile = await music(plan.ev.end);

writeFileSync(path.join(OUT, "timing.js"), `window.REEL = ${JSON.stringify({ ev: plan.ev, words: plan.words })};\n`);
mix(plan, sfxFiles, musicFile);
console.log(`Bande son prête : Reel de ${plan.ev.end.toFixed(1)} s${musicFile ? (musicFile.loop ? ", avec boucle rythmique" : ", avec musique") : ""}.`);
