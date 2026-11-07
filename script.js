const synth = window.speechSynthesis;
const $ = (id) => document.getElementById(id);

const textEl = $("text");
const voiceEl = $("voice");
const statusEl = $("status");
let voices = [];

if (!("speechSynthesis" in window)) {
  statusEl.textContent = "المتصفح لا يدعم تحويل النص إلى صوت. استخدم Chrome أو Edge.";
}

// تحميل الأصوات المتاحة (العربية أولاً)
function loadVoices() {
  voices = synth.getVoices().sort((a, b) => {
    const aAr = a.lang.startsWith("ar") ? 0 : 1;
    const bAr = b.lang.startsWith("ar") ? 0 : 1;
    return aAr - bAr || a.name.localeCompare(b.name);
  });

  voiceEl.innerHTML = "";
  voices.forEach((v, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${v.name} (${v.lang})${v.default ? " — افتراضي" : ""}`;
    voiceEl.appendChild(opt);
  });

  const saved = localStorageGet("voiceName");
  const idx = voices.findIndex((v) => v.name === saved);
  if (idx >= 0) voiceEl.value = idx;
}

loadVoices();
if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;

// عرض قيم المنزلقات
["rate", "pitch", "volume"].forEach((id) => {
  $(id).addEventListener("input", (e) => ($(id + "Val").textContent = e.target.value));
});

// عداد الحروف
const updateCount = () => ($("count").textContent = textEl.value.length);
textEl.addEventListener("input", updateCount);
updateCount();

voiceEl.addEventListener("change", () => {
  const v = voices[voiceEl.value];
  if (v) localStorageSet("voiceName", v.name);
});

// تقسيم النص الطويل لجمل (Chrome يقطع النصوص الطويلة)
function splitText(text, max = 200) {
  const parts = text.match(/[^.!?؟،\n]+[.!?؟،\n]*/g) || [text];
  const chunks = [];
  let current = "";
  parts.forEach((p) => {
    if ((current + p).length > max) {
      if (current) chunks.push(current);
      current = p;
    } else current += p;
  });
  if (current.trim()) chunks.push(current);
  return chunks;
}

$("speak").addEventListener("click", () => {
  const text = textEl.value.trim();
  if (!text) return (statusEl.textContent = "اكتب نصًا أولاً");

  synth.cancel();
  const chunks = splitText(text);
  const voice = voices[voiceEl.value];

  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = "ar-EG"; }
    u.rate = parseFloat($("rate").value);
    u.pitch = parseFloat($("pitch").value);
    u.volume = parseFloat($("volume").value);
    if (i === 0) u.onstart = () => (statusEl.textContent = "🔊 جاري التشغيل...");
    if (i === chunks.length - 1) u.onend = () => (statusEl.textContent = "✅ انتهى");
    u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") statusEl.textContent = "خطأ: " + e.error; };
    synth.speak(u);
  });
});

$("pause").addEventListener("click", () => {
  if (synth.speaking) { synth.pause(); statusEl.textContent = "⏸ متوقف مؤقتًا"; }
});
$("resume").addEventListener("click", () => {
  if (synth.paused) { synth.resume(); statusEl.textContent = "🔊 جاري التشغيل..."; }
});
$("stop").addEventListener("click", () => {
  synth.cancel(); statusEl.textContent = "⏹ تم الإيقاف";
});

// حماية localStorage من الأخطاء
function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
