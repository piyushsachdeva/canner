// Canner Content Script
// Injects helper buttons and features into LinkedIn pages
import { toBold, toItalic, toBoldItalic, toRegular, hasFormatting } from '../utils/textFormatter';

console.log("Canner: Content script loaded");

// Configuration
const CONFIG = {
  API_URL: "http://localhost:5000/api",
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

    // Add formatting toolbar
    const formattingToolbar = createFormattingToolbar(box as HTMLElement);
    positionFormattingToolbar(box as HTMLElement, formattingToolbar);

    injectedElements.add(box.id);
    console.log(
      `Social Helper: Pen button and formatting toolbar created for element ${
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
    }, 200);
  });

  return penContainer;
}

// Create formatting toolbar with B, I, BI, and Clear buttons
function createFormattingToolbar(targetBox: HTMLElement): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'canner-formatting-toolbar';
  
  toolbar.innerHTML = `
    <button class="format-btn format-bold" title="Bold (Ctrl+B)" data-format="bold">
      <strong>B</strong>
    </button>
    <button class="format-btn format-italic" title="Italic (Ctrl+I)" data-format="italic">
      <em>I</em>
    </button>
    <button class="format-btn format-bold-italic" title="Bold Italic" data-format="boldItalic">
      <strong><em>BI</em></strong>
    </button>
    <button class="format-btn format-clear" title="Clear Formatting" data-format="clear">
      <span>T</span>
    </button>
  `;

  // Add click handlers for each button
  toolbar.querySelectorAll('.format-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const format = (btn as HTMLElement).getAttribute('data-format');
      applyFormatting(targetBox, format as string);
    });
  });

  return toolbar;
}

// Apply formatting to selected text or entire content
function applyFormatting(box: HTMLElement, format: string) {
  const selection = window.getSelection();
  const selectedText = selection?.toString();

  // If text is selected, format only the selection
  if (selectedText && selectedText.length > 0) {
    formatSelectedText(box, format);
  } else {
    // Format entire content
    formatEntireContent(box, format);
  }

  // Trigger input event to update platform state
  box.dispatchEvent(new Event('input', { bubbles: true }));
}

// Format selected text within the input box
function formatSelectedText(box: HTMLElement, format: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const selectedText = range.toString();

  if (!selectedText) return;

  let formattedText: string;
  
  switch (format) {
    case 'bold':
      formattedText = toBold(selectedText);
      break;
    case 'italic':
      formattedText = toItalic(selectedText);
      break;
    case 'boldItalic':
      formattedText = toBoldItalic(selectedText);
      break;
    case 'clear':
      formattedText = toRegular(selectedText);
      break;
    default:
      return;
  }

  // For contenteditable elements
  if (box.getAttribute('contenteditable') === 'true') {
    range.deleteContents();
    const textNode = document.createTextNode(formattedText);
    range.insertNode(textNode);
    
    // Move cursor after inserted text
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
  } 
  // For textarea/input elements
  else if (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT') {
    const input = box as HTMLInputElement | HTMLTextAreaElement;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = input.value;
    
    input.value = 
      currentValue.substring(0, start) + 
      formattedText + 
      currentValue.substring(end);
    
    // Set cursor after formatted text
    const newPosition = start + formattedText.length;
    input.setSelectionRange(newPosition, newPosition);
  }
}

// Format entire content of the input box
function formatEntireContent(box: HTMLElement, format: string) {
  let currentText: string;
  
  // Get current text
  if (box.getAttribute('contenteditable') === 'true') {
    currentText = box.innerText || '';
  } else if (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT') {
    currentText = (box as HTMLInputElement | HTMLTextAreaElement).value || '';
  } else {
    return;
  }

  if (!currentText) return;

  let formattedText: string;
  
  switch (format) {
    case 'bold':
      formattedText = toBold(currentText);
      break;
    case 'italic':
      formattedText = toItalic(currentText);
      break;
    case 'boldItalic':
      formattedText = toBoldItalic(currentText);
      break;
    case 'clear':
      formattedText = toRegular(currentText);
      break;
    default:
      return;
  }

  // Set formatted text
  if (box.getAttribute('contenteditable') === 'true') {
    box.innerText = formattedText;
    
    // Move cursor to end
    setTimeout(() => {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(box);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, 10);
  } else if (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT') {
    const input = box as HTMLInputElement | HTMLTextAreaElement;
    const cursorPos = input.selectionStart || 0;
    input.value = formattedText;
    
    // Maintain cursor position (proportionally)
    const newPos = Math.min(cursorPos, formattedText.length);
    input.setSelectionRange(newPos, newPos);
  }
}

// Position the formatting toolbar relative to input
function positionFormattingToolbar(
  inputElement: HTMLElement,
  toolbar: HTMLElement
): void {
  document.body.appendChild(toolbar);

  let isVisible = false;
  let showTimeout: number;
  let hideTimeout: number;

  const updatePosition = () => {
    const rect = inputElement.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      hideToolbar();
      return;
    }

    // Position at bottom-left of input
    let top = rect.bottom + 5;
    let left = rect.left;

    // If not enough space below, position above
    if (rect.bottom > window.innerHeight - 50) {
      top = rect.top - 45;
    }

    // If not enough space on left, position on right
    if (left + 200 > window.innerWidth) {
      left = rect.right - 200;
    }

    // Ensure toolbar is visible
    top = Math.max(5, Math.min(top, window.innerHeight - 50));
    left = Math.max(5, left);

    toolbar.style.position = 'fixed';
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
    toolbar.style.zIndex = '10000';
  };

  const showToolbar = () => {
    clearTimeout(hideTimeout);
    clearTimeout(showTimeout);

    showTimeout = window.setTimeout(() => {
      if (!isVisible) {
        updatePosition();
        toolbar.classList.add('visible');
        isVisible = true;
      }
    }, 100);
  };

  const hideToolbar = () => {
    clearTimeout(showTimeout);
    clearTimeout(hideTimeout);

    hideTimeout = window.setTimeout(() => {
      if (isVisible && !toolbar.matches(':hover') && !inputElement.matches(':focus')) {
        toolbar.classList.remove('visible');
        isVisible = false;
      }
    }, 500);
  };

  updatePosition();

  // Update position on scroll/resize
  const updateHandler = () => {
    if (isVisible) updatePosition();
  };

  window.addEventListener('scroll', updateHandler, { passive: true });
  window.addEventListener('resize', updateHandler, { passive: true });

  // Show/hide based on input interaction
  inputElement.addEventListener('focus', showToolbar);
  inputElement.addEventListener('blur', hideToolbar);
  inputElement.addEventListener('mouseenter', showToolbar);
  inputElement.addEventListener('mouseleave', hideToolbar);

  toolbar.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
  toolbar.addEventListener('mouseleave', hideToolbar);

  // Clean up on element removal
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node === inputElement || (node as HTMLElement)?.contains?.(inputElement)) {
          clearTimeout(showTimeout);
          clearTimeout(hideTimeout);
          window.removeEventListener('scroll', updateHandler);
          window.removeEventListener('resize', updateHandler);
          toolbar.remove();
          observer.disconnect();
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
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
    let top = rect.bottom - 45;
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

  updatePosition();

  const updateHandler = () => {
    if (isVisible) {
      updatePosition();
    }
  };

  window.addEventListener("scroll", updateHandler, { passive: true });
  window.addEventListener("resize", updateHandler, { passive: true });

  inputElement.addEventListener("focus", showPenButton);
  inputElement.addEventListener("blur", hidePenButton);
  inputElement.addEventListener("input", showPenButton);
  inputElement.addEventListener("mouseenter", showPenButton);
  inputElement.addEventListener("mouseleave", hidePenButton);

  penButton.addEventListener("mouseenter", () => {
    clearTimeout(hideTimeout);
  });

  penButton.addEventListener("mouseleave", hidePenButton);

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
  const existingMenu = document.querySelector(".linkedin-helper-menu");
  if (existingMenu) {
    existingMenu.remove();
    return;
  }

  const menu = document.createElement("div");
  menu.className = "linkedin-helper-menu";
  menu.innerHTML = '<div class="lh-menu-header">Loading responses...</div>';

  const rect = button.getBoundingClientRect();
  const menuHeight = 400;
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;

  if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
    menu.style.top = `${rect.top - menuHeight - 10}px`;
  } else {
    menu.style.top = `${rect.bottom + 5}px`;
  }

  const menuWidth = 400;
  const spaceRight = window.innerWidth - rect.left;

  if (spaceRight < menuWidth) {
    menu.style.left = `${rect.right - menuWidth}px`;
  } else {
    menu.style.left = `${rect.left}px`;
  }

  document.body.appendChild(menu);

  try {
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
              <div class="lh-item-preview">${r.content.substring(0, 60)}...</div>
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
    const response = await fetch(`${CONFIG.API_URL}/api/responses`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log("Canner: Backend not available, using local storage");
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(["responses"], (result) => {
      resolve(result.responses || []);
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

  box.focus();

  if (box.getAttribute("contenteditable") === "true") {
    console.log("Social Helper: Inserting into contenteditable");

    box.innerHTML = "";
    box.innerText = text;

    box.dispatchEvent(new Event("input", { bubbles: true }));
    box.dispatchEvent(new Event("change", { bubbles: true }));
    box.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    box.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

    setTimeout(() => {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(box);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, 10);
  } else if (
    box.tagName === "TEXTAREA" ||
    (box.tagName === "INPUT" && (box as HTMLInputElement).type === "text")
  ) {
    console.log("Social Helper: Inserting into textarea/input");

    const inputElement = box as HTMLInputElement | HTMLTextAreaElement;

    inputElement.value = text;

    inputElement.dispatchEvent(new Event("input", { bubbles: true }));
    inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    inputElement.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    inputElement.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

    setTimeout(() => {
      inputElement.setSelectionRange(text.length, text.length);
    }, 10);
  } else {
    console.log("Social Helper: Using fallback insertion method");

    try {
      if ("innerText" in box) {
        (box as any).innerText = text;
      } else if ("textContent" in box) {
        (box as any).textContent = text;
      }

      if ("value" in box) {
        (box as any).value = text;
      }

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

    const rect = box.getBoundingClientRect();
    if (rect.width < 30 || rect.height < 15) {
      console.log(
        `Canner: Skipping connection element ${index + 1} - too small`
      );
      return;
    }

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
          const element = node as HTMLElement;

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

    // Ctrl+B for bold
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (
        activeElement.getAttribute('contenteditable') === 'true' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'INPUT'
      )) {
        applyFormatting(activeElement, 'bold');
      }
    }
    
    // Ctrl+I for italic
    if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (
        activeElement.getAttribute('contenteditable') === 'true' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'INPUT'
      )) {
        applyFormatting(activeElement, 'italic');
      }
    }
  });
}

// Text selection handler - show save button when text is selected
let saveButton: HTMLElement | null = null;

function addTextSelectionHandler() {
  document.addEventListener("mouseup", handleTextSelection);
  document.addEventListener("keyup", handleTextSelection);
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

  // Position near the selection (bottom right)
  saveButton.style.position = "fixed";
  saveButton.style.left = `${rect.right + 5}px`;
  saveButton.style.top = `${rect.bottom + 5}px`;
  saveButton.style.zIndex = "10001";

  document.body.appendChild(saveButton);

  // Handle save button click
  const btn = saveButton.querySelector(
    ".lh-save-selection-btn"
  ) as HTMLButtonElement;
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("Canner: Saving selected text:", selectedText);

    // Save directly without dialog
    await saveResponseDirectly(selectedText);

    if (saveButton) {
      saveButton.remove();
      saveButton = null;
    }
    // Clear selection
    selection?.removeAllRanges();
  });
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
      const response = await fetch(`${CONFIG.API_URL}/responses`, {
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

  // Generate auto title from first 50 chars
  const autoTitle = text.length > 50 ? text.substring(0, 47) + "..." : text;
  const timestamp = new Date().toISOString();

  const responseData = {
    title: autoTitle,
    content: text,
    tags: "",
    category: "other",
  };

  console.log("Canner: Attempting to save to backend:", CONFIG.API_URL);

  // Try to save to backend first
  try {
    const response = await fetch(`${CONFIG.API_URL}/responses`, {
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
    responses.push({
      id: Date.now(),
      ...responseData,
      created_at: timestamp,
    });
    await chrome.storage.local.set({ responses });
    console.log("Canner: Saved to local storage successfully");
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