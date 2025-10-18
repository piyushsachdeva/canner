// Background service worker for Canner

console.log("Canner: Background script loaded");

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Canner installed!");

    // Set default settings
    chrome.storage.local.set({
      responses: [],
      settings: {
        autoShowButton: true,
        apiUrl: "http://localhost:8000",
      },
    });

    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL("welcome.html"),
    });
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  if (message.action === "openPopup") {
    chrome.action.openPopup();
    sendResponse({ success: true });
  }

  return true; // Keep message channel open for async response
});

// Handle keyboard commands (if configured in manifest)
chrome.commands?.onCommand.addListener((command) => {
  console.log("Command:", command);

  if (command === "open-quick-response") {
    // Send message to active tab to show quick response menu
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "showQuickResponse",
        });
      }
    });
  }
});

// Sync with backend periodically
setInterval(async () => {
  try {
    const result = await fetch("http://localhost:8000/health/");
    if (result.ok) {
      // Backend is available, sync data
      const responses = await fetch("http://localhost:8000/responses/");
      if (responses.ok) {
        const data = await responses.json();
        chrome.storage.local.set({ responses: data });
        console.log("Synced with backend:", data.length, "responses");
      }
    }
  } catch (error) {
    // Backend not available, continue using local storage
  }
}, 5 * 60 * 1000); // Every 5 minutes
