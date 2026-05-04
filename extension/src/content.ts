let seenMessages = new Set<string>();
let messageBuffer: {text: string, url: string, site: string}[] = [];

let settings = {
  autoSync: false,
  sites: ['messenger.com', 'instagram.com', 'whatsapp.com'],
  bufferSize: 3000,
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
  if (res.seen_hashes) {
    res.seen_hashes.forEach((h: string) => seenMessages.add(h));
  }
});

// Time detection regex (Local, zero AI cost)
const timeRegex = /([今明後]天|禮拜[一二三四五六日天]|星期[一二三四五六日天]|下週|下星期|早上|下午|晚上|\d{1,2}點|\d{1,2}:\d{2}|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|[0-9]{1,2}(am|pm))/i;

// Listen for settings updates and toast requests
chrome.runtime.onMessage.addListener((request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
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
  let toast = document.getElementById(toastId);
  
  if (!toast) {
    toast = document.createElement('div');
    toast.id = toastId;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: isAlert ? '120px' : '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '12px',
      backgroundColor: isAlert ? 'rgba(255, 250, 240, 0.95)' : 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      border: `1px solid ${isAlert ? 'rgba(251, 191, 36, 0.5)' : 'rgba(255, 255, 255, 0.3)'}`,
      zIndex: '2147483647',
      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      opacity: '0',
      transform: 'translateY(20px) scale(0.95)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '14px',
      fontWeight: '600',
      color: '#1e293b',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });
    document.body.appendChild(toast);
  }

  const icon = isError ? '❌' : (isAlert ? '💡' : '✨');
  const color = isError ? '#ef4444' : (isAlert ? '#d97706' : '#3b82f6');
  toast.innerHTML = `<span style="font-size: 18px;">${icon}</span> <span style="color: ${color}">${message}</span>`;
  
  requestAnimationFrame(() => {
    toast!.style.opacity = '1';
    toast!.style.transform = 'translateY(0) scale(1)';
  });

  setTimeout(() => {
    toast!.style.opacity = '0';
    toast!.style.transform = 'translateY(20px) scale(0.95)';
  }, isAlert ? 6000 : 3000);
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

  const currentSize = messageBuffer.map(m => m.text).join(' ').length;
  const percent = Math.min(100, (currentSize / settings.bufferSize) * 100);
  
  container.style.display = 'flex';
  container.innerHTML = `
    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${percent > 90 ? '#ef4444' : '#3b82f6'}; box-shadow: 0 0 8px ${percent > 90 ? '#fca5a5' : '#93c5fd'};"></div>
    <span style="letter-spacing: -0.2px;">SmartTODO: ${currentSize.toLocaleString()} / ${settings.bufferSize.toLocaleString()}</span>
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

function checkAndAccumulateChat() {
  if (!chrome.runtime?.id) return;
  if (!settings.autoSync || !isOnMonitoredSite()) {
    updateBufferUI();
    return;
  }

  try {
    const messageElements = Array.from(document.querySelectorAll('div[dir="auto"]'));
    const chatTexts = messageElements
      .map(el => {
        const text = el.textContent?.trim();
        if (!text) return null;

        let timeStr = "";
        
        // 嘗試從祖父/曾祖父節點尋找是否有時間提示屬性 (Messenger 常見作法)
        let parent = el.parentElement;
        for (let i = 0; i < 4 && parent; i++) {
           const tooltip = parent.getAttribute('data-tooltip-content');
           if (tooltip && (tooltip.includes(':') || tooltip.includes('上午') || tooltip.includes('下午'))) {
               timeStr = `[${tooltip}] `;
               break;
           }
           parent = parent.parentElement;
        }

        // 如果找不到特定的 tooltip，嘗試在附近找可能包含時間的 span
        if (!timeStr) {
           const nearbySpans = el.closest('[role="row"]')?.querySelectorAll('span') || [];
           for (const span of nearbySpans) {
               const spanText = span.textContent?.trim();
               if (spanText && (spanText.includes('上午') || spanText.includes('下午') || /\d{1,2}:\d{2}/.test(spanText))) {
                   // 簡易判斷，避免把一般的訊息當作時間
                   if (spanText.length < 20) {
                       timeStr = `[${spanText}] `;
                       break;
                   }
               }
           }
        }
        
        // 如果還是找不到，可以考慮加上當下時間當作備案 (或者不加)
        // timeStr = timeStr || `[${new Date().toLocaleTimeString()}] `;

        return timeStr + text;
      })
      .filter(text => text && text.length > 0) as string[];

    let added = false;

    if (isMessengerSite) {
      // ＝＝＝ Messenger 模式 (Incremental Mode) ＝＝＝
      // 這種模式下，我們只記住「最下面（最新）的一則訊息」。
      // 當畫面更新時，我們從目前的清單中尋找上次記錄的那則訊息，並「只擷取它下方後來出現的新訊息」送去分析。
      // 這樣可以精準抓出在同個聊天室中，使用者看到的新增內容，避免用 Set 導致「相同內容被忽略」或「順序被破壞」。
      if (chatTexts.length > 0) {
        let newMessages: string[] = [];
        if (!lastMessageText) {
          // 第一次讀取，全部當作新訊息
          newMessages = chatTexts;
        } else {
          // 尋找上次最後一則訊息的位置 (從後面找比較準，因為可能會有重複對話)
          const lastIdx = chatTexts.lastIndexOf(lastMessageText);
          if (lastIdx !== -1) {
            // 只擷取最後一次紀錄之後的新訊息
            newMessages = chatTexts.slice(lastIdx + 1);
          } else {
            // 如果找不到上次的訊息，可能是切換了聊天室，這時將目前的訊息全部視為新內容
            newMessages = chatTexts;
          }
        }

        if (newMessages.length > 0) {
          messageBuffer.push(...newMessages);
          added = true;
          // 更新「最後一則訊息」為這一批的最後一個
          lastMessageText = chatTexts[chatTexts.length - 1];
        }
      }
    } else {
      // ＝＝＝ 非 Messenger 網站模式 (Buffer Mode) ＝＝＝
      // 在其他非通訊軟體的網頁中（例如一般文章、推文等），結構不會只是單純往下長。
      // 因此沿用原本的 Buffer 邏輯：用 Set 來記錄看過的文字碎片，沒看過就加進 Buffer 累積。
      // 滿了就送出分析，這樣才能涵蓋跳躍式閱讀或動態載入的情況。
      for (const text of chatTexts) {
        if (text && !seenMessages.has(text)) {
          seenMessages.add(text);
          messageBuffer.push(text);
          added = true;
        }
      }
    }

    if (seenMessages.size > 1000) seenMessages.clear();
    if (added) updateBufferUI();

    const isMessageMode = settings.syncMode === 'message';
    const shouldSync = isMessageMode 
      ? messageBuffer.length >= (settings.messageThreshold || 10)
      : messageBuffer.join(' ').length >= settings.bufferSize;

    if (shouldSync) {
      try {
        // 當緩衝區滿了，才送出做 AI 分析
        chrome.runtime.sendMessage({
          action: 'process_chat',
          chatLog: [...messageBuffer]
        });
        messageBuffer = [];
        updateBufferUI();
      } catch (e) {}
    }
  } catch (e) {}
}

setInterval(checkAndAccumulateChat, 5000);
updateBufferUI();
