// Canner Content Script
// Injects helper buttons and features into LinkedIn pages

console.log("Canner: Content script loaded");

// Configuration
const CONFIG = {
  API_URL: "http://localhost:8000",
  BUTTON_ICON: "💬",
  BUTTON_COLOR: "#0a66c2", // LinkedIn blue
};

// Track injected elements to avoid duplicates
const injectedElements = new Set<string>();

// Initialize the helper
function init() {
  console.log("Social Helper: Initializing for all platforms...");

  // Add pen buttons to all input boxes
  addMessageHelpers();

  // Add helper buttons to connection request messages (legacy)
  addConnectionHelpers();

  // Monitor DOM changes to inject helpers in dynamically loaded content
  observeDOM();

  // Add keyboard shortcuts
  addKeyboardShortcuts();

  // Add text selection handler
  addTextSelectionHandler();
}

// Add helper buttons to all social media input boxes
function addMessageHelpers() {
  console.log("Social Helper: Adding message helpers...");

  // Target multiple types of input elements across platforms
  const selectors = [
    '[contenteditable="true"]', // LinkedIn, X/Twitter, Facebook
    'textarea[placeholder*="comment" i]', // Comment textareas
    'textarea[placeholder*="message" i]', // Message textareas
    'textarea[placeholder*="reply" i]', // Reply textareas
    'textarea[placeholder*="What" i]', // "What's happening" etc
    'textarea[data-testid="tweetTextarea_0"]', // X/Twitter specific
    'div[data-testid="tweetTextarea_0"]', // X/Twitter contenteditable
    'div[data-testid="dmComposerTextInput"]', // X/Twitter DM input
    'div[data-testid="cellInnerDiv"] [contenteditable="true"]', // X/Twitter replies
    'textarea[name="message"]', // Generic message inputs
    'input[type="text"][placeholder*="comment" i]', // Text inputs for comments
    '[aria-label*="Tweet" i][contenteditable="true"]', // X/Twitter compose
    '[aria-label*="Reply" i][contenteditable="true"]', // X/Twitter replies
    '[data-text="true"][contenteditable="true"]', // X/Twitter alternative
    '.comments-comment-box [contenteditable="true"]', // LinkedIn comments
    '.msg-form [contenteditable="true"]', // LinkedIn messages
    '.share-creation-state [contenteditable="true"]', // LinkedIn posts
  ];

  const messageBoxes = document.querySelectorAll(selectors.join(", "));
  console.log("Social Helper: Found", messageBoxes.length, "input elements");

  messageBoxes.forEach((box, index) => {
    console.log(`Social Helper: Processing element ${index + 1}:`, box);

    // Skip if element is too small or not visible
    const rect = box.getBoundingClientRect();
    console.log(
      `Social Helper: Element ${index + 1} size:`,
      rect.width,
      "x",
      rect.height
    );

    if (rect.width < 100 || rect.height < 20) {
      console.log(`Social Helper: Skipping element ${index + 1} - too small`);
      return;
    }

    // Skip if element is not visible
    const style = window.getComputedStyle(box as HTMLElement);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      console.log(`Social Helper: Skipping element ${index + 1} - not visible`);
      return;
    }

    // Create a simple unique ID
    if (!box.id) {
      box.id = `sh-box-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Check if we already processed this element
    if (injectedElements.has(box.id)) {
      console.log(
        `Social Helper: Skipping element ${index + 1} - already processed`
      );
      return;
    }

    // Check if button already exists nearby
    const container =
      (box as HTMLElement).closest("div") || (box as HTMLElement).parentElement;
    if (container?.querySelector(".social-helper-pen")) {
      console.log(
        `Social Helper: Button already exists for element ${index + 1}`
      );
      injectedElements.add(box.id);
      return;
    }

    console.log(`Social Helper: Creating pen button for element ${index + 1}`);

    // Create minimized pen button
    const penButton = createPenButton(box as HTMLElement);
    positionPenButton(box as HTMLElement, penButton);

    injectedElements.add(box.id);
    console.log(
      `Social Helper: Pen button created and positioned for element ${
        index + 1
      }`
    );
  });
}

// Create a minimized pen button that expands on hover
function createPenButton(targetBox: HTMLElement): HTMLElement {
  const penContainer = document.createElement("div");
  penContainer.className = "social-helper-pen";

  // Detect platform for appropriate styling
  const isLinkedIn =
    window.location.hostname.includes("linkedin") ||
    document.body.className.includes("linkedin") ||
    targetBox.closest('[class*="linkedin"]') !== null;

  const isTwitter =
    window.location.hostname.includes("twitter") ||
    window.location.hostname.includes("x.com") ||
    targetBox.closest("[data-testid]") !== null;

  if (isLinkedIn) {
    penContainer.setAttribute("data-platform", "linkedin");
  } else if (isTwitter) {
    penContainer.setAttribute("data-platform", "twitter");
  }

  penContainer.innerHTML = `
    <div class="pen-icon">✏️</div>
    <div class="pen-tooltip">Quick Response</div>
  `;
  penContainer.title = "Click for quick responses (Ctrl+Shift+L)";

  // Add click handler
  penContainer.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showResponseMenu(targetBox, penContainer);
  });

  // Enhanced hover effects with platform detection
  let hoverTimeout: number;

  penContainer.addEventListener("mouseenter", () => {
    clearTimeout(hoverTimeout);
    penContainer.classList.add("pen-hover");
  });

  penContainer.addEventListener("mouseleave", () => {
    hoverTimeout = window.setTimeout(() => {
      penContainer.classList.remove("pen-hover");
    }, 200); // Slightly faster hide for better UX
  });

  return penContainer;
}

// Position the pen button relative to the input
function positionPenButton(
  inputElement: HTMLElement,
  penButton: HTMLElement
): void {
  document.body.appendChild(penButton);

  let isVisible = false;
  let showTimeout: number;
  let hideTimeout: number;

  const updatePosition = () => {
    const rect = inputElement.getBoundingClientRect();

    // Check if element is still visible
    if (rect.width === 0 || rect.height === 0) {
      hidePenButton();
      return;
    }

    // Smart positioning like Grammarly
    let top = rect.bottom - 45; // Position near bottom-right like Grammarly
    let right = window.innerWidth - rect.right + 8;

    // For larger inputs (like compose areas), position in bottom-right
    if (rect.height > 60) {
      top = rect.bottom - 50;
      right = window.innerWidth - rect.right + 12;
    }

    // For inputs near the edge, adjust positioning
    if (rect.right > window.innerWidth - 60) {
      right = window.innerWidth - rect.left + 8;
    }

    // For inputs near the bottom, position above
    if (rect.bottom > window.innerHeight - 60) {
      top = rect.top - 50;
    }

    // Ensure button is always visible
    top = Math.max(8, Math.min(top, window.innerHeight - 60));
    right = Math.max(8, right);

    penButton.style.position = "fixed";
    penButton.style.top = `${top}px`;
    penButton.style.right = `${right}px`;
    penButton.style.zIndex = "10000";
  };

  const showPenButton = () => {
    clearTimeout(hideTimeout);
    clearTimeout(showTimeout);

    // Small delay like Grammarly
    showTimeout = window.setTimeout(() => {
      if (!isVisible) {
        updatePosition();
        penButton.classList.remove("hiding");
        penButton.classList.add("visible");
        isVisible = true;
      }
    }, 200);
  };

  const hidePenButton = () => {
    clearTimeout(showTimeout);
    clearTimeout(hideTimeout);

    // Longer delay before hiding like Grammarly
    hideTimeout = window.setTimeout(() => {
      if (
        isVisible &&
        !penButton.matches(":hover") &&
        !inputElement.matches(":focus")
      ) {
        penButton.classList.remove("visible");
        penButton.classList.add("hiding");
        isVisible = false;
      }
    }, 1500);
  };

  // Initial positioning (hidden)
  updatePosition();

  // Update position on scroll and resize
  const updateHandler = () => {
    if (isVisible) {
      updatePosition();
    }
  };

  window.addEventListener("scroll", updateHandler, { passive: true });
  window.addEventListener("resize", updateHandler, { passive: true });

  // Show/hide based on input interaction (like Grammarly)
  inputElement.addEventListener("focus", showPenButton);
  inputElement.addEventListener("blur", hidePenButton);
  inputElement.addEventListener("input", showPenButton);
  inputElement.addEventListener("mouseenter", showPenButton);
  inputElement.addEventListener("mouseleave", hidePenButton);

  // Keep button visible when hovering over it
  penButton.addEventListener("mouseenter", () => {
    clearTimeout(hideTimeout);
  });

  penButton.addEventListener("mouseleave", hidePenButton);

  // Clean up listeners when element is removed
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (
          node === inputElement ||
          (node as HTMLElement)?.contains?.(inputElement)
        ) {
          clearTimeout(showTimeout);
          clearTimeout(hideTimeout);
          window.removeEventListener("scroll", updateHandler);
          window.removeEventListener("resize", updateHandler);
          penButton.remove();
          observer.disconnect();
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Create a helper button that shows response options (legacy)
function createHelperButton(targetBox: HTMLElement): HTMLElement {
  const button = document.createElement("button");
  button.className = "linkedin-helper-btn";
  button.innerHTML = `${CONFIG.BUTTON_ICON} <span>Quick Response</span>`;
  button.title = "Insert saved response (Ctrl+Shift+L)";

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showResponseMenu(targetBox, button);
  });

  return button;
}

// Show menu with saved responses
async function showResponseMenu(targetBox: HTMLElement, button: HTMLElement) {
  // Remove existing menu if any
  const existingMenu = document.querySelector(".linkedin-helper-menu");
  if (existingMenu) {
    existingMenu.remove();
    return;
  }

  // Create menu
  const menu = document.createElement("div");
  menu.className = "linkedin-helper-menu";
  menu.innerHTML = '<div class="lh-menu-header">Loading responses...</div>';

  // Position menu near button with smart positioning
  const rect = button.getBoundingClientRect();
  const menuHeight = 400; // Estimated menu height
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;

  // Show above button if not enough space below
  if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
    menu.style.top = `${rect.top - menuHeight - 10}px`;
  } else {
    menu.style.top = `${rect.bottom + 5}px`;
  }

  // Ensure menu doesn't go off-screen horizontally
  const menuWidth = 400;
  const spaceRight = window.innerWidth - rect.left;

  if (spaceRight < menuWidth) {
    menu.style.left = `${rect.right - menuWidth}px`;
  } else {
    menu.style.left = `${rect.left}px`;
  }

  document.body.appendChild(menu);

  try {
    // Fetch responses from backend or local storage
    const responses = await fetchResponses();

    if (responses.length === 0) {
      menu.innerHTML = `
        <div class="lh-menu-header">No saved responses</div>
        <div class="lh-menu-item" data-action="create">
          ➕ Create new response
        </div>
      `;
    } else {
      menu.innerHTML = `
        <div class="lh-menu-header">
          <input type="text" class="lh-search" placeholder="Search responses..." />
        </div>
        <div class="lh-menu-items">
          ${responses
            .map(
              (r) => `
            <div class="lh-menu-item" data-id="${r.id}">
              <div class="lh-item-title">${r.title}</div>
              <div class="lh-item-preview">${r.content.substring(
                0,
                60
              )}...</div>
              ${
                r.tags
                  ? `<div class="lh-item-tags">${r.tags
                      .map((t: string) => `<span class="lh-tag">${t}</span>`)
                      .join("")}</div>`
                  : ""
              }
            </div>
          `
            )
            .join("")}
        </div>
        <div class="lh-menu-footer">
          <button class="lh-btn-create">➕ New Response</button>
        </div>
      `;

      // Add search functionality
      const searchInput = menu.querySelector(".lh-search") as HTMLInputElement;
      searchInput?.addEventListener("input", (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        const items = menu.querySelectorAll(".lh-menu-item");
        items.forEach((item) => {
          const text = item.textContent?.toLowerCase() || "";
          (item as HTMLElement).style.display = text.includes(query)
            ? "block"
            : "none";
        });
      });

      // Add click handlers for responses
      menu.querySelectorAll(".lh-menu-item[data-id]").forEach((item) => {
        item.addEventListener("click", () => {
          const responseId = item.getAttribute("data-id");
          const response = responses.find((r) => r.id === responseId);
          if (response) {
            insertText(targetBox, response.content);
            menu.remove();
          }
        });
      });

      // Handle create new button
      menu.querySelector(".lh-btn-create")?.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "openPopup" });
        menu.remove();
      });
    }
  } catch (error) {
    console.error("Canner: Error fetching responses:", error);
    menu.innerHTML = `
      <div class="lh-menu-header error">Failed to load responses</div>
      <div class="lh-menu-item">Please check your connection</div>
    `;
  }

  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener("click", function closeMenu(e) {
      if (!menu.contains(e.target as Node) && e.target !== button) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    });
  }, 100);
}

// Fetch responses from backend or Chrome storage
async function fetchResponses(): Promise<any[]> {
  try {
    // Try to fetch from backend first (content scripts can make HTTP requests)
    const response = await fetch(`${CONFIG.API_URL}/responses/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      // Cache the data in Chrome storage for offline use
      chrome.storage.local.set({ responses: data });
      return data;
    }
  } catch (error) {
    console.log("Canner: Backend not available, using local storage");
  }

  // Fallback to Chrome storage
  return new Promise((resolve) => {
    chrome.storage.local.get(["responses"], (result) => {
      const responses = result.responses || [];
      // If no data in storage, provide some defaults
      if (responses.length === 0) {
        const defaultResponses = [
          {
            id: "default-1",
            title: "Connection Request",
            content: "Hi {{name}}, I'd love to connect and learn more about your work in {{industry}}.",
            tags: ["linkedin", "networking", "connection"]
          },
          {
            id: "default-2", 
            title: "Thank You Message",
            content: "Thank you for connecting! I appreciate the opportunity to expand my network.",
            tags: ["networking", "gratitude", "professional"]
          }
        ];
        chrome.storage.local.set({ responses: defaultResponses });
        resolve(defaultResponses);
      } else {
        resolve(responses);
      }
    });
  });
}

