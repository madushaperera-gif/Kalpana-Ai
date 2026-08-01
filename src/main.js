/**
 * Kalpanā AI — Main Application Entry Point
 * Multi-PDF Knowledge Pack Compiler & Live 3M Token Capacity Tracker
 */

import '/src/style.css';
import { KalpanaRifEngine } from './rif-engine.js';
import { QwenWebGpuRunner } from './model-runner.js';

// Initialize Engines
const rifEngine = new KalpanaRifEngine({ bandwidth: 2048 });
const modelRunner = new QwenWebGpuRunner();

// DOM Elements — Header Dashboard
const qwenRamVal = document.getElementById('qwenRamVal');
const rifRamVal = document.getElementById('rifRamVal');
const rifTokenCapacity = document.getElementById('rifTokenCapacity');
const rifTokenPercent = document.getElementById('rifTokenPercent');
const totalRamVal = document.getElementById('totalRamVal');
const tradKvVal = document.getElementById('tradKvVal');
const savingsBadge = document.getElementById('savingsBadge');

// DOM Elements — Chat
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// DOM Elements — Sidebar & Single Dropzone
const kpDropzone = document.getElementById('kpDropzone');
const kpFileInput = document.getElementById('kpFileInput');
const activeKpCard = document.getElementById('activeKpCard');
const kpTitle = document.getElementById('kpTitle');
const kpMeta = document.getElementById('kpMeta');
const gpuInfoText = document.getElementById('gpuInfoText');

// DOM Elements — Multi-PDF Compiler Modal
const openCompilerModalBtn = document.getElementById('openCompilerModalBtn');
const exportChatKpBtn = document.getElementById('exportChatKpBtn');
const compilerModalOverlay = document.getElementById('compilerModalOverlay');
const closeCompilerModalBtn = document.getElementById('closeCompilerModalBtn');
const multiPdfDropzone = document.getElementById('multiPdfDropzone');
const multiFileInput = document.getElementById('multiFileInput');
const selectedFilesList = document.getElementById('selectedFilesList');
const selectedFileCount = document.getElementById('selectedFileCount');

const compilerGaugePct = document.getElementById('compilerGaugePct');
const compilerGaugeFill = document.getElementById('compilerGaugeFill');
const compilerTokensUsed = document.getElementById('compilerTokensUsed');
const compilerTokensRemaining = document.getElementById('compilerTokensRemaining');

const kpOutputTitle = document.getElementById('kpOutputTitle');
const compileAndLoadBtn = document.getElementById('compileAndLoadBtn');

// State
let conversationHistory = [];
let pendingCompilerEntries = [];
let pendingTotalTokens = 0;

// Initialize Application
async function initApp() {
  updateRamDashboard();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (e) {}
  }

  // Check WebGPU & Load Model
  const gpuStatus = await modelRunner.checkWebGpuSupport();
  if (gpuStatus.supported) {
    gpuInfoText.innerHTML = `⚡ <strong>WebGPU Active:</strong> ${gpuStatus.adapterInfo.vendor || 'Local GPU'}`;
  } else {
    gpuInfoText.innerHTML = `⚠️ <strong>WASM Fallback:</strong> ${gpuStatus.reason}`;
  }

  try {
    await modelRunner.loadModel();
    updateRamDashboard();
  } catch (err) {
    console.error("Model load error:", err);
  }

  // Default Demo Knowledge Pack
  const sample = rifEngine.generateSampleKp();
  rifEngine.loadKnowledgePack(await sample.blob.arrayBuffer());
  updateRamDashboard();
}

/**
 * Updates Header RAM Dashboard & Live 3M Token Capacity
 */
function updateRamDashboard() {
  const stats = rifEngine.getLiveMemoryStats(modelRunner.isLoaded, 350.0);
  
  qwenRamVal.textContent = `${stats.qwenRamMb} MB`;
  rifRamVal.textContent = `${stats.rifRamMb} MB`;
  rifTokenCapacity.textContent = `${stats.formattedTokenCount} / 3,000,000 Tokens`;
  rifTokenPercent.textContent = `${stats.capacityPct}% Capacity`;
  
  totalRamVal.textContent = `${stats.totalAppRamMb} MB`;
  tradKvVal.textContent = `${stats.standardKvMb} MB`;
  savingsBadge.textContent = `⚡ ${stats.memorySavingsPct}% RAM Saved`;
}

/**
 * Multi-PDF Compiler Modal Open / Close Handlers
 */
openCompilerModalBtn.addEventListener('click', () => {
  compilerModalOverlay.classList.add('active');
});

closeCompilerModalBtn.addEventListener('click', () => {
  compilerModalOverlay.classList.remove('active');
});

compilerModalOverlay.addEventListener('click', (e) => {
  if (e.target === compilerModalOverlay) {
    compilerModalOverlay.classList.remove('active');
  }
});

/**
 * Multi-File Selection & Token Capacity Gauge Update
 */
multiPdfDropzone.addEventListener('click', () => multiFileInput.click());

multiFileInput.addEventListener('change', async (e) => {
  if (e.target.files.length > 0) {
    await handleMultiFileSelection(Array.from(e.target.files));
  }
});

