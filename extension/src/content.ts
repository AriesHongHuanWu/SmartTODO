let seenMessages = new Set<string>();
let messageBuffer: {text: string, url: string, site: string}[] = [];

// Nano Map-Reduce State
let nanoPendingTasks: any[] = [];
let nanoChunkCount = 0;

let settings = {
  autoSync: false,
  syncMode: 'buffer',
  messageThreshold: 10,
  sites: ['messenger.com', 'instagram.com', 'whatsapp.com'],
  bufferSize: 3000,
  useLocalAi: false,
  useCustomApi: false,
  customApiUrl: '',
  customApiKey: ''
};

// Load settings and hashes
chrome.storage.sync.get('smarttodo_settings', (result) => {
  if (result.smarttodo_settings) {
    settings = { ...settings, ...result.smarttodo_settings };
  }
  updateBufferUI();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.smarttodo_settings) {
    settings = { ...settings, ...(changes.smarttodo_settings.newValue as any) };
    updateBufferUI();
  }
});

chrome.storage.local.get('seen_hashes', (res) => {
  if (res.seen_hashes && Array.isArray(res.seen_hashes)) {
    res.seen_hashes.forEach((h: string) => seenMessages.add(h));
  }
});

// Time detection regex (Local, zero AI cost)
const timeRegex = /([今明後]天|禮拜[一二三四五六日天]|星期[一二三四五六日天]|下週|下星期|早上|下午|晚上|\d{1,2}點|\d{1,2}:\d{2}|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|[0-9]{1,2}(am|pm))/i;

// Listen for settings updates and toast requests
chrome.runtime.onMessage.addListener((request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (request.action === 'settings_updated') {
    settings = { ...settings, ...request.settings };
    updateBufferUI();
  }
  if (request.action === 'show_toast') {
    showToast(request.message, request.isError, request.isAlert);
  }
  if (request.action === 'extract_chat') {
    if (messageBuffer.length > 0) {
      chrome.runtime.sendMessage({
        action: 'process_chat',
        chatLog: [...messageBuffer]
      });
      messageBuffer = [];
      updateBufferUI();
      sendResponse({ status: "Extracting buffered messages..." });
    } else {
      sendResponse({ status: "No new messages to sync" });
    }
  }
});

function showToast(message: string, isError = false, isAlert = false) {
  const toastId = isAlert ? 'smarttodo-alert' : 'smarttodo-toast';
  let toast = document.getElementById(toastId) as HTMLElement & { _timerId?: any };
  
  if (!toast) {
    toast = document.createElement('div') as any;
    toast.id = toastId;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: isAlert ? '120px' : '20px',
      right: '20px',
      height: '40px',
      borderRadius: '20px',
      backgroundColor: isAlert ? 'rgba(255, 250, 240, 0.95)' : 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      boxShadow: isAlert ? '0 4px 16px rgba(217, 119, 6, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
      border: `1px solid ${isAlert ? 'rgba(251, 191, 36, 0.5)' : 'rgba(255, 255, 255, 0.3)'}`,
      zIndex: '2147483647',
      transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      opacity: '0',
      transform: 'translateY(20px) scale(0.95)',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      cursor: 'pointer',
      width: '40px' // Initial compact size
    });
    
    toast.addEventListener('mouseenter', () => {
      toast.style.width = 'auto';
      toast.style.paddingRight = '16px';
      const textSpan = toast.querySelector('.toast-text') as HTMLElement;
      if (textSpan) {
        textSpan.style.opacity = '1';
        textSpan.style.maxWidth = '300px';
        textSpan.style.marginLeft = '4px';
      }
    });
    
    toast.addEventListener('mouseleave', () => {
      toast.style.width = '40px';
      toast.style.paddingRight = '0';
      const textSpan = toast.querySelector('.toast-text') as HTMLElement;
      if (textSpan) {
        textSpan.style.opacity = '0';
        textSpan.style.maxWidth = '0';
        textSpan.style.marginLeft = '0';
      }
    });

    document.body.appendChild(toast);
  }

  if (toast._timerId) {
    clearTimeout(toast._timerId);
  }

  let icon = isError ? '❌' : (isAlert ? '💡' : '✨');
  if (message.includes('Nano')) icon = '🤖';
  if (message.includes('Flash-Lite')) icon = '☁️';
  
  const color = isError ? '#ef4444' : (isAlert ? '#d97706' : '#3b82f6');
  
  toast.innerHTML = `
    <div style="min-width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 18px;">
      ${icon}
    </div>
    <span class="toast-text" style="
      opacity: 0; 
      max-width: 0; 
      overflow: hidden; 
      white-space: nowrap; 
      color: ${color}; 
      font-size: 13px; 
      font-weight: 600; 
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      transition: all 0.3s ease;
    ">
      ${message}
    </span>
  `;
  
  requestAnimationFrame(() => {
    toast!.style.opacity = '1';
    toast!.style.transform = 'translateY(0) scale(1)';
  });

  toast._timerId = setTimeout(() => {
    toast!.style.opacity = '0';
    toast!.style.transform = 'translateY(20px) scale(0.95)';
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, isAlert ? 8000 : 4000);
}

