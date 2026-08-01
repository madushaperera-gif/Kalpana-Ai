/**
 * Kalpanā AI — Main Application Entry Point
 * Multi-PDF Knowledge Pack Compiler & Live 3M Token Capacity Tracker
 * Features: Speech-to-Text Input, Listen Aloud Voice Output, Document Attachments
 */

import './style.css';
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

// DOM Elements — Chat & Inputs
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatForm = document.getElementById('chatForm');
const newChatBtn = document.getElementById('newChatBtn');

// DOM Elements — Sidebar & Single Dropzone
const kpDropzone = document.getElementById('kpDropzone');
const kpFileInput = document.getElementById('kpFileInput');
const activeKpCard = document.getElementById('activeKpCard');
const kpTitle = document.getElementById('kpTitle');
const kpMeta = document.getElementById('kpMeta');
const unloadKpBtn = document.getElementById('unloadKpBtn');
const gpuInfoText = document.getElementById('gpuInfoText');

// DOM Elements — Speech & Attachments
const speakerToggleBtn = document.getElementById('speakerToggleBtn');
const micBtn = document.getElementById('micBtn');
const attachBtn = document.getElementById('attachBtn');
const promptAttachmentInput = document.getElementById('promptAttachmentInput');

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

// DOM Elements — New Chat Save Modal
const newChatModalOverlay = document.getElementById('newChatModalOverlay');
const closeNewChatModalBtn = document.getElementById('closeNewChatModalBtn');
const saveAndNewChatBtn = document.getElementById('saveAndNewChatBtn');
const discardAndNewChatBtn = document.getElementById('discardAndNewChatBtn');

// DOM Elements — PWA Installation
const headerInstallBtn = document.getElementById('headerInstallBtn');
const installModalOverlay = document.getElementById('installModalOverlay');
const closeInstallModalBtn = document.getElementById('closeInstallModalBtn');
const confirmInstallPromptBtn = document.getElementById('confirmInstallPromptBtn');

// State
let conversationHistory = [];
let pendingCompilerEntries = [];
let pendingTotalTokens = 0;
let isReadAloudActive = true;
let recognition = null;
let isListening = false;
let deferredPrompt = null;

// PWA Install Event Handler
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('PWA Install prompt captured');
});

function handleAppInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted PWA installation');
      }
      deferredPrompt = null;
    });
  } else {
    if (installModalOverlay) installModalOverlay.classList.add('active');
  }
}

if (headerInstallBtn) headerInstallBtn.addEventListener('click', handleAppInstall);
if (confirmInstallPromptBtn) confirmInstallPromptBtn.addEventListener('click', handleAppInstall);

if (closeInstallModalBtn) {
  closeInstallModalBtn.addEventListener('click', () => {
    installModalOverlay.classList.remove('active');
  });
}

// Initialize Application
async function initApp() {
  try {
    rifEngine.tokenCount = 0;
    rifEngine.activePack = null;
    activeKpCard.style.display = 'none';

    updateRamDashboard();
    setupSpeechRecognition();

    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        await navigator.serviceWorker.register('/sw.js');
      } catch (e) {}
    }

    const gpuStatus = await modelRunner.checkWebGpuSupport();
    if (gpuStatus.supported) {
      gpuInfoText.innerHTML = `⚡ <strong>WebGPU Active:</strong> ${gpuStatus.adapterInfo.vendor || 'Local GPU'}`;
    } else {
      gpuInfoText.innerHTML = `⚠️ <strong>WASM Fallback:</strong> ${gpuStatus.reason}`;
    }

    await modelRunner.loadModel();
    updateRamDashboard();
  } catch (err) {
    console.error("App startup initialization error:", err);
    updateRamDashboard();
  }
}

/**
 * Updates Header RAM Dashboard & Live 3M Token Capacity
 */
function updateRamDashboard() {
  try {
    const stats = rifEngine.getLiveMemoryStats(true, 350.0);
    
    if (qwenRamVal) qwenRamVal.textContent = `${stats.qwenRamMb} MB`;
    if (rifRamVal) rifRamVal.textContent = `${stats.rifRamMb} MB`;
    if (rifTokenCapacity) rifTokenCapacity.textContent = `${stats.formattedTokenCount} / 3,000,000 Tokens`;
    if (rifTokenPercent) rifTokenPercent.textContent = `${stats.capacityPct}% Capacity`;
    
    if (totalRamVal) totalRamVal.textContent = `${stats.totalAppRamMb} MB`;
    if (tradKvVal) tradKvVal.textContent = `${stats.standardKvMb} MB`;
    if (savingsBadge) savingsBadge.textContent = `⚡ ${stats.memorySavingsPct}% RAM Saved`;
  } catch (err) {
    console.error("Error updating RAM dashboard:", err);
  }
}

/**
 * Audio Voice Read Aloud Toggle
 */
