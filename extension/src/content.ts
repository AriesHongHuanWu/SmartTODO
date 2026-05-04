let seenMessages = new Set<string>();
let messageBuffer: string[] = [];
let settings = {
  autoSync: false,
  sites: ['www.messenger.com'],
  bufferSize: 5000,
  useCustomApi: false,
  customApiUrl: '',
  customApiKey: ''
};

// Load settings
chrome.storage.sync.get('smarttodo_settings', (result) => {
  if (result.smarttodo_settings) {
    settings = { ...settings, ...result.smarttodo_settings };
  }
});

// Listen for settings updates and toast requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'settings_updated') {
    settings = { ...settings, ...request.settings };
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
      zIndex: '999999',
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
  
  // Show
  requestAnimationFrame(() => {
    toast!.style.opacity = '1';
    toast!.style.transform = 'translateY(0)';
  });

  // Hide after 3 seconds
  setTimeout(() => {
    toast!.style.opacity = '0';
    toast!.style.transform = 'translateY(20px)';
  }, 3000);
}

function isOnMonitoredSite(): boolean {
  const currentHost = window.location.hostname;
  return settings.sites.some(site => currentHost.includes(site));
}

function checkAndAccumulateChat() {
  // Only run if auto-sync is ON and we're on a monitored site
  if (!settings.autoSync || !isOnMonitoredSite()) return;

  try {
    const messageElements = Array.from(document.querySelectorAll('div[dir="auto"]'));
    
    const chatTexts = messageElements
      .map(el => el.textContent?.trim())
      .filter(text => text && text.length > 0);

    for (const text of chatTexts) {
      if (text && !seenMessages.has(text)) {
        seenMessages.add(text);
        messageBuffer.push(text);
      }
    }

    if (seenMessages.size > 1000) {
      seenMessages.clear();
    }

    const currentBufferStr = messageBuffer.join(' ');
    if (currentBufferStr.length >= settings.bufferSize) {
      chrome.runtime.sendMessage({
        action: 'process_chat',
        chatLog: [...messageBuffer]
      });
      messageBuffer = [];
    }
  } catch (e) {
    console.error('SmartTODO: Error extracting chat', e);
  }
}

// Scan DOM every 5 seconds
setInterval(checkAndAccumulateChat, 5000);