// Insert text into any type of input box
function insertText(box: HTMLElement, text: string) {
  console.log(
    "Social Helper: Inserting text into:",
    box.tagName,
    box.getAttribute("contenteditable")
  );

  // Focus the element first
  box.focus();

  // Handle different types of input elements
  if (box.getAttribute("contenteditable") === "true") {
    // Contenteditable divs (LinkedIn, X/Twitter, Facebook)
    console.log("Social Helper: Inserting into contenteditable");

    // Focus and move cursor to end
    box.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);

    // Try execCommand first
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, text);
    } catch (e) {
      inserted = false;
    }

    if (!inserted || !box.innerText.includes(text)) {
      // Fallback: insert text node at cursor
      range.deleteContents();
      const tn = document.createTextNode(text);
      range.insertNode(tn);
      range.setStartAfter(tn);
      range.setEndAfter(tn);
      sel?.removeAllRanges();
      sel?.addRange(range);
      // Fire input and change events
      box.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: text, inputType: 'insertText' }));
      box.dispatchEvent(new Event('change', { bubbles: true }));
    }
    console.log('inserted');
  } else if (
    box.tagName === "TEXTAREA" ||
    (box.tagName === "INPUT" && (box as HTMLInputElement).type === "text")
  ) {
    // Regular textarea and text input elements
    console.log("Social Helper: Inserting into textarea/input");

    const inputElement = box as HTMLInputElement | HTMLTextAreaElement;

    // Clear and set the value
    inputElement.value = text;

    // Trigger events
    inputElement.dispatchEvent(new Event("input", { bubbles: true }));
    inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    inputElement.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    inputElement.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

    // Set cursor to end
    setTimeout(() => {
      inputElement.setSelectionRange(text.length, text.length);
    }, 10);
  } else {
    // Fallback: try to set content using various methods
    console.log("Social Helper: Using fallback insertion method");

    try {
      // Try setting innerText first
      if ("innerText" in box) {
        (box as any).innerText = text;
      } else if ("textContent" in box) {
        (box as any).textContent = text;
      }

      // Try setting value if it exists
      if ("value" in box) {
        (box as any).value = text;
      }

      // Trigger comprehensive events
      const events = ["input", "change", "keydown", "keyup", "focus", "blur"];
      events.forEach((eventType) => {
        box.dispatchEvent(new Event(eventType, { bubbles: true }));
      });
    } catch (error) {
      console.error("Social Helper: Failed to insert text:", error);
    }
  }

  console.log("Social Helper: Text insertion completed");
}

