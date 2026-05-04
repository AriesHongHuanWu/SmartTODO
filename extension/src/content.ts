chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract_chat') {
    // Basic logic to extract last 20 messages from Messenger
    // Messenger DOM changes often, we'll look for common text elements.
    // Usually they are in elements with dir="auto" inside the main chat view
    
    try {
      const messageElements = Array.from(document.querySelectorAll('div[dir="auto"]'));
      
      // Filter out elements that don't look like chat messages and take the last 20
      // In a robust implementation, you'd target the specific list container
      const chatTexts = messageElements
        .map(el => el.textContent?.trim())
        .filter(text => text && text.length > 0)
        .slice(-20);

      // Send to background for processing
      chrome.runtime.sendMessage({
        action: 'process_chat',
        chatLog: chatTexts
      });

      sendResponse({ status: "Extracting..." });
    } catch (e) {
      console.error(e);
      sendResponse({ status: "Error extracting chat" });
    }
  }
});
