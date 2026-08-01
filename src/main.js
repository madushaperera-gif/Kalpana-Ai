/**
 * Kalpanā AI — Main Application Entry Point
 * Manages On-Device WebGPU Qwen 0.5B + Kalpanā RIF Memory
 */

import { KalpanaRifEngine } from './rif-engine.js';
import { QwenWebGpuRunner } from './model-runner.js';

// Initialize Engines
const rifEngine = new KalpanaRifEngine({ bandwidth: 2048 });
const modelRunner = new QwenWebGpuRunner();

// DOM Elements
const qwenRamVal = document.getElementById('qwenRamVal');
const rifRamVal = document.getElementById('rifRamVal');
const totalRamVal = document.getElementById('totalRamVal');
const tradKvVal = document.getElementById('tradKvVal');
const savingsBadge = document.getElementById('savingsBadge');

const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

const kpDropzone = document.getElementById('kpDropzone');
const kpFileInput = document.getElementById('kpFileInput');
const activeKpCard = document.getElementById('activeKpCard');
const kpTitle = document.getElementById('kpTitle');
const kpMeta = document.getElementById('kpMeta');
const generateSampleBtn = document.getElementById('generateSampleBtn');
const gpuInfoText = document.getElementById('gpuInfoText');

// Conversation History
let conversationHistory = [];

// Initialize App
async function initApp() {
  // Update Live RAM Usage Header
  updateRamDashboard();

  // Register Service Worker for PWA Offline Mode
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
      console.log('Kalpanā PWA Service Worker Registered');
    } catch (e) {
      console.log('PWA Service Worker Registration skipped:', e.message);
    }
  }

  // Check WebGPU Support & Load Model
  const gpuStatus = await modelRunner.checkWebGpuSupport();
  if (gpuStatus.supported) {
    gpuInfoText.innerHTML = `⚡ <strong>WebGPU Active:</strong> ${gpuStatus.adapterInfo.vendor || 'Local GPU'}`;
  } else {
    gpuInfoText.innerHTML = `⚠️ <strong>WASM Fallback:</strong> ${gpuStatus.reason}`;
  }

  // Auto Load Qwen 0.5B
  try {
    await modelRunner.loadModel();
    updateRamDashboard();
  } catch (err) {
    console.error("Model load error:", err);
  }

  // Setup Default Demo Knowledge Pack
  const sample = rifEngine.generateSampleKp();
  rifEngine.loadKnowledgePack(await sample.blob.arrayBuffer());
  updateRamDashboard();
}

/**
 * Updates the Header RAM Usage Dashboard (Separate Qwen vs RIF RAM)
 */
function updateRamDashboard() {
  const stats = rifEngine.getLiveMemoryStats(modelRunner.isLoaded, 350.0);
  
  qwenRamVal.textContent = `${stats.qwenRamMb} MB`;
  rifRamVal.textContent = `${stats.rifRamMb} MB`;
  totalRamVal.textContent = `${stats.totalAppRamMb} MB`;
  tradKvVal.textContent = `${stats.standardKvMb} MB`;
  
  savingsBadge.textContent = `⚡ ${stats.memorySavingsPct}% RAM Saved`;
}

/**
 * Send User Message & Stream Qwen 0.5B + RIF Response
 */
async function handleSend() {
  const text = userInput.value.trim();
  if (!text) return;

  userInput.value = '';
  sendBtn.disabled = true;

  // Add User Message UI
  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  // Update RIF Token Counter
  rifEngine.addTokens(text.length / 4 + 100);
  updateRamDashboard();

  // Assistant Bubble Container
  const assistantBubble = appendMessage('assistant', '<i class="fa-solid fa-spinner fa-spin"></i> Processing with WebGPU + RIF...');

  try {
    await modelRunner.generateResponse(
      conversationHistory,
      (chunk) => {
        assistantBubble.innerHTML = formatMarkdown(chunk.fullText);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        updateRamDashboard();
      },
      rifEngine
    );

    conversationHistory.push({ role: 'assistant', content: assistantBubble.innerText });
  } catch (err) {
    assistantBubble.innerHTML = `<span style="color: var(--accent-rose);">Error: ${err.message}</span>`;
  } finally {
    sendBtn.disabled = false;
  }
}

/**
 * Appends message to chat UI
 */
function appendMessage(role, content) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  
  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === 'assistant' ? 'K' : 'U';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'user' ? escapeHtml(content) : content;

  if (role === 'user') {
    row.appendChild(bubble);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(bubble);
  }

  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

/**
 * Knowledge Pack (.kp) File Drag and Drop Handlers
 */
kpDropzone.addEventListener('click', () => kpFileInput.click());

kpDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  kpDropzone.classList.add('dragover');
});

kpDropzone.addEventListener('dragleave', () => {
  kpDropzone.classList.remove('dragover');
});

kpDropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  kpDropzone.classList.remove('dragover');

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    await processKpFile(files[0]);
  }
});

kpFileInput.addEventListener('change', async (e) => {
  if (e.target.files.length > 0) {
    await processKpFile(e.target.files[0]);
  }
});

async function processKpFile(file) {
  try {
    const pack = await rifEngine.loadKnowledgePack(file);
    kpTitle.textContent = pack.filename;
    kpMeta.textContent = `${(pack.metadata.tokenCount / 1000000).toFixed(1)}M Tokens · Bounded 6.3 MB RIF State`;
    
    appendMessage('assistant', `✅ Successfully loaded Knowledge Pack **"${pack.filename}"** into Kalpanā RIF memory. Context expanded to **${(pack.metadata.tokenCount / 1000000).toFixed(1)} Million Tokens** while device memory stays bounded at **6.3 MB**!`);
    updateRamDashboard();
  } catch (err) {
    alert(`Failed to load .kp file: ${err.message}`);
  }
}

// Generate Sample .kp Button
generateSampleBtn.addEventListener('click', () => {
  const sample = rifEngine.generateSampleKp();
  const url = URL.createObjectURL(sample.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sample.filename;
  a.click();
  URL.revokeObjectURL(url);
});

// Event Listeners
sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSend();
});

// Helpers
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono);">$1</code>')
    .replace(/\n/g, '<br>');
}

// Run App
initApp();