speakerToggleBtn.addEventListener('click', () => {
  isReadAloudActive = !isReadAloudActive;
  
  if (isReadAloudActive) {
    speakerToggleBtn.classList.add('active');
    speakerToggleBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> Read Aloud: Active`;
  } else {
    speakerToggleBtn.classList.remove('active');
    speakerToggleBtn.innerHTML = `<i class="fa-solid fa-volume-xmark"></i> Read Aloud: Muted`;
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
  }
});

/**
 * Speech Recognition (Speech-to-Text Voice Dictation)
 */
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = 'none';
    console.warn("Speech recognition API not supported in this browser.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('listening');
    userInput.placeholder = "Listening aloud... speak clearly now";
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('listening');
    userInput.placeholder = "Ask Kalpanā anything...";
  };

  recognition.onerror = (e) => {
    console.error("Speech recognition error:", e.error);
    isListening = false;
    micBtn.classList.remove('listening');
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    userInput.value = (userInput.value + " " + transcript).trim();
    userInput.focus();
  };
}

micBtn.addEventListener('click', () => {
  if (!recognition) return;
  
  if (isListening) {
    recognition.stop();
  } else {
    recognition.start();
  }
});

/**
 * Read Aloud (Text-to-Speech Output)
 */
function readResponseAloud(text) {
  if (!isReadAloudActive) return;

  // Cancel currently running speech first
  window.speechSynthesis.cancel();

  // Strip Markdown markers before reading aloud
  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/[#_*`~\[\]]/g, '');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.05; // Slightly faster natural speed
  
  // Choose standard high-quality English voice if available
  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
  if (enVoice) utterance.voice = enVoice;

  window.speechSynthesis.speak(utterance);
}

// Trigger voices load (required for some browsers)
window.speechSynthesis.getVoices();

/**
 * Document Attachments handler (PDF, TXT, MD)
 */
attachBtn.addEventListener('click', () => promptAttachmentInput.click());

promptAttachmentInput.addEventListener('change', async (e) => {
  if (e.target.files.length > 0) {
    const file = e.target.files[0];
    await handlePromptAttachment(file);
  }
});

async function handlePromptAttachment(file) {
  appendMessage('assistant', `<i class="fa-solid fa-spinner fa-spin"></i> Parsing attached document **"${file.name}"**...`);
  
  try {
    let extractedText = "";
    if (file.name.endsWith('.pdf')) {
      extractedText = await rifEngine._extractTextFromPdf(file);
    } else {
      extractedText = await file.text();
    }

    const estTokens = Math.max(Math.floor(extractedText.length / 4), 10);
    
    // Add file text to local prompt input to send
    userInput.value = `[Document Attachment: "${file.name}" (${estTokens.toLocaleString()} Tokens)]\n\n${extractedText.substring(0, 10000)}\n\nUser Query: ${userInput.value}`;
    
    // Increment token count
    rifEngine.addTokens(estTokens);
    updateRamDashboard();

    // Clear loading bubble
    chatMessages.lastElementChild.remove();
    appendMessage('assistant', `📎 Successfully attached **"${file.name}"** (${estTokens.toLocaleString()} Tokens). The text context has been injected directly into Kalpanā's prompt RIF memory.`);
    userInput.focus();
  } catch (err) {
    chatMessages.lastElementChild.remove();
    alert(`Failed to parse attachment: ${err.message}`);
  }
}

/**
 * New Chat / Delete Conversation Handlers with Save Prompt
 */
newChatBtn.addEventListener('click', () => {
  if (conversationHistory.length > 0) {
    newChatModalOverlay.classList.add('active');
  } else {
    resetChatSession();
  }
});

closeNewChatModalBtn.addEventListener('click', () => {
  newChatModalOverlay.classList.remove('active');
});

saveAndNewChatBtn.addEventListener('click', () => {
  const result = rifEngine.exportChatSessionKp(conversationHistory);
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  a.click();
  URL.revokeObjectURL(url);

  newChatModalOverlay.classList.remove('active');
  resetChatSession();
});

discardAndNewChatBtn.addEventListener('click', () => {
  newChatModalOverlay.classList.remove('active');
  resetChatSession();
});

function resetChatSession() {
  conversationHistory = [];
  rifEngine.tokenCount = rifEngine.activePack ? rifEngine.activePack.metadata.tokenCount : 0;
  window.speechSynthesis.cancel();
  
  chatMessages.innerHTML = `
    <div class="message-row">
      <div class="avatar assistant">
        <img src="/assets/icon-192.png" style="width:20px;height:20px;border-radius:4px;object-fit:cover;" alt="Kalpanā">
      </div>
      <div class="bubble">
        Started a <strong>New Chat Session</strong>! Context memory has been reset.<br><br>
        You can now run up to <strong>3 Million Tokens</strong> on any device. After hitting 3M tokens, you can continue chatting seamlessly, though Kalpanā may start to gradually fade older context details. Whenever needed, simply export your session as a <strong>6.3 MB .kp Knowledge Pack</strong> and start a brand-new 3M token conversation anytime!
      </div>
    </div>
  `;

  updateRamDashboard();
}

