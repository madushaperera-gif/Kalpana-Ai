/**
 * Kalpanā AI — Main Application Entry Point
 * Multi-PDF Knowledge Pack Compiler & Live 3M Token Capacity Tracker
 * Features: Speech-to-Text Input, Listen Aloud Voice Output, Document Attachments, PWA Install
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

// DOM Elements — Privacy Disclaimer Modal
const openPrivacyModalBtn = document.getElementById('openPrivacyModalBtn');
const privacyModalOverlay = document.getElementById('privacyModalOverlay');
const closePrivacyModalBtn = document.getElementById('closePrivacyModalBtn');
const closePrivacyModalConfirmBtn = document.getElementById('closePrivacyModalConfirmBtn');

// DOM Elements — Global Reach Metrics
const metricsViews = document.getElementById('metricsViews');
const metricsDownloads = document.getElementById('metricsDownloads');
const metricsCountries = document.getElementById('metricsCountries');
const onlineIndicator = document.getElementById('onlineIndicator');

// State
let conversationHistory = [];
let pendingCompilerEntries = [];
let pendingTotalTokens = 0;
let isReadAloudActive = true;
let recognition = null;
let isListening = false;
let deferredPrompt = null;

// Privacy Modal Handlers
if (openPrivacyModalBtn) {
  openPrivacyModalBtn.addEventListener('click', () => {
    if (privacyModalOverlay) privacyModalOverlay.classList.add('active');
  });
}

if (closePrivacyModalBtn) {
  closePrivacyModalBtn.addEventListener('click', () => {
    if (privacyModalOverlay) privacyModalOverlay.classList.remove('active');
  });
}

if (closePrivacyModalConfirmBtn) {
  closePrivacyModalConfirmBtn.addEventListener('click', () => {
    if (privacyModalOverlay) privacyModalOverlay.classList.remove('active');
  });
}

/**
 * Real-time Online Page Metrics Counter
 * ZERO network calls executed once installed or offline!
 */
async function initTelemetryMetrics() {
  const isInstalledPwa = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const isOffline = !navigator.onLine;

  if (isInstalledPwa || isOffline || !window.location.protocol.startsWith('http')) {
    if (onlineIndicator) onlineIndicator.innerHTML = '● OFFLINE APP';
    const savedViews = localStorage.getItem('kalpana_views') || '1';
    const savedDownloads = localStorage.getItem('kalpana_downloads') || '0';
    if (metricsViews) metricsViews.textContent = formatMetricNumber(parseInt(savedViews));
    if (metricsDownloads) metricsDownloads.textContent = formatMetricNumber(parseInt(savedDownloads));
    if (metricsCountries) metricsCountries.textContent = '1+';
    return;
  }

  let views = parseInt(localStorage.getItem('kalpana_views') || '1');
  let downloads = parseInt(localStorage.getItem('kalpana_downloads') || '0');

  // Real-time live view counter starting from true 1
  try {
    if (!sessionStorage.getItem('kalpana_page_viewed')) {
      views += 1;
      localStorage.setItem('kalpana_views', views.toString());
      sessionStorage.setItem('kalpana_page_viewed', 'true');
    }
  } catch(e) {}

  if (metricsViews) metricsViews.textContent = formatMetricNumber(views);
  if (metricsDownloads) metricsDownloads.textContent = formatMetricNumber(downloads);
  if (metricsCountries) metricsCountries.textContent = '1+';
}

function recordDownloadMetric() {
  const isInstalledPwa = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (!isInstalledPwa && window.location.protocol.startsWith('http')) {
    let downloads = parseInt(localStorage.getItem('kalpana_downloads') || '0') + 1;
    localStorage.setItem('kalpana_downloads', downloads.toString());
    if (metricsDownloads) metricsDownloads.textContent = formatMetricNumber(downloads);
  }
}

function formatMetricNumber(num) {
  return num >= 1000 ? `${(num / 1000).toFixed(1)}K` : num.toString();
}

// PWA Install Event Handler
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('PWA Install prompt captured');
});

function handleAppInstall() {
  recordDownloadMetric();
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
    initTelemetryMetrics();
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
    speakerToggleBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Read Aloud: Active`;
  } else {
    speakerToggleBtn.classList.remove('active');
    speakerToggleBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg> Read Aloud: Muted`;
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

  window.speechSynthesis.cancel();

  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/[#_*`~\[\]]/g, '');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.05;
  
  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
  if (enVoice) utterance.voice = enVoice;

  window.speechSynthesis.speak(utterance);
}

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
    
    userInput.value = `[Document Attachment: "${file.name}" (${estTokens.toLocaleString()} Tokens)]\n\n${extractedText.substring(0, 10000)}\n\nUser Query: ${userInput.value}`;
    
    rifEngine.addTokens(estTokens);
    updateRamDashboard();

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
        <img src="assets/icon-192.png" style="width:20px;height:20px;border-radius:4px;object-fit:cover;" alt="Kalpanā">
      </div>
      <div class="bubble">
        Started a <strong>New Chat Session</strong>! Context memory has been reset.<br><br>
        You can now run up to <strong>3 Million Tokens</strong> directly on any device offline and share full Knowledge Packs (<strong>.kp</strong>) with your friends.<br><br>
        After hitting 3M tokens, you can continue chatting seamlessly, though Kalpanā may start to gradually fade older context details. Whenever needed, simply export your session as a <strong>6.3 MB .kp Knowledge Pack</strong> and start a brand-new 3M token conversation anytime!
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
  multiPdfDropzone.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" class="fa-spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><div style="font-size: 12px; margin-top: 6px;">Parsing PDF / Document token counts...</div>`;
  
  const result = await rifEngine.processFilesForCompiler(files);
  pendingCompilerEntries = result.entries;
  pendingTotalTokens = result.totalEstimatedTokens;

  multiPdfDropzone.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-lime)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
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

  const assistantBubble = appendMessage('assistant', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fa-spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Processing with WebGPU + RIF...');

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

    if (responseText && (assistantBubble.innerHTML.includes('Processing') || assistantBubble.innerText.includes('Processing'))) {
      assistantBubble.innerHTML = formatMarkdown(responseText);
    }

    conversationHistory.push({ role: 'assistant', content: assistantBubble.innerText });
    
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
