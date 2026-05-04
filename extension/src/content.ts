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

// Listen for settings updates
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'settings_updated') {
    settings = { ...settings, ...request.settings };
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