/**
 * Unload Active Knowledge Pack
 */
unloadKpBtn.addEventListener('click', () => {
  rifEngine.activePack = null;
  rifEngine.tokenCount = 0;
  activeKpCard.style.display = 'none';
  window.speechSynthesis.cancel();
  updateRamDashboard();
});

/**
 * Multi-PDF Compiler Modal Handlers
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

  multiPdfDropzone.innerHTML = `
    <i class="fa-solid fa-folder-open" style="font-size: 32px; color: var(--accent-lime); margin-bottom: 8px;"></i>
    <div style="font-size: 13px; font-weight: 700;">Select Multiple PDF / Text Files</div>
    <div style="font-size: 11px; color: var(--text-muted);">Hold Ctrl/Cmd or Shift to select multiple files at once</div>
  `;

  selectedFileCount.textContent = pendingCompilerEntries.length;
  selectedFilesList.innerHTML = pendingCompilerEntries.map(e => `
    <div class="selected-file-item">
      <span class="file-item-name"><i class="fa-regular fa-file-pdf" style="margin-right: 6px; color: var(--accent-rose);"></i> ${escapeHtml(e.name)}</span>
      <span class="file-item-tokens">~${e.estimatedTokens.toLocaleString()} Tokens</span>
    </div>
  `).join('');

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

compileAndLoadBtn.addEventListener('click', () => {
  if (pendingCompilerEntries.length === 0) {
    alert("Please select at least one PDF or document file to compile!");
    return;
  }

  const title = kpOutputTitle.value.trim() || "My_MultiDoc_Knowledge_Pack";
  const result = rifEngine.compileMultiDocKp(title, pendingCompilerEntries, pendingTotalTokens);
  
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  a.click();
  URL.revokeObjectURL(url);

  activeKpCard.style.display = 'flex';
  kpTitle.textContent = result.pack.filename;
  kpMeta.textContent = `${result.pack.metadata.docCount} Docs · ${result.pack.metadata.tokenCount.toLocaleString()} Tokens · Bounded 6.3 MB`;

  appendMessage('assistant', `✅ Compiled **${result.pack.metadata.docCount} Documents** into **"${result.pack.filename}"** (6.3 MB Fixed State) and loaded into Kalpanā RIF memory! Total Context: **${result.pack.metadata.tokenCount.toLocaleString()} Tokens**.`);

  compilerModalOverlay.classList.remove('active');
  updateRamDashboard();
});

/**
 * Export Chat Session
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

  appendMessage('assistant', `📦 Exported full chat session context (${result.tokenCount.toLocaleString()} Tokens) into **"${result.filename}"** (6.3 MB Fixed State Knowledge Pack).`);
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
    activeKpCard.style.display = 'flex';
    kpTitle.textContent = pack.filename;
    kpMeta.textContent = `${pack.metadata.tokenCount.toLocaleString()} Tokens · Bounded 6.3 MB Phase Index`;
    
    appendMessage('assistant', `✅ Loaded Knowledge Pack **"${pack.filename}"** into Kalpanā RIF memory. Context expanded to **${pack.metadata.tokenCount.toLocaleString()} Tokens** while memory stays bounded at **6.3 MB**!`);
    updateRamDashboard();
  } catch (err) {
    alert(`Failed to load file: ${err.message}`);
  }
}

/**
 * Chat Messaging Handler (Form Submit & Click)
 */
async function handleSend() {
  const rawText = userInput.value;
  const text = rawText ? rawText.trim() : '';
  if (!text) return;

  userInput.value = '';
  sendBtn.disabled = true;

  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  rifEngine.addTokens(Math.floor(text.length / 4) + 150);
  updateRamDashboard();

  const assistantBubble = appendMessage('assistant', '<i class="fa-solid fa-spinner fa-spin"></i> Processing with WebGPU + RIF...');

  try {
    const responseText = await modelRunner.generateResponse(
      conversationHistory,
      (chunk) => {
        if (chunk && chunk.fullText) {
          assistantBubble.innerHTML = formatMarkdown(chunk.fullText);
          chatMessages.scrollTop = chatMessages.scrollHeight;
          updateRamDashboard();
        }
      },
      rifEngine
    );

    if (responseText && (assistantBubble.innerHTML.includes('fa-spinner') || assistantBubble.innerText.includes('Processing'))) {
      assistantBubble.innerHTML = formatMarkdown(responseText);
    }

    conversationHistory.push({ role: 'assistant', content: assistantBubble.innerText });
    
    // Read the response aloud
    readResponseAloud(assistantBubble.innerText);
  } catch (err) {
    console.error("Inference execution error:", err);
    assistantBubble.innerHTML = `<span style="color: var(--accent-rose);">Error: ${err.message}</span>`;
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
    updateRamDashboard();
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

// Single Form Submit listener
if (chatForm) {
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSend();
  });
}

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