// Add helper buttons for connection requests
function addConnectionHelpers() {
  console.log("Canner: Adding connection helpers...");
  // Find connection message boxes that are NOT contenteditable (to avoid overlap)
  const connectionBoxes = document.querySelectorAll(
    '[name="message"]:not([contenteditable="true"])'
  );
  console.log(
    "Canner: Found",
    connectionBoxes.length,
    "connection message boxes"
  );

  connectionBoxes.forEach((box, index) => {
    console.log(`Canner: Processing connection element ${index + 1}:`, box);

    // Skip if element is too small
    const rect = box.getBoundingClientRect();
    if (rect.width < 30 || rect.height < 15) {
      console.log(
        `Canner: Skipping connection element ${index + 1} - too small`
      );
      return;
    }

    // Create simple ID
    if (!box.id) {
      box.id = `lh-conn-${Math.random().toString(36).substr(2, 9)}`;
    }

    if (injectedElements.has(box.id)) {
      console.log(
        `Canner: Skipping connection element ${index + 1} - already processed`
      );
      return;
    }

    console.log(`Canner: Creating button for connection element ${index + 1}`);

    const helperButton = createHelperButton(box as HTMLElement);
    box.parentElement?.insertBefore(helperButton, box);
    injectedElements.add(box.id);
  });
}

