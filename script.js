const $ = (id) => document.getElementById(id);
const synth = window.speechSynthesis;

const textEl = $("text");
const voiceEl = $("voice");
const statusEl = $("status");
const player = $("player");
const downloadBtn = $("download");

let engine = lsGet("engine") || "azure";
let browserVoices = [];
let lastAudioUrl = null;

// أصوات Azure العربية (Neural)
const AZURE_VOICES = [
  { id: "ar-EG-SalmaNeural",   label: "سلمى — مصري (أنثى)" },
  { id: "ar-EG-ShakirNeural",  label: "شاكر — مصري (ذكر)" },
  { id: "ar-SA-ZariyahNeural", label: "زارية — سعودي (أنثى)" },
  { id: "ar-SA-HamedNeural",   label: "حامد — سعودي (ذكر)" },
  { id: "ar-AE-FatimaNeural",  label: "فاطمة — إماراتي (أنثى)" },
  { id: "ar-AE-HamdanNeural",  label: "حمدان — إماراتي (ذكر)" },
  { id: "ar-JO-SanaNeural",    label: "سناء — أردني (أنثى)" },
  { id: "ar-JO-TaimNeural",    label: "تيم — أردني (ذكر)" },
  { id: "ar-MA-MounaNeural",   label: "منى — مغربي (أنثى)" },
  { id: "ar-MA-JamalNeural",   label: "جمال — مغربي (ذكر)" },
  { id: "en-US-JennyNeural",   label: "Jenny — English US (F)" },
  { id: "en-US-GuyNeural",     label: "Guy — English US (M)" },
  { id: "en-GB-SoniaNeural",   label: "Sonia — English UK (F)" },
  { id: "fr-FR-DeniseNeural",  label: "Denise — Français (F)" },
];

/* ---------- الواجهة ---------- */
document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => setEngine(t.dataset.engine))
);

function setEngine(e) {
  engine = e;
  lsSet("engine", e);
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.engine === e)
  );
  $("azureSettings").hidden = e !== "azure";
  if (e === "azure" && !lsGet("azKey")) $("azureSettings").open = true;
  stopAll();
  fillVoices();
}

function fillVoices() {
  voiceEl.innerHTML = "";
  const list = engine === "azure"
    ? AZURE_VOICES.map((v) => ({ value: v.id, text: v.label }))
    : browserVoices.map((v, i) => ({ value: i, text: `${v.name} (${v.lang})` }));
  list.forEach((o) => voiceEl.add(new Option(o.text, o.value)));

  const saved = lsGet("voice_" + engine);
  if (saved !== null && [...voiceEl.options].some((o) => o.value === saved)) voiceEl.value = saved;
}

voiceEl.addEventListener("change", () => lsSet("voice_" + engine, voiceEl.value));

["rate", "pitch", "volume"].forEach((id) =>
  $(id).addEventListener("input", (e) => ($(id + "Val").textContent = e.target.value))
);

const updateCount = () => ($("count").textContent = textEl.value.length);
textEl.addEventListener("input", updateCount);
updateCount();

$("azKey").value = lsGet("azKey") || "";
$("azRegion").value = lsGet("azRegion") || "";
$("saveAz").addEventListener("click", () => {
  lsSet("azKey", $("azKey").value.trim());
  lsSet("azRegion", $("azRegion").value.trim().toLowerCase());
  statusEl.textContent = "✅ تم حفظ الإعدادات";
  $("azureSettings").open = false;
});

/* ---------- أصوات المتصفح ---------- */
function loadBrowserVoices() {
  browserVoices = synth.getVoices().sort((a, b) => {
    const r = (v) => (v.lang.startsWith("ar") ? 0 : 1) + (/natural|online/i.test(v.name) ? 0 : 0.5);
    return r(a) - r(b) || a.name.localeCompare(b.name);
  });
  if (engine === "browser") fillVoices();
}
if (synth) {
  loadBrowserVoices();
  synth.onvoiceschanged = loadBrowserVoices;
}

