const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const output = $("output");
const startBtn = $("start");
let engine = lsGet("stt_engine") || "azure";
let file = null;
let segments = [];
let worker = null;

/* ---------- الواجهة ---------- */
document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => setEngine(t.dataset.engine))
);

function setEngine(e) {
  engine = e;
  lsSet("stt_engine", e);
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.engine === e));
  $("azureSettings").hidden = e !== "azure";
  $("whisperSettings").hidden = e !== "whisper";
  if (e === "azure" && !lsGet("azKey")) $("azureSettings").open = true;
}

$("azKey").value = lsGet("azKey") || "";
$("azRegion").value = lsGet("azRegion") || "";
$("saveAz").addEventListener("click", () => {
  lsSet("azKey", $("azKey").value.trim());
  lsSet("azRegion", $("azRegion").value.trim().toLowerCase());
  $("azureSettings").open = false;
  setStatus("✅ تم حفظ الإعدادات");
});

$("lang").value = lsGet("stt_lang") || $("lang").value;
$("lang").addEventListener("change", () => lsSet("stt_lang", $("lang").value));

/* ---------- اختيار الملف ---------- */
const drop = $("drop");
$("file").addEventListener("change", (e) => pickFile(e.target.files[0]));
["dragover", "dragenter"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); })
);
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); })
);
drop.addEventListener("drop", (e) => pickFile(e.dataTransfer.files[0]));

function pickFile(f) {
  if (!f) return;
  file = f;
  $("dropText").textContent = `📄 ${f.name} (${(f.size / 1048576).toFixed(1)} MB)`;
  const preview = $("preview");
  preview.src = URL.createObjectURL(f);
  preview.hidden = false;
  startBtn.disabled = false;
  setStatus("جاهز — اضغط حوّل لنص");
}

/* ---------- استخراج الصوت من الفيديو (16kHz mono) ---------- */
async function extractAudio(f) {
  setStatus("🎧 جاري استخراج الصوت من الفيديو...");
  const buf = await f.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(buf);
  } catch {
    throw new Error("مش قادر أقرا الصوت من الملف ده. جرب MP4 أو MP3 أو WAV.");
  } finally {
    ctx.close();
  }
  // دمج القنوات لقناة واحدة
  const len = decoded.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += data[i] / decoded.numberOfChannels;
  }
  return mono;
}

function toWav(samples, rate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE");
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/* ---------- Azure Fast Transcription ---------- */
async function transcribeAzure(samples, locale) {
  const key = lsGet("azKey");
  const region = lsGet("azRegion");
  if (!key || !region) {
    $("azureSettings").open = true;
    throw new Error("ادخل الـ Key والـ Region الأول واضغط حفظ");
  }

  setStatus("☁️ جاري الرفع والتحويل على Azure...");
  showProgress(true, 50);

  const form = new FormData();
  form.append("audio", toWav(samples), "audio.wav");
  form.append("definition", JSON.stringify({ locales: [locale] }));

  let res;
  try {
    res = await fetch(
      `https://${region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`,
      { method: "POST", headers: { "Ocp-Apim-Subscription-Key": key }, body: form }
    );
  } catch {
    throw new Error("مشكلة في الاتصال أو الـ Region غلط");
  }
  if (!res.ok) {
    const msg = { 401: "المفتاح غلط أو الـ Region مش مطابق", 429: "تخطيت الحد المسموح، استنى شوية" }[res.status];
    throw new Error(msg || `خطأ ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  segments = (data.phrases || []).map((p) => ({
    start: p.offsetMilliseconds / 1000,
    end: (p.offsetMilliseconds + p.durationMilliseconds) / 1000,
    text: p.text,
  }));
  return (data.combinedPhrases || []).map((p) => p.text).join("\n") || segments.map((s) => s.text).join(" ");
}

/* ---------- Whisper (داخل المتصفح) ---------- */
function transcribeWhisper(samples, language) {
  return new Promise((resolve, reject) => {
    if (!worker) worker = new Worker("worker.js", { type: "module" });
    worker.onmessage = ({ data }) => {
      if (data.type === "status") setStatus(data.text);
      else if (data.type === "progress") showProgress(true, data.value);
      else if (data.type === "done") { segments = data.segments; resolve(data.text); }
      else if (data.type === "error") reject(new Error(data.text));
    };
    worker.onerror = (e) => reject(new Error(e.message || "خطأ في تحميل Whisper"));
    worker.postMessage({ audio: samples, model: $("model").value, language }, [samples.buffer]);
  });
}

/* ---------- تشغيل ---------- */
startBtn.addEventListener("click", async () => {
  if (!file) return;
  startBtn.disabled = true;
  output.value = "";
  segments = [];
  const [locale, whisperLang] = $("lang").value.split("|");
  const t0 = performance.now();
  try {
    const samples = await extractAudio(file);
    const text = engine === "azure"
      ? await transcribeAzure(samples, locale)
      : await transcribeWhisper(samples, whisperLang);
    output.value = text || "(مفيش كلام اتعرف عليه)";
    showProgress(true, 100);
    setStatus(`✅ خلص في ${((performance.now() - t0) / 1000).toFixed(0)} ثانية`);
  } catch (err) {
    setStatus("❌ " + err.message);
  } finally {
    startBtn.disabled = false;
    setTimeout(() => showProgress(false), 1500);
  }
});

/* ---------- نسخ وتحميل ---------- */
$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(output.value); setStatus("📋 تم النسخ"); }
  catch { output.select(); document.execCommand("copy"); }
});

$("dlTxt").addEventListener("click", () => download(output.value, "txt", "text/plain"));

$("dlSrt").addEventListener("click", () => {
  if (!segments.length) return setStatus("مفيش توقيتات — حوّل فيديو الأول");
  const fmt = (t) => {
    const ms = Math.round(t * 1000);
    const p = (n, l = 2) => String(n).padStart(l, "0");
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  const srt = segments.map((s, i) => `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`).join("\n");
  download(srt, "srt", "application/x-subrip");
});

function download(content, ext, type) {
  if (!content.trim()) return setStatus("مفيش نص للتحميل");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + content], { type: type + ";charset=utf-8" }));
  const base = file ? file.name.replace(/\.[^.]+$/, "") : "transcript";
  a.download = `${base}.${ext}`;
  a.click();
}

/* ---------- مساعدات ---------- */
function setStatus(t) { statusEl.textContent = t; }
function showProgress(show, value = 0) {
  $("progressWrap").hidden = !show;
  $("progressBar").style.width = value + "%";
}
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

setEngine(engine);