async function handleMultiFileSelection(files) {
  multiPdfDropzone.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: var(--accent-cyan);"></i><div style="font-size: 12px; margin-top: 6px;">Parsing PDF / Document token counts...</div>`;
  
  const result = await rifEngine.processFilesForCompiler(files);
  pendingCompilerEntries = result.entries;
  pendingTotalTokens = result.totalEstimatedTokens;

  // Restore Dropzone text
  multiPdfDropzone.innerHTML = `
    <i class="fa-solid fa-folder-open" style="font-size: 32px; color: var(--accent-lime); margin-bottom: 8px;"></i>
    <div style="font-size: 13px; font-weight: 700;">Select Multiple PDF / Text Files</div>
    <div style="font-size: 11px; color: var(--text-muted);">Hold Ctrl/Cmd or Shift to select multiple files at once</div>
  `;

  // Render Selected Files List
  selectedFileCount.textContent = pendingCompilerEntries.length;
  selectedFilesList.innerHTML = pendingCompilerEntries.map(e => `
    <div class="selected-file-item">
      <span class="file-item-name"><i class="fa-regular fa-file-pdf" style="margin-right: 6px; color: var(--accent-rose);"></i> ${escapeHtml(e.name)}</span>
      <span class="file-item-tokens">~${e.estimatedTokens.toLocaleString()} Tokens</span>
    </div>
  `).join('');

  // Update Live 3M Token Capacity Gauge
  const pct = Math.min(Math.round((pendingTotalTokens / 3000000) * 1000) / 10, 100);
  compilerGaugePct.textContent = `${pendingTotalTokens.toLocaleString()} / 3,000,000 Tokens (${pct}%)`;
  compilerGaugeFill.style.width = `${pct}%`;
  
  compilerTokensUsed.textContent = `Tokens Used: ${pendingTotalTokens.toLocaleString()} Tokens`;
  compilerTokensRemaining.textContent = `Tokens Remaining: ${result.tokensRemaining.toLocaleString()} Tokens`;

  if (result.isExceeded) {
    compilerGaugeFill.classList.add('exceeded');
    compilerTokensRemaining.style.color = 'var(--accent-rose)';
    compilerTokensRemaining.textContent = `⚠️ EXCEEDED 3M LIMIT by ${(pendingTotalTokens - 3000000).toLocaleString()} Tokens`;
  } else {
    compilerGaugeFill.classList.remove('exceeded');
    compilerTokensRemaining.style.color = 'var(--accent-lime)';
  }
}

/**
 * Compile Multi-Doc Knowledge Pack & Load into Active RIF Memory
 */
compileAndLoadBtn.addEventListener('click', () => {
  if (pendingCompilerEntries.length === 0) {
    alert("Please select at least one PDF or document file to compile!");
    return;
  }

  const title = kpOutputTitle.value.trim() || "My_MultiDoc_Knowledge_Pack";
  const result = rifEngine.compileMultiDocKp(title, pendingCompilerEntries, pendingTotalTokens);
  
  // Download compiled .kp file
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  a.click();
  URL.revokeObjectURL(url);

  // Update Active KP Card
  kpTitle.textContent = result.pack.filename;
  kpMeta.textContent = `${result.pack.metadata.docCount} Docs · ${result.pack.metadata.tokenCount.toLocaleString()} Tokens · Bounded 6.3 MB`;

  appendMessage('assistant', `✅ Compiled **${result.pack.metadata.docCount} Documents** into **"${result.pack.filename}"** (6.3 MB Fixed State) and loaded into Kalpanā RIF memory! Total Context: **${result.pack.metadata.tokenCount.toLocaleString()} Tokens**.`);

  compilerModalOverlay.classList.remove('active');
  updateRamDashboard();
});

/**
 * Export Active Chat Session into a 6.3 MB .kp Knowledge Pack File
 */
exportChatKpBtn.addEventListener('click', () => {
  if (conversationHistory.length === 0) {
    alert("Chat session is empty! Send a few messages first to build conversation context.");
    return;
  }

  const result = rifEngine.exportChatSessionKp(conversationHistory);
  
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  a.click();
  URL.revokeObjectURL(url);

  appendMessage('assistant', `📦 Exported full chat session context (${result.tokenCount.toLocaleString()} Tokens) into **"${result.filename}"** (6.3 MB Fixed State Knowledge Pack). You can share or reload this .kp file anytime!`);
});

/**
 * Single File Dropzone Handler (.kp or single PDF)
 */
kpDropzone.addEventListener('click', () => kpFileInput.click());

kpFileInput.addEventListener('change', async (e) => {
  if (e.target.files.length > 0) {
    await processSingleFile(e.target.files[0]);
  }
});

async function processSingleFile(file) {
  try {
    const pack = await rifEngine.loadKnowledgePack(file);
    kpTitle.textContent = pack.filename;
    kpMeta.textContent = `${pack.metadata.tokenCount.toLocaleString()} Tokens · Bounded 6.3 MB Phase Index`;
    
    appendMessage('assistant', `✅ Loaded Knowledge Pack **"${pack.filename}"** into Kalpanā RIF memory. Context expanded to **${pack.metadata.tokenCount.toLocaleString()} Tokens** while memory stays bounded at **6.3 MB**!`);
    updateRamDashboard();
  } catch (err) {
    alert(`Failed to load file: ${err.message}`);
  }
}

/**
 * Chat Messaging Handler
 */
async function handleSend() {
  const text = userInput.value.trim();
  if (!text) return;

  userInput.value = '';
  sendBtn.disabled = true;

  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  // Update RIF Token Capacity dynamically as chat grows
  rifEngine.addTokens(Math.floor(text.length / 4) + 150);
  updateRamDashboard();

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

// Listeners
sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSend();
});

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

initApp();