function splitText(text, max = 200) {
  const parts = text.match(/[^.!?؟،\n]+[.!?؟،\n]*/g) || [text];
  const chunks = [];
  let cur = "";
  parts.forEach((p) => {
    if ((cur + p).length > max) { if (cur) chunks.push(cur); cur = p; }
    else cur += p;
  });
  if (cur.trim()) chunks.push(cur);
  return chunks;
}

function speakBrowser(text) {
  synth.cancel();
  const voice = browserVoices[voiceEl.value];
  const chunks = splitText(text);
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "ar-EG";
    u.rate = +$("rate").value;
    u.pitch = +$("pitch").value;
    u.volume = +$("volume").value;
    if (i === 0) u.onstart = () => (statusEl.textContent = "🔊 جاري التشغيل...");
    if (i === chunks.length - 1) u.onend = () => (statusEl.textContent = "✅ انتهى");
    synth.speak(u);
  });
}

/* ---------- Azure Neural TTS ---------- */
const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

const pct = (v) => { const p = Math.round((v - 1) * 100); return (p >= 0 ? "+" : "") + p + "%"; };

async function speakAzure(text) {
  const key = lsGet("azKey");
  const region = lsGet("azRegion");
  if (!key || !region) {
    $("azureSettings").open = true;
    return (statusEl.textContent = "⚠️ ادخل الـ Key والـ Region الأول واضغط حفظ");
  }

  const voice = voiceEl.value;
  const lang = voice.split("-").slice(0, 2).join("-");
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
    `<voice name="${voice}"><prosody rate="${pct(+$("rate").value)}" pitch="${pct(+$("pitch").value)}">` +
    `${escapeXml(text)}</prosody></voice></speak>`;

  statusEl.textContent = "⏳ جاري التحويل...";
  $("speak").disabled = true;
  try {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
      },
      body: ssml,
    });
    if (!res.ok) {
      const msg = { 401: "المفتاح غلط أو الـ Region مش مطابق", 429: "تخطيت الحد المسموح، استنى شوية" }[res.status];
      throw new Error(msg || `خطأ ${res.status}`);
    }
    const blob = await res.blob();
    if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl);
    lastAudioUrl = URL.createObjectURL(blob);

    player.src = lastAudioUrl;
    player.volume = +$("volume").value;
    player.hidden = false;
    downloadBtn.hidden = false;
    await player.play();
    statusEl.textContent = "🔊 جاري التشغيل...";
  } catch (err) {
    statusEl.textContent = "❌ " + (err.message === "Failed to fetch" ? "مشكلة في الاتصال أو الـ Region غلط" : err.message);
  } finally {
    $("speak").disabled = false;
  }
}

player.addEventListener("ended", () => (statusEl.textContent = "✅ انتهى"));

downloadBtn.addEventListener("click", () => {
  if (!lastAudioUrl) return;
  const a = document.createElement("a");
  a.href = lastAudioUrl;
  a.download = `tts-${Date.now()}.mp3`;
  a.click();
});

/* ---------- الأزرار ---------- */
$("speak").addEventListener("click", () => {
  const text = textEl.value.trim();
  if (!text) return (statusEl.textContent = "اكتب نصًا أولاً");
  engine === "azure" ? speakAzure(text) : speakBrowser(text);
});

$("pause").addEventListener("click", () => {
  if (engine === "azure") player.pause(); else synth.pause();
  statusEl.textContent = "⏸ متوقف مؤقتًا";
});
$("resume").addEventListener("click", () => {
  if (engine === "azure") player.play(); else synth.resume();
  statusEl.textContent = "🔊 جاري التشغيل...";
});
$("stop").addEventListener("click", () => { stopAll(); statusEl.textContent = "⏹ تم الإيقاف"; });

function stopAll() {
  if (synth) synth.cancel();
  player.pause();
  player.currentTime = 0;
}

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

setEngine(engine);
