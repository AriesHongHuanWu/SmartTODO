let seenMessages = new Set<string>();
let messageBuffer: {text: string, url: string, site: string}[] = [];
let lastMessageText: string | null = null; // 用於 Incremental Mode 紀錄上一批最後一則訊息

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
  let percent = 0;
  let text = '';

  if (isMessageMode) {
    const currentCount = messageBuffer.length;
    percent = Math.min(100, (currentCount / (settings.messageThreshold || 10)) * 100);
    text = `SmartTODO: ${currentCount} / ${settings.messageThreshold || 10} msgs`;
  } else {
    const currentSize = messageBuffer.map(m => m.text).join(' ').length;
    percent = Math.min(100, (currentSize / settings.bufferSize) * 100);
    text = `SmartTODO: ${currentSize.toLocaleString()} / ${settings.bufferSize.toLocaleString()} chars`;
  }
  
  container.style.display = 'flex';
  container.innerHTML = `
    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${percent > 90 ? '#ef4444' : '#3b82f6'}; box-shadow: 0 0 8px ${percent > 90 ? '#fca5a5' : '#93c5fd'};"></div>
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
            try { chrome.runtime.sendMessage({ action: 'check_schedule', text }); } catch(e) {}
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
    const shouldSync = isMessageMode 
      ? messageBuffer.length >= (settings.messageThreshold || 10)
      : messageBuffer.map(m => m.text).join(' ').length >= settings.bufferSize;

    if (shouldSync) {
      try {
        let finalBuffer = [...messageBuffer];
        messageBuffer = [];
        updateBufferUI();

        let useNano = settings.useLocalAi;
        if (useNano && (window as any).ai && (window as any).ai.languageModel) {
          showToast("🤖 Nano is filtering messages locally...");
          try {
            const capabilities = await (window as any).ai.languageModel.capabilities();
            if (capabilities.available !== 'no') {
              const session = await (window as any).ai.languageModel.create({
                systemPrompt: `You are a strict binary classifier. Determine if the message contains an actionable task, a todo, a meeting arrangement, a promise to do something, or a schedule. Reply ONLY with "YES" or "NO".`
              });

              const filteredLogs = [];
              for (const log of finalBuffer) {
                try {
                  const res = await session.prompt(log.text);
                  if (res.toUpperCase().includes('YES')) {
                    filteredLogs.push(log);
                  }
                } catch(e) {
                  filteredLogs.push(log);
                }
              }
              session.destroy();
              
              if (filteredLogs.length === 0) {
                showToast("✨ Nano filtered casual chat. No tasks found.");
                return; 
              }
              
              finalBuffer = filteredLogs;
              showToast(`☁️ Nano found ${filteredLogs.length} potential tasks. Sending to Flash-Lite...`);
            }
          } catch(e) {
            console.warn("Nano error in content script:", e);
          }
        }

        chrome.runtime.sendMessage({
          action: 'process_chat',
          chatLog: finalBuffer
        });
      } catch (e) {}
    }
  } catch (e) {}
}

setInterval(checkAndAccumulateChat, 3000);
updateBufferUI();