function isOnMonitoredSite(): boolean {
  const currentHost = window.location.hostname.toLowerCase();
  return settings.sites.some(site => site && currentHost.includes(site.toLowerCase()));
}

function updateBufferUI() {
  const containerId = 'smarttodo-buffer-ui';
  let container = document.getElementById(containerId);
  
  if (!settings.autoSync || !isOnMonitoredSite()) {
    if (container) container.style.display = 'none';
    return;
  }

  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '75px',
      right: '20px',
      padding: '8px 14px',
      borderRadius: '20px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
      border: '1px solid rgba(255, 255, 255, 0.5)',
      zIndex: '2147483647',
      fontSize: '12px',
      fontWeight: '700',
      color: '#475569',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      pointerEvents: 'none',
      transition: 'all 0.4s ease'
    });
    document.body.appendChild(container);
  }

  const isMessageMode = settings.syncMode === 'message';
  
  // Force clamping for Nano Map-Reduce
  let effectiveBufSize = settings.bufferSize;
  let effectiveMsgThreshold = settings.messageThreshold || 10;
  
  if (settings.useLocalAi) {
    effectiveBufSize = Math.min(settings.bufferSize, 800);
    effectiveMsgThreshold = Math.min(effectiveMsgThreshold, 5);
  }

  let percent = 0;
  let text = '';

  if (isMessageMode) {
    const currentCount = messageBuffer.length;
    percent = Math.min(100, (currentCount / effectiveMsgThreshold) * 100);
    text = `SmartTODO: ${currentCount} / ${effectiveMsgThreshold} msgs`;
  } else {
    const currentSize = messageBuffer.map(m => m.text).join(' ').length;
    percent = Math.min(100, (currentSize / effectiveBufSize) * 100);
    text = `SmartTODO: ${currentSize.toLocaleString()} / ${effectiveBufSize.toLocaleString()} chars`;
  }
  
  container.style.display = 'flex';
  container.innerHTML = `
    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${percent > 90 ? '#ef4444' : (settings.useLocalAi ? '#10b981' : '#3b82f6')}; box-shadow: 0 0 8px ${percent > 90 ? '#fca5a5' : (settings.useLocalAi ? '#6ee7b7' : '#93c5fd')};"></div>
    <span style="letter-spacing: -0.2px;">${text}</span>
  `;
}

