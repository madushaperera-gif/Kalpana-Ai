# Kalpanā AI — On-Device WebGPU LLM + Bounded RIF Memory (PWA)

> **Local WebGPU Inference for Qwen 0.5B with Bounded 6.3 MB Kalpanā RIF Context Memory.**
> Runs 100% locally inside mobile browsers (iOS Safari, Android Chrome, Desktop) — zero cloud dependence, offline-ready PWA.

---

## ⚡ Key Highlights

- **Separate Live RAM Usage Tracking:**
  - **Qwen 0.5B Model Weights:** `350.0 MB` (INT4 Quantized)
  - **Kalpanā RIF Context Memory:** `6.3 MB` (O(1) Bounded State)
  - **Total Device Footprint:** `356.3 MB`
  - **Standard KV Equivalent at 3M Tokens:** `1,450.0+ MB` (99.6% RAM Saved!)
- **WebGPU On-Device Execution:** Powered by WebGPU shaders / `@mlc-ai/web-llm` with WebAssembly fallback.
- **Portable Knowledge Packs (`.kp`):** Drag-and-drop 3-Million-token document indices compressed into portable **6.3 MB** files.
- **PWA Ready:** Install on iOS/Android home screens for 100% offline Airplane Mode execution.

---

## 🚀 Running Locally

```bash
# Clone the repository
git clone https://github.com/maduperera/Kalpana-Ai.git
cd Kalpana-Ai

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` on your desktop or mobile phone!

---

## 📄 License
MIT License — Kalpanā Series by Vijñāna AI.
