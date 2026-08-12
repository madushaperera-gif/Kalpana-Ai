/**
 * Kalpanā AI — Local WebGPU Qwen 0.5B Model Runner
 * Real on-device inference via @mlc-ai/web-llm
 * Uses RIF Resonant Context Retrieval (constant 2048 token bandwidth)
 *
 * Timeout behaviour:
 *  - Model loading: 120s timeout (downloads ~350MB, compiles shaders)
 *  - Inference: 30s timeout per response
 *  - On timeout: RIF retrieval result is used as the direct response
 */

import { CreateMLCEngine } from "@mlc-ai/web-llm";

const MODEL_LOAD_TIMEOUT_MS = 180000; // 3 minutes for model download + compile
const INFERENCE_TIMEOUT_MS = 30000;    // 30 seconds max per response

export class QwenWebGpuRunner {
  constructor(progressCallback = null) {
    this.progressCallback = progressCallback;
    this.engine = null;
    this.isLoaded = false;
    this.modelId = "SmolLM2-135M-Instruct-q0f16-MLC";
    this.modelRamMb = 90.0;
    this.webGpuSupported = false;
  }

  /**
   * Check WebGPU hardware availability on device
   */
  async checkWebGpuSupport() {
    if (typeof navigator === "undefined" || !navigator.gpu) {
      return { supported: false, reason: "WebGPU not available in this browser", adapterInfo: { vendor: "None" } };
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        this.webGpuSupported = true;
        return { supported: true, adapterInfo: adapter.info || { vendor: "GPU" } };
      }
    } catch (e) {
      console.warn("WebGPU adapter request failed:", e);
    }
    return { supported: false, reason: "No WebGPU adapter found", adapterInfo: { vendor: "None" } };
  }

  /**
   * Load SmolLM2 135M into WebGPU Unified Memory via web-llm
   * Has a timeout — if loading takes too long, fails gracefully
   */
  async loadModel() {
    try {
      const initProgressCallback = (progress) => {
        if (this.progressCallback) {
          this.progressCallback({
            progress: progress.progress || 0,
            text: progress.text || "Loading model...",
            timeElapsed: 0,
          });
        }
      };

      // Race model loading against a timeout
      const loadPromise = CreateMLCEngine(this.modelId, {
        initProgressCallback,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Model loading timed out after 3 minutes. Your device/browser may have restricted WebGPU memory.")), MODEL_LOAD_TIMEOUT_MS)
      );

      this.engine = await Promise.race([loadPromise, timeoutPromise]);
      this.isLoaded = true;

      if (this.progressCallback) {
        this.progressCallback({
          progress: 1.0,
          text: "SmolLM2 135M + Kalpanā RIF Ready on Local Hardware!",
          timeElapsed: 0,
        });
      }

      return { success: true, mode: "webgpu" };
    } catch (err) {
      console.error("Failed to load Qwen model via web-llm:", err);
      this.isLoaded = false;

      if (this.progressCallback) {
        this.progressCallback({
          progress: 0,
          text: `Model load failed: ${err.message}`,
          timeElapsed: 0,
        });
      }

      return { success: false, mode: "none", error: err.message };
    }
  }

  /**
   * Stream completion response using real Qwen 0.5B inference + RIF Context
   * 30-second timeout — if inference hangs, returns RIF context directly
   */
  async generateResponse(messages, onChunk, rifEngine = null) {
    // If model isn't loaded, use RIF-only mode
    if (!this.engine || !this.isLoaded) {
      return this._rifOnlyResponse(messages, onChunk, rifEngine);
    }

    // Reset engine chat state to prevent context overflow on subsequent queries
    try {
      await this.engine.resetChat();
    } catch (e) {
      console.warn("Chat reset warning:", e);
    }

    const startTime = performance.now();
    let generatedTokens = 0;
    let fullText = "";

    // Build the message list — system + ONLY the last user message
    // (Small models have tiny context windows — don't accumulate history)
    const chatMessages = [];

    // System prompt with optional RIF context
    let systemPrompt = "You are Kalpanā AI, a helpful assistant. Answer questions accurately and concisely based on the provided context.";

    // If a Knowledge Pack is loaded, inject its context via RIF retrieval
    if (rifEngine && rifEngine.activePack) {
      const packName = rifEngine.activePack.filename || "Knowledge Pack";
      const docContext = rifEngine.activePack.extractedText || "";

      let resonantContext = "";
      if (docContext && typeof rifEngine.retrieveResonantContext === "function") {
        const lastUserMsg = messages.length > 0 ? messages[messages.length - 1].content : "";
        resonantContext = rifEngine.retrieveResonantContext(lastUserMsg, docContext);
      } else if (docContext) {
        resonantContext = docContext.substring(0, 1024);
      }

      if (resonantContext && resonantContext.length > 10) {
        // Truncate context to fit in small model's window
        const truncated = resonantContext.substring(0, 800);
        systemPrompt += `\n\nAnswer based on this document context:\n${truncated}`;
      }
    }

    chatMessages.push({ role: "system", content: systemPrompt });

    // Only send the LAST user message — prevents context overflow
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      chatMessages.push({ role: lastMsg.role, content: lastMsg.content });
    }

    try {
      // Race inference against a 30-second timeout
      const result = await this._runInferenceWithTimeout(chatMessages, onChunk, startTime, rifEngine);
      return result;
    } catch (err) {
      console.error("Inference error or timeout:", err);

      // On timeout or error, fall back to RIF-only response
      if (rifEngine && rifEngine.activePack) {
        return this._rifOnlyResponse(messages, onChunk, rifEngine);
      }

      const errorMsg = `Inference error: ${err.message}`;
      if (typeof onChunk === "function") {
        onChunk({ delta: errorMsg, fullText: errorMsg, tokens: 0, tokPerSec: "0" });
      }
      return errorMsg;
    }
  }

  /**
   * Run inference with a timeout guard using Promise.race
   */
  async _runInferenceWithTimeout(chatMessages, onChunk, startTime, rifEngine) {
    // Create a clean timeout promise
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Inference timed out after ${INFERENCE_TIMEOUT_MS / 1000}s`));
      }, INFERENCE_TIMEOUT_MS);
    });

    // Create the inference promise
    const inferencePromise = this._doInference(chatMessages, onChunk, startTime, rifEngine);

    try {
      // Race them — whichever finishes first wins
      const result = await Promise.race([inferencePromise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Actual inference execution (separated for clean Promise.race)
   */
  async _doInference(chatMessages, onChunk, startTime, rifEngine) {
    let generatedTokens = 0;
    let fullText = "";

    const asyncChunkGenerator = await this.engine.chat.completions.create({
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 256,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of asyncChunkGenerator) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (delta) {
        fullText += delta;
        generatedTokens += 1;
        const elapsedSec = Math.max((performance.now() - startTime) / 1000, 0.05);
        const tokPerSec = (generatedTokens / elapsedSec).toFixed(1);

        if (typeof onChunk === "function") {
          onChunk({
            delta: delta,
            fullText: fullText,
            tokens: generatedTokens,
            tokPerSec: tokPerSec,
          });
        }
      }

      if (chunk.usage && rifEngine) {
        rifEngine.addTokens(chunk.usage.total_tokens || 0);
      }
    }

    return fullText;
  }

  /**
   * RIF-only response — used when model is unavailable or times out
   * Returns retrieved context directly as the response
   */
  _rifOnlyResponse(messages, onChunk, rifEngine) {
    let response = "";

    if (rifEngine && rifEngine.activePack) {
      const lastUserMsg = messages.length > 0 ? messages[messages.length - 1].content : "";
      const docContext = rifEngine.activePack.extractedText || "";
      const rifContext = rifEngine.retrieveResonantContext(lastUserMsg, docContext);

      if (rifContext && rifContext.length > 10) {
        response = `📄 **RIF Retrieval Result** (Model not available — showing direct retrieval from Knowledge Pack "${rifEngine.activePack.filename}"):\n\n${rifContext}`;
      } else {
        response = "The Knowledge Pack is loaded but no relevant context was found for your query. Try rephrasing your question.";
      }
    } else {
      response = "⏳ The Qwen 0.5B model is still loading (or failed to load). Once ready, I'll process your questions with full on-device inference.\n\nIn the meantime, you can load a Knowledge Pack (.kp) — I'll retrieve context from it immediately using the RIF engine.";
    }

    if (typeof onChunk === "function") {
      onChunk({ delta: response, fullText: response, tokens: 0, tokPerSec: "0" });
    }
    return response;
  }
}
