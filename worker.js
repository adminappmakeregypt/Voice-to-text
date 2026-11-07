// Whisper يشتغل داخل المتصفح (Web Worker) عشان الصفحة متهنجش
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3";

let transcriber = null;
let loadedModel = null;

self.onmessage = async ({ data }) => {
  const { audio, model, language } = data;
  try {
    if (!transcriber || loadedModel !== model) {
      self.postMessage({ type: "status", text: "⏳ جاري تحميل الموديل (أول مرة بس)..." });
      transcriber = await pipeline("automatic-speech-recognition", model, {
        progress_callback: (p) => {
          if (p.status === "progress" && p.total)
            self.postMessage({ type: "progress", value: (p.loaded / p.total) * 100, file: p.file });
        },
      });
      loadedModel = model;
    }

    self.postMessage({ type: "status", text: "🧠 جاري التحويل لنص... (ممكن ياخد وقت حسب طول الفيديو)" });
    self.postMessage({ type: "progress", value: 100 });

    const result = await transcriber(audio, {
      language,
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    });

    const segments = (result.chunks || []).map((c) => ({
      start: c.timestamp[0] ?? 0,
      end: c.timestamp[1] ?? (c.timestamp[0] ?? 0) + 3,
      text: c.text.trim(),
    }));

    self.postMessage({ type: "done", text: result.text.trim(), segments });
  } catch (err) {
    self.postMessage({ type: "error", text: err.message || String(err) });
  }
};