// Simple hash function for persistence
function hashStr(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

async function checkAndAccumulateChat() {
  if (!chrome.runtime?.id) return;
  if (!settings.autoSync || !isOnMonitoredSite()) {
    updateBufferUI();
    return;
  }

  try {
    const currentHost = window.location.hostname.toLowerCase();
    const isMessengerSite = currentHost.includes('messenger.com') || currentHost.includes('instagram.com');

    // Multi-platform selectors
    const selectors = 'div[dir="auto"], span[dir="ltr"], .message-in, .message-out, .c-message__body';
    const messageElements = Array.from(document.querySelectorAll(selectors));
    
    const chatTexts = messageElements
      .map(el => {
        const text = el.textContent?.trim();
        if (!text) return null;

        let timeStr = "";
        let parent = el.parentElement;
        for (let i = 0; i < 4 && parent; i++) {
           const tooltip = parent.getAttribute('data-tooltip-content');
           if (tooltip && (tooltip.includes(':') || tooltip.includes('上午') || tooltip.includes('下午'))) {
               timeStr = `[${tooltip}] `;
               break;
           }
           parent = parent.parentElement;
        }

        if (!timeStr) {
           const nearbySpans = el.closest('[role="row"]')?.querySelectorAll('span') || [];
           for (const span of nearbySpans) {
               const spanText = span.textContent?.trim();
               if (spanText && (spanText.includes('上午') || spanText.includes('下午') || /\d{1,2}:\d{2}/.test(spanText))) {
                   if (spanText.length < 20) {
                       timeStr = `[${spanText}] `;
                       break;
                   }
               }
           }
        }
        return timeStr + text;
      })
      .filter(text => text && text.length > 0) as string[];

    let added = false;
    let localTimeDetected = false;

    const currentUrl = window.location.href;
    const currentSite = window.location.hostname;

    for (const text of chatTexts) {
      if (text) {
        const hash = hashStr(text);
        if (!seenMessages.has(hash)) {
          seenMessages.add(hash);
          messageBuffer.push({ text, url: currentUrl, site: currentSite });
          added = true;

          if (timeRegex.test(text) && !localTimeDetected) {
            localTimeDetected = true;
            try { chrome.runtime.sendMessage({ action: 'check_schedule', text }).catch(()=>{}); } catch(e) {}
          }
        }
      }
    }

    if (seenMessages.size > 2000) {
      const arr = Array.from(seenMessages).slice(-1000);
      seenMessages = new Set(arr);
    }

    if (added) {
      chrome.storage.local.set({ seen_hashes: Array.from(seenMessages).slice(-500) });
      updateBufferUI();
    }

    const isMessageMode = settings.syncMode === 'message';
    let effectiveBufSize = settings.bufferSize;
    let effectiveMsgThreshold = settings.messageThreshold || 10;
    
    if (settings.useLocalAi) {
      effectiveBufSize = Math.min(settings.bufferSize, 800);
      effectiveMsgThreshold = Math.min(effectiveMsgThreshold, 5);
    }

    const shouldSync = isMessageMode 
      ? messageBuffer.length >= effectiveMsgThreshold
      : messageBuffer.map(m => m.text).join(' ').length >= effectiveBufSize;

    if (shouldSync) {
      try {
        let finalBuffer = [...messageBuffer];
        messageBuffer = [];
        updateBufferUI();

        let useNano = settings.useLocalAi;
        if (useNano) {
          if (!(window as any).ai || !(window as any).ai.languageModel) {
            showToast("❌ Local AI not supported or enabled in flags. Please enable Chrome AI flags.", true);
            return;
          }
          
          showToast("🤖 Nano is extracting tasks locally...", false, false);
          try {
            const capabilities = await (window as any).ai.languageModel.capabilities();
            if (capabilities.available === 'no') {
              showToast("❌ Local AI model not supported on this device.", true);
              return;
            }

            let session;
            if (capabilities.available === 'after-download') {
              showToast("⏳ Downloading Gemini Nano Model (2GB)... Please keep this tab open.", false, true);
            }
            
            session = await (window as any).ai.languageModel.create({
              systemPrompt: `Extract new actionable tasks (todo, reminder, meeting) from the chat log. Output STRICTLY as a JSON array of objects. Schema: [{"title": "Task description", "category": "work|personal|general", "time": "extracted time if any"}]. If no tasks, output []. Do not add any conversational text.`,
              monitor(m: any) {
                m.addEventListener('downloadprogress', (e: any) => {
                  if (e.total > 0) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    showToast(`⏳ Downloading AI Model: ${pct}%...`);
                  }
                });
              }
            });
              const chatText = finalBuffer.map(b => b.text).join('\n');
              const res = await session.prompt(chatText);
              session.destroy();
              
              let parsedTasks = [];
              try {
                const cleanJson = res.replace(/```json/g, '').replace(/```/g, '').trim();
                parsedTasks = JSON.parse(cleanJson);
              } catch (e) {
                console.warn("Nano failed to output valid JSON:", res);
                showToast("❌ Nano JSON formatting error. Chunk skipped.", true);
                return;
              }

              if (!Array.isArray(parsedTasks) || parsedTasks.length === 0) {
                showToast("✨ Nano found no tasks in this chunk.");
                return;
              }

              // Add context
              parsedTasks = parsedTasks.map(t => ({ ...t, threadUrl: finalBuffer[0]?.url, siteName: finalBuffer[0]?.site }));
              nanoPendingTasks.push(...parsedTasks);
              nanoChunkCount++;

              if (nanoChunkCount >= 5) {
                showToast("🤖 Nano Map-Reduce: Deduplicating accumulated tasks...", false, false);
                const mergeSession = await (window as any).ai.languageModel.create({
                  systemPrompt: `You are a strict task deduplication AI. You will receive a JSON array of tasks extracted over time. Remove duplicates and merge similar tasks (prioritizing the most recent/detailed one). Return the final clean list as a STRICT JSON array of objects. Schema: [{"title": "Task description", "category": "work|personal|general", "time": "time", "threadUrl": "url", "siteName": "site"}]. Do not add conversational text.`
                });

                const mergedRes = await mergeSession.prompt(JSON.stringify(nanoPendingTasks));
                mergeSession.destroy();

                let finalTasks = [];
                try {
                  const cleanMerged = mergedRes.replace(/```json/g, '').replace(/```/g, '').trim();
                  finalTasks = JSON.parse(cleanMerged);
                } catch(e) {
                  console.warn("Nano merge failed, using raw accumulated tasks");
                  finalTasks = nanoPendingTasks;
                }

                chrome.runtime.sendMessage({
                  action: 'sync_nano_tasks',
                  tasks: finalTasks
                }).catch(()=>{});

                nanoPendingTasks = [];
                nanoChunkCount = 0;
              } else {
                showToast(`🤖 Nano extracted chunk ${nanoChunkCount}/5. Accumulating...`);
              }
              return; 
          } catch(e) {
            console.warn("Nano error in content script:", e);
          }
        }

        chrome.runtime.sendMessage({
          action: 'process_chat',
          chatLog: finalBuffer
        }).catch(()=>{});
      } catch (e) {}
    }
  } catch (e) {}
}

setInterval(checkAndAccumulateChat, 3000);
updateBufferUI();