// Observe DOM changes to inject helpers in dynamically loaded content
function observeDOM() {
  const observer = new MutationObserver((mutations) => {
    let shouldReinject = false;

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // Element node
          const element = node as HTMLElement;

          // Check for any input elements
          if (
            element.querySelector('[contenteditable="true"]') ||
            element.querySelector("textarea") ||
            element.querySelector('input[type="text"]') ||
            element.getAttribute("contenteditable") === "true" ||
            element.tagName === "TEXTAREA" ||
            (element.tagName === "INPUT" &&
              element.getAttribute("type") === "text")
          ) {
            shouldReinject = true;
          }
        }
      });
    });

    if (shouldReinject) {
      setTimeout(() => {
        addMessageHelpers();
        addConnectionHelpers();
      }, 1000);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Add keyboard shortcuts
function addKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ctrl+Shift+L to open quick responses
    if (e.ctrlKey && e.shiftKey && e.key === "L") {
      e.preventDefault();
      const activeElement = document.activeElement as HTMLElement;
      if (
        activeElement &&
        activeElement.getAttribute("contenteditable") === "true"
      ) {
        const button = activeElement.previousElementSibling as HTMLElement;
        if (button && button.classList.contains("linkedin-helper-btn")) {
          button.click();
        }
      }
    }
  });
}

