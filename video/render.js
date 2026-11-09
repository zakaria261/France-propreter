/**
 * Rendu des vidéos : capture image par image d'une composition HTML
 * puis encodage H.264 avec ffmpeg.
 *
 *   npm install                     (dans ce dossier)
 *   node render.js                  film de présentation, deux formats
 *   node render.js stills           quelques images fixes du film pour vérifier la mise en page
 *   node render.js mux              ajoute la voix off (audio/voix-off.wav) sans refaire les images
 *   node render.js reel             Reel Instagram (reel/reel.html + reel/audio/mix.wav)
 *   node render.js reel-stills      quelques images fixes du Reel
 */
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const puppeteer = require("puppeteer");
const ffmpeg = require("ffmpeg-static");
const { pathToFileURL } = require("url");

const FPS = 30;
const HERE = __dirname;
const SITE = path.join(HERE, "..");
const EXPORTS = path.join(HERE, "exports");
const FORMATS = {
  "16x9": { width: 1920, height: 1080, web: { scale: "1920:1080", crf: 26 } },
  "9x16": { width: 1080, height: 1920, web: { scale: "720:1280", crf: 26 } },
};
const REEL = { width: 1080, height: 1920, file: "reel/reel.html" };

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: ["pipe", "inherit", "inherit"] });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg " + code))));
    return p;
  });
}

async function openPage(browser, fmt, file = "composition.html") {
  const page = await browser.newPage();
  await page.setViewport({ width: fmt.width, height: fmt.height, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(HERE, file)).href, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.ready);
  return page;
}

async function snapshots(page, times, prefix) {
  for (const t of times) {
    await page.evaluate((t) => window.seek(t), t);
    await page.screenshot({ path: path.join(EXPORTS, `${prefix}-${t}.jpg`), type: "jpeg", quality: 85 });
  }
}

async function stills(browser) {
  const times = [1.5, 3.8, 7.4, 9.9, 11.8, 16.9, 23.5, 28.8, 34.5];
  for (const [name, fmt] of Object.entries(FORMATS)) {
    const page = await openPage(browser, fmt);
    await snapshots(page, times, `still-${name}`);
    await page.close();
  }
}

// Capture chaque image de la composition et l'envoie à ffmpeg
async function encodeFrames(page, out, label, crf = 17) {
  const duration = await page.evaluate(() => window.DURATION);
  const frames = Math.ceil(duration * FPS);
  const enc = spawn(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => enc.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg " + c)))));

  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once("drain", r));
    if (f % 150 === 0) console.log(`${label} : ${f}/${frames}`);
  }
  enc.stdin.end();
  await done;
}

async function render(browser, name, fmt) {
  const page = await openPage(browser, fmt);
  await encodeFrames(page, silentMaster(name), name);
  await page.close();
  await finalize(name, fmt);
}

// Minutage écrit par voiceover.mjs : sert à choisir l'image d'attente (scène de la marque)
function posterTime() {
  const file = path.join(HERE, "audio", "timing.js");
  if (!fs.existsSync(file)) return 7.6;
  const T = JSON.parse(fs.readFileSync(file, "utf8").replace(/^window\.TIMING = /, "").replace(/;\s*$/, ""));
  return T.s2 + 2.7;
}

const silentMaster = (name) => path.join(EXPORTS, `france-proprete-hygiene-${name}-muet.mp4`);

// Ajoute la voix off si elle existe, puis produit les versions réseaux sociaux et site
async function finalize(name, fmt) {
  const master = silentMaster(name);
  const voice = path.join(HERE, "audio", "voix-off.wav");
  const hasVoice = fs.existsSync(voice);
  const audioIn = hasVoice ? ["-i", voice] : [];
  const audioOut = (bitrate) => (hasVoice ? ["-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", bitrate, "-shortest"] : ["-an"]);

  await run(["-i", master, ...audioIn, "-c:v", "copy", ...audioOut("192k"), "-movflags", "+faststart",
    path.join(EXPORTS, `france-proprete-hygiene-${name}.mp4`)]);

  const web = path.join(SITE, "assets", "video", `presentation-${name}.mp4`);
  await run(["-i", master, ...audioIn, "-vf", `scale=${fmt.web.scale}:flags=lanczos`, "-c:v", "libx264", "-preset", "slow",
    "-crf", String(fmt.web.crf), "-pix_fmt", "yuv420p", ...audioOut("96k"), "-movflags", "+faststart", web]);
  await run(["-ss", String(posterTime()), "-i", master, "-frames:v", "1", "-vf", `scale=${fmt.web.scale}`, "-q:v", "4",
    path.join(SITE, "assets", "video", `poster-${name}.jpg`)]);
  console.log("ok", name, hasVoice ? "(avec voix off)" : "(sans voix off)");
}

// Reel Instagram : 1080 × 1920, 30 i/s, H.264 + AAC 48 kHz (format attendu par Instagram)
async function reel(browser) {
  const mix = path.join(HERE, "reel", "audio", "mix.wav");
  if (!fs.existsSync(mix)) throw new Error("Bande son absente : lancer d'abord « npm run reel:audio ».");
  const page = await openPage(browser, REEL, REEL.file);
  const silent = path.join(EXPORTS, "reel-instagram-muet.mp4");
  await encodeFrames(page, silent, "reel", 16);
  await page.close();
  await run(["-i", silent, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
    "-shortest", "-movflags", "+faststart", path.join(EXPORTS, "reel-instagram.mp4")]);
  console.log("ok reel");
}

(async () => {
  fs.mkdirSync(EXPORTS, { recursive: true });
  fs.mkdirSync(path.join(SITE, "assets", "video"), { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ["--force-color-profile=srgb"] });
  try {
    const mode = process.argv[2];
    if (mode === "stills") await stills(browser);
    else if (mode === "mux") for (const [name, fmt] of Object.entries(FORMATS)) await finalize(name, fmt);
    else if (mode === "reel") await reel(browser);
    else if (mode === "reel-stills") {
      const page = await openPage(browser, REEL, REEL.file);
      await snapshots(page, process.argv.slice(3).map(Number), "reel");
      await page.close();
    } else for (const [name, fmt] of Object.entries(FORMATS)) await render(browser, name, fmt);
  } finally {
    await browser.close();
  }
})();
