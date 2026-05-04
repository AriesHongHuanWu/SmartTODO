let seenMessages = new Set<string>();
let messageBuffer: string[] = [];
let lastUrl = window.location.href;

let settings = {
  autoSync: false,
  syncMode: 'buffer',
  messageThreshold: 10,
  sites: ['www.messenger.com'],
  bufferSize: 3000,
  useCustomApi: false,
  customApiUrl: '',
  customApiKey: ''
};

// Load settings
chrome.storage.sync.get('smarttodo_settings', (result) => {
  if (result.smarttodo_settings) {
    settings = { ...settings, ...result.smarttodo_settings };
  }
  updateBufferUI();
});

// Listen for settings updates and toast requests
chrome.runtime.onMessage.addListener((request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (request.action === 'settings_updated') {
    settings = { ...settings, ...request.settings };
    updateBufferUI();
  }
  if (request.action === 'show_toast') {
    showToast(request.message, request.isError);
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

function showToast(message: string, isError = false) {
  const toastId = 'smarttodo-toast';
  let toast = document.getElementById(toastId);
  
  if (!toast) {
    toast = document.createElement('div');
    toast.id = toastId;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      zIndex: '2147483647',
      transition: 'all 0.3s ease',
      opacity: '0',
      transform: 'translateY(20px)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '14px',
      fontWeight: '500',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });
    document.body.appendChild(toast);
  }

  const icon = isError ? '❌' : '✨';
  const color = isError ? '#ef4444' : '#3b82f6';
  toast.innerHTML = `<span style="font-size: 18px;">${icon}</span> <span style="color: ${color}">${message}</span>`;
  
  requestAnimationFrame(() => {
    toast!.style.opacity = '1';
    toast!.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast!.style.opacity = '0';
    toast!.style.transform = 'translateY(20px)';
  }, 3000);
}

function isOnMonitoredSite(): boolean {
  const currentHost = window.location.hostname.toLowerCase();
  if (currentHost.includes('messenger.com')) return true;
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
      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    });
    document.body.appendChild(container);
  }

  const currentChars = messageBuffer.join(' ').length;
  const currentMessages = messageBuffer.length;
  
  let label = '';
  let percent = 0;

  if (settings.syncMode === 'message') {
    label = `Messages: ${currentMessages} / ${settings.messageThreshold}`;
    percent = (currentMessages / settings.messageThreshold) * 100;
  } else {
    label = `Buffer: ${currentChars.toLocaleString()} / ${settings.bufferSize.toLocaleString()}`;
    percent = (currentChars / settings.bufferSize) * 100;
  }
  
  container.style.display = 'flex';
  container.innerHTML = `
    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${percent >= 90 ? '#ef4444' : '#3b82f6'}; box-shadow: 0 0 8px ${percent >= 90 ? '#fca5a5' : '#93c5fd'};"></div>
    <span style="letter-spacing: -0.2px;">${label}</span>
  `;
}

function checkAndAccumulateChat() {
  if (!chrome.runtime?.id) return;

  // Handle Chat Switching (URL Change)
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    messageBuffer = []; // Reset buffer for new chat
    seenMessages.clear();
    updateBufferUI();
  }

  if (!settings.autoSync || !isOnMonitoredSite()) {
    updateBufferUI();
    return;
  }

  try {
    const messageElements = Array.from(document.querySelectorAll('div[dir="auto"]'));
    const chatTexts = messageElements
      .map(el => el.textContent?.trim())
      .filter(text => text && text.length > 0);

    let added = false;
    for (const text of chatTexts) {
      if (text && !seenMessages.has(text)) {
        seenMessages.add(text);
        messageBuffer.push(text);
        added = true;
      }
    }

    if (seenMessages.size > 1000) seenMessages.clear();
    if (added) {
      updateBufferUI();
      
      // Check trigger conditions
      let shouldSync = false;
      if (settings.syncMode === 'message') {
        if (messageBuffer.length >= settings.messageThreshold) shouldSync = true;
      } else {
        if (messageBuffer.join(' ').length >= settings.bufferSize) shouldSync = true;
      }

      if (shouldSync) {
        try {
          chrome.runtime.sendMessage({
            action: 'process_chat',
            chatLog: [...messageBuffer]
          });
          messageBuffer = [];
          updateBufferUI();
        } catch (e) {}
      }
    }
  } catch (e) {}
}

setInterval(checkAndAccumulateChat, 5000);
updateBufferUI();