// Text selection handler - show save button when text is selected
let saveButton: HTMLElement | null = null;

function addTextSelectionHandler() {
  console.log("Canner: Adding text selection handlers");
  
  document.addEventListener("mouseup", () => {
    setTimeout(handleTextSelection, 50);
  });
  
  document.addEventListener("keyup", () => {
    setTimeout(handleTextSelection, 50);
  });
  
  document.addEventListener("selectionchange", () => {
    setTimeout(handleTextSelection, 100);
  });
  
  document.addEventListener("mousedown", (e) => {
    if (saveButton && !saveButton.contains(e.target as Node)) {
      if (saveButton) {
        saveButton.remove();
        saveButton = null;
      }
    }
  });
}

function handleTextSelection() {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  // Remove existing button
  if (saveButton) {
    saveButton.remove();
    saveButton = null;
  }

  // If no text selected, do nothing
  if (!selectedText || selectedText.length === 0) {
    return;
  }

  // Minimum text length to show button (at least 5 characters)
  if (selectedText.length < 5) {
    return;
  }

  // Create and position the save button
  const range = selection!.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  saveButton = document.createElement("div");
  saveButton.className = "linkedin-helper-save-btn";
  saveButton.innerHTML = `
    <button class="lh-save-selection-btn" title="Save as Quick Response">
      <span class="lh-plus-icon">+</span>
    </button>
  `;

  saveButton.style.position = "fixed";
  saveButton.style.left = `${Math.min(rect.right + 5, window.innerWidth - 50)}px`;
  saveButton.style.top = `${Math.min(rect.bottom + 5, window.innerHeight - 50)}px`;
  saveButton.style.zIndex = "999999";
  saveButton.style.pointerEvents = "all";
  saveButton.style.display = "block";
  saveButton.style.visibility = "visible";

  document.body.appendChild(saveButton);

  const btn = saveButton.querySelector(
    ".lh-save-selection-btn"
  ) as HTMLButtonElement;
  
  const textToSave = selectedText;
  
  const clickHandler = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    console.log("Canner: Plus button clicked! Saving selected text:", textToSave);

    // Remove button immediately to prevent double clicks
    if (saveButton) {
      saveButton.remove();
      saveButton = null;
    }

    try {
      // Save directly without dialog
      await saveResponseDirectly(textToSave);
      console.log("Canner: Text saved successfully");
    } catch (error) {
      console.error("Canner: Error saving text:", error);
      showToast("❌ Error saving response");
    }

    // Clear selection after a short delay
    setTimeout(() => {
      selection?.removeAllRanges();
    }, 100);
  };
  
  btn.addEventListener("click", clickHandler, { capture: true, once: true });
  btn.addEventListener("mousedown", clickHandler, { capture: true, once: true });
  btn.addEventListener("touchend", clickHandler, { capture: true, once: true });
  saveButton.addEventListener("click", clickHandler, { capture: true, once: true });
}

// Show dialog to save selected text as response
async function showSaveDialog(text: string) {
  // Create modal overlay
  const modal = document.createElement("div");
  modal.className = "linkedin-helper-modal";
  modal.innerHTML = `
    <div class="lh-modal-content">
      <div class="lh-modal-header">
        <h3>💾 Save as Quick Response</h3>
        <button class="lh-modal-close">✕</button>
      </div>
      <div class="lh-modal-body">
        <div class="lh-form-group">
          <label>Title *</label>
          <input type="text" class="lh-input" id="lh-save-title" placeholder="e.g., Thank you message" required>
        </div>
        <div class="lh-form-group">
          <label>Content *</label>
          <textarea class="lh-input" id="lh-save-content" rows="4" required>${text}</textarea>
        </div>
        <div class="lh-form-group">
          <label>Tags</label>
          <input type="text" class="lh-input" id="lh-save-tags" placeholder="networking, follow-up (comma separated)">
        </div>
        <div class="lh-form-group">
          <label>Category</label>
          <select class="lh-input" id="lh-save-category">
            <option value="message">Message</option>
            <option value="connection">Connection Request</option>
            <option value="follow-up">Follow-up</option>
            <option value="introduction">Introduction</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div class="lh-modal-footer">
        <button class="lh-btn-secondary lh-cancel-btn">Cancel</button>
        <button class="lh-btn-primary lh-save-btn">💾 Save Response</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Handle close
  const closeBtn = modal.querySelector(".lh-modal-close") as HTMLButtonElement;
  const cancelBtn = modal.querySelector(".lh-cancel-btn") as HTMLButtonElement;

  const closeModal = () => {
    modal.remove();
  };

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Handle save
  const saveBtn = modal.querySelector(".lh-save-btn") as HTMLButtonElement;
  saveBtn.addEventListener("click", async () => {
    const title = (
      document.getElementById("lh-save-title") as HTMLInputElement
    ).value.trim();
    const content = (
      document.getElementById("lh-save-content") as HTMLTextAreaElement
    ).value.trim();
    const tags = (
      document.getElementById("lh-save-tags") as HTMLInputElement
    ).value.trim();
    const category = (
      document.getElementById("lh-save-category") as HTMLSelectElement
    ).value;

    if (!title || !content) {
      alert("Please fill in title and content");
      return;
    }

    // Save the response
    try {
      const response = await fetch(`${CONFIG.API_URL}/responses/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          tags,
          category,
        }),
      });

      if (response.ok) {
        showToast("✅ Response saved successfully!");
        closeModal();
      } else {
        // Try Chrome storage as fallback
        await saveToLocalStorage({ title, content, tags, category });
        showToast("✅ Response saved locally!");
        closeModal();
      }
    } catch (error) {
      // Fallback to Chrome storage
      await saveToLocalStorage({ title, content, tags, category });
      showToast("✅ Response saved locally!");
      closeModal();
    }
  });
}

// Save to Chrome local storage
async function saveToLocalStorage(data: {
  title: string;
  content: string;
  tags: string;
  category: string;
}) {
  const result = await chrome.storage.local.get(["responses"]);
  const responses = result.responses || [];
  responses.push({
    id: Date.now(),
    ...data,
    created_at: new Date().toISOString(),
  });
  await chrome.storage.local.set({ responses });
}

// Show success toast message
function showToast(message: string) {
  const toast = document.createElement("div");
  toast.className = "lh-success-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// Save response directly without dialog
async function saveResponseDirectly(text: string) {
  console.log("Canner: saveResponseDirectly called with text:", text);
  
  if (!text || text.trim().length === 0) {
    console.error("Canner: No text provided to save");
    showToast("❌ No text to save");
    return;
  }

  // Show immediate feedback
  showToast("💾 Saving response...");

  // Generate auto title from first 50 chars
  const autoTitle = text.length > 50 ? text.substring(0, 47) + "..." : text;
  const timestamp = new Date().toISOString();

  // Detect platform and set tags/category accordingly
  const isLinkedIn = window.location.hostname.includes("linkedin");
  const isTwitter =
    window.location.hostname.includes("twitter") ||
    window.location.hostname.includes("x.com");

  const responseData = {
    title: autoTitle,
    content: text,
    tags: isTwitter ? ["twitter"] : ["linkedin"],
    category: isTwitter ? "twitter-message" : "linkedin-message",
  };

  console.log("Canner: Attempting to save to backend:", CONFIG.API_URL, responseData);

  // Try to save to backend first
  try {
    const response = await fetch(`${CONFIG.API_URL}/responses/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(responseData),
    });

    console.log("Canner: Backend response status:", response.status);

    if (response.ok) {
      const data = await response.json();
      console.log("Canner: Saved to backend successfully:", data);
      showToast("✅ Response saved to database!");
      return;
    } else {
      console.log("Canner: Backend returned error:", response.statusText);
    }
  } catch (error) {
    console.log("Canner: Backend not available, saving locally. Error:", error);
  }

  // Fallback to Chrome storage
  try {
    console.log("Canner: Saving to Chrome local storage");
    const result = await chrome.storage.local.get(["responses"]);
    const responses = result.responses || [];
    
    const newResponse = {
      id: Date.now().toString(),
      ...responseData,
      tags: Array.isArray(responseData.tags) ? responseData.tags : [responseData.tags].filter(Boolean),
      created_at: timestamp,
    };
    
    responses.push(newResponse);
    await chrome.storage.local.set({ responses });
    console.log("Canner: Saved to local storage successfully", newResponse);
    showToast("✅ Response saved locally!");
  } catch (err) {
    console.error("Canner: Save error:", err);
    showToast("❌ Failed to save response");
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// SPA navigation handling for LinkedIn and Twitter/X
{
  const host = window.location.hostname;
  const isLinkedInHost = host.includes("linkedin");
  const isTwitterHost = host.includes("twitter") || host.includes("x.com");

  if (isLinkedInHost || isTwitterHost) {
    console.log("Canner: Social host detected - adding SPA handlers for", host);

    let currentUrl = location.href;
    setInterval(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        console.log("Canner: URL changed, re-initializing...");
        setTimeout(() => {
          init();
        }, 1200);
      }
    }, 1000);

    window.addEventListener("popstate", () => {
      setTimeout(init, 1000);
    });

    // Additional periodic scan for new inputs (covers dynamically loaded DMs/replies)
    setInterval(() => {
      addMessageHelpers();
      addConnectionHelpers();
    }, 3000);
  }
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "insertResponse") {
    const activeElement = document.activeElement as HTMLElement;
    if (
      activeElement &&
      activeElement.getAttribute("contenteditable") === "true"
    ) {
      insertText(activeElement, message.content);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No active input box" });
    }
  }
  return true;
});
