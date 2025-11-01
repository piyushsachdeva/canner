// Canner content script — injects helper UI into social sites
console.log("Canner: Content script loaded");

const CONFIG = {
  API_URL: "http://localhost:5000",
  BUTTON_ICON: "💬",
  BUTTON_COLOR: "#0a66c2", // LinkedIn blue
};

// helps to track the last focused input
let lastFocusedInput: HTMLElement | null = null;

// this function track focused inputs
function trackFocusedInputs() {
  document.addEventListener('focusin', (_e) => {
    const target = _e.target as HTMLElement;
    if (isValidInputElement(target)) {
      lastFocusedInput = target;
      console.log("Canner: Tracked focused input", target);
    }
  }, true);
}

// Track injected elements to avoid duplicates
const injectedElements = new Set<string>();
const suggestionManagers: Record<string, InlineSuggestionManager> = {} as any;

// Simple Inline Suggestion Manager
class InlineSuggestionManager {
  element: HTMLElement;
  ghostElement: HTMLElement | null = null;
  currentSuggestion: any | null = null;
  isComposing: boolean = false;
  suppressedUntil: number = 0;

  // Event handlers
  private inputHandler: (e: Event) => void;
  private keydownHandler: (e: KeyboardEvent) => void;
  private blurHandler: () => void;
  private compositionStartHandler: () => void;
  private compositionEndHandler: () => void;

  constructor(element: HTMLElement) {
    this.element = element;

    // Bind event handlers
    this.inputHandler = this.handleInput.bind(this);
    this.keydownHandler = this.handleKeydown.bind(this);
    this.blurHandler = this.clearSuggestion.bind(this);
    this.compositionStartHandler = () => { this.isComposing = true; };
    this.compositionEndHandler = () => { this.isComposing = false; };

    // Attach event listeners
    this.element.addEventListener('input', this.inputHandler);
    this.element.addEventListener('keydown', this.keydownHandler);
    this.element.addEventListener('blur', this.blurHandler);
    this.element.addEventListener('compositionstart', this.compositionStartHandler);
    this.element.addEventListener('compositionend', this.compositionEndHandler);
  }

  destroy() {
    this.clearSuggestion();
    this.element.removeEventListener('input', this.inputHandler);
    this.element.removeEventListener('keydown', this.keydownHandler);
    this.element.removeEventListener('blur', this.blurHandler);
    this.element.removeEventListener('compositionstart', this.compositionStartHandler);
    this.element.removeEventListener('compositionend', this.compositionEndHandler);
  }

  private async handleInput(e: Event) {
    // Skip if suppressed
    if (Date.now() < this.suppressedUntil) {
      this.clearSuggestion();
      return;
    }

    // Skip if composing (IME input)
    if (this.isComposing) {
      return;
    }

    const currentText = this.getCurrentText();

    // Clear suggestion if text is too short or empty (fixes Twitter backspace issue)
    if (!currentText || currentText.length < 2) {
      this.clearSuggestion();
      return;
    }

    // Additional check for empty contenteditable elements
    if (this.element.getAttribute('contenteditable') === 'true') {
      const textContent = this.element.textContent?.trim() || '';
      if (textContent.length === 0) {
        this.clearSuggestion();
        return;
      }
    }

    try {
      const suggestions = await this.fetchSuggestions(currentText);
      if (suggestions.length === 0) {
        this.clearSuggestion();
        return;
      }

      // Find suggestions that start with the current text
      const matches = suggestions.filter(s => {
        const content = (s.content || s.title || "").toLowerCase();
        return content.startsWith(currentText.toLowerCase());
      });

      if (matches.length === 0) {
        this.clearSuggestion();
        return;
      }

      // Use the first match
      const suggestion = matches[0];
      this.showSuggestion(suggestion, currentText);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      this.clearSuggestion();
    }
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab' && this.currentSuggestion) {
      e.preventDefault();
      e.stopPropagation();
      this.acceptSuggestion();
    } else if (e.key === 'Escape' && this.currentSuggestion) {
      e.preventDefault();
      e.stopPropagation();
      this.clearSuggestion();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      // Clear suggestion on delete keys (fixes Twitter backspace issue)
      setTimeout(() => {
        const currentText = this.getCurrentText();
        if (!currentText || currentText.length < 2) {
          this.clearSuggestion();
        }
      }, 10);
    }
  }

  private getCurrentText(): string {
    if (this.element.getAttribute('contenteditable') === 'true') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return '';

      const range = selection.getRangeAt(0);
      const tempRange = range.cloneRange();
      tempRange.selectNodeContents(this.element);
      tempRange.setEnd(range.endContainer, range.endOffset);

      const text = tempRange.cloneContents().textContent || '';
      // Get the last word
      const words = text.trim().split(/\s+/);
      return words[words.length - 1] || '';
    } else if (this.element.tagName === 'TEXTAREA' || this.element.tagName === 'INPUT') {
      const input = this.element as HTMLInputElement | HTMLTextAreaElement;
      const cursorPos = input.selectionStart || 0;
      const text = input.value.substring(0, cursorPos);
      const words = text.trim().split(/\s+/);
      return words[words.length - 1] || '';
    }
    return '';
  }

  private async fetchSuggestions(prefix: string): Promise<any[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['responses'], (result) => {
        const responses = result.responses || [];
        const prefixLower = prefix.toLowerCase();

        const matches = responses.filter((response: any) => {
          const content = (response.content || response.title || "").toLowerCase();
          return content.startsWith(prefixLower);
        });

        resolve(matches);
      });
    });
  }

  private showSuggestion(suggestion: any, currentText: string) {
    this.currentSuggestion = suggestion;
    const fullText = suggestion.content || suggestion.title || '';

    // Detect platform for different display strategies
    const isLinkedIn = window.location.hostname.includes("linkedin");
    const isTwitter = window.location.hostname.includes("twitter") || window.location.hostname.includes("x.com");

    // Platform-specific suggestion display logic
    if (isTwitter) {
      // Twitter-specific logic: show only the remainder to avoid duplication
      let displayText = fullText;
      if (fullText.toLowerCase().startsWith(currentText.toLowerCase())) {
        displayText = fullText.substring(currentText.length);
      }

      // Truncate long suggestions for Twitter's smaller input box
      const maxLength = 70; // Optimized limit for Twitter's input box
      if (displayText.length > maxLength) {
        displayText = displayText.substring(0, maxLength - 3) + "...";
      }

      this.createGhostElement(displayText, currentText, fullText, 'twitter');
    } else {
      // LinkedIn and others: show the full text in gray behind
      this.createGhostElement(fullText, currentText, fullText, 'linkedin');
    }
  }

  private createGhostElement(text: string, _currentText: string, _fullText: string, platform: 'linkedin' | 'twitter') {
    this.clearGhostElement();

    if (this.element.getAttribute('contenteditable') === 'true') {
      const overlay = document.createElement('div');
      overlay.className = 'canner-ghost-suggestion';

      if (platform === 'linkedin') {
        // LinkedIn: show the full suggestion text with proper styling
        overlay.textContent = _fullText;
        overlay.style.cssText = `
          position: fixed;
          color: rgba(102, 112, 122, 0.3);
          pointer-events: none;
          z-index: 9999;
          white-space: pre-wrap;
          overflow-wrap: break-word;
          word-wrap: break-word;
          font-family: inherit;
          font-size: inherit;
          font-weight: inherit;
          line-height: inherit;
          max-width: calc(100% - 40px);
          display: block;
        `;
        this.positionLinkedInOverlay(overlay);
      } else {
        // Twitter: show only the remainder text at cursor position
        overlay.textContent = text;
        overlay.style.cssText = `
          position: fixed;
          color: rgba(102, 112, 122, 0.7);
          pointer-events: none;
          z-index: 10000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: inherit;
          font-size: inherit;
          font-weight: inherit;
          line-height: inherit;
          max-width: 300px;
          display: inline-block;
        `;
        this.positionTwitterOverlay(overlay);
      }

      this.ghostElement = overlay;
    }
  }

  private positionLinkedInOverlay(overlay: HTMLElement) {
    const containerRect = this.element.getBoundingClientRect();

    // Match the element's font styles exactly
    const computedStyle = window.getComputedStyle(this.element);
    overlay.style.fontFamily = computedStyle.fontFamily;
    overlay.style.fontSize = computedStyle.fontSize;
    overlay.style.fontWeight = computedStyle.fontWeight;
    overlay.style.lineHeight = computedStyle.lineHeight;

    // Position the overlay to fill the entire input area
    overlay.style.left = `${containerRect.left + 10}px`;
    overlay.style.top = `${containerRect.top + 10}px`;
    overlay.style.width = `${containerRect.width - 20}px`;

    document.body.appendChild(overlay);
  }

  private positionTwitterOverlay(overlay: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = this.element.getBoundingClientRect();

    // Match the element's font styles exactly
    const computedStyle = window.getComputedStyle(this.element);
    overlay.style.fontFamily = computedStyle.fontFamily;
    overlay.style.fontSize = computedStyle.fontSize;
    overlay.style.fontWeight = computedStyle.fontWeight;
    overlay.style.lineHeight = computedStyle.lineHeight;

    // Position exactly at cursor baseline for Twitter
    const left = rect.right + 1;
    let top = rect.top;

    // Calculate baseline alignment for perfect text alignment
    const fontSize = parseFloat(computedStyle.fontSize) || 16;
    const baselineOffset = fontSize * 0.85;
    top = rect.top + (rect.height - fontSize) / 2 + baselineOffset - fontSize;

    // Ensure the overlay stays within Twitter's small container boundaries
    const overlayWidth = overlay.offsetWidth;

    // Check if overlay exceeds container right boundary (important for Twitter)
    if (left + overlayWidth > containerRect.right - 5) {
      // Calculate available space and set reasonable max width
      const availableWidth = containerRect.right - left - 10;
      if (availableWidth > 100) {
        // Allow up to 250px but not more than available space
        const maxWidth = Math.min(250, availableWidth);
        overlay.style.maxWidth = `${maxWidth}px`;
      } else if (availableWidth > 50) {
        // Minimum usable space
        overlay.style.maxWidth = `${availableWidth}px`;
      } else {
        // If no space available, don't show the suggestion
        overlay.remove();
        return;
      }
    }

    // Apply final position
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;

    document.body.appendChild(overlay);
  }

  private clearGhostElement() {
    if (this.ghostElement) {
      this.ghostElement.remove();
      this.ghostElement = null;
    }
  }

  private clearSuggestion() {
    this.currentSuggestion = null;
    this.clearGhostElement();
  }

  private acceptSuggestion() {
    if (!this.currentSuggestion) return;

    // Suppress further input handling temporarily
    this.suppressedUntil = Date.now() + 500;

    const fullText = this.currentSuggestion.content || this.currentSuggestion.title || '';
    const currentText = this.getCurrentText();

    // Replace current text with full suggestion
    if (this.element.getAttribute('contenteditable') === 'true') {
      this.replaceInContentEditable(fullText, currentText);
    } else if (this.element.tagName === 'TEXTAREA' || this.element.tagName === 'INPUT') {
      this.replaceInInput(fullText, currentText);
    }

    this.clearSuggestion();
  }

  private replaceInContentEditable(fullText: string, _currentText: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Create a range to select the current text
    const tempRange = range.cloneRange();
    tempRange.selectNodeContents(this.element);
    tempRange.setEnd(range.endContainer, range.endOffset);

    const currentContent = tempRange.cloneContents().textContent || '';
    const lastSpaceIndex = currentContent.lastIndexOf(' ');
    const startIndex = lastSpaceIndex >= 0 ? lastSpaceIndex + 1 : 0;

    // Create range to replace the current word
    const replaceRange = document.createRange();
    replaceRange.setStart(this.element, 0);

    // Find the text node and offset for the start
    const walker = document.createTreeWalker(this.element, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startNode = null;
    let startOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const nodeLength = node.textContent?.length || 0;

      if (currentOffset + nodeLength >= startIndex) {
        startNode = node;
        startOffset = startIndex - currentOffset;
        break;
      }
      currentOffset += nodeLength;
    }

    if (startNode) {
      replaceRange.setStart(startNode, startOffset);
      replaceRange.setEnd(range.endContainer, range.endOffset);
      replaceRange.deleteContents();

      const textNode = document.createTextNode(fullText);
      replaceRange.insertNode(textNode);

      // Move cursor to end
      const newRange = document.createRange();
      newRange.setStartAfter(textNode);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      // Trigger events
      this.element.dispatchEvent(new InputEvent('input', { bubbles: true }));
      this.element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  private replaceInInput(fullText: string, _currentText: string) {
    const input = this.element as HTMLInputElement | HTMLTextAreaElement;
    const cursorPos = input.selectionStart || 0;
    const value = input.value;

    // Find the start of the current word
    let startPos = cursorPos - 1;
    while (startPos >= 0 && value[startPos] !== ' ' && value[startPos] !== '\n') {
      startPos--;
    }
    startPos++;

    const newValue = value.substring(0, startPos) + fullText + value.substring(cursorPos);
    input.value = newValue;

    // Set cursor position
    const newCursorPos = startPos + fullText.length;
    input.setSelectionRange(newCursorPos, newCursorPos);

    // Trigger events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

async function _fetchLocalSuggestions(prefix: string): Promise<any[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["responses"], (result) => {
      const list = result.responses || [];
      const q = prefix.toLowerCase();
      const matches = list
        .map((r: any) => ({
          r,
          score:
            (r.title && r.title.toLowerCase().startsWith(q) ? 100 : 0) +
            (r.content && r.content.toLowerCase().includes(q) ? 10 : 0) +
            (r.usage_count || 0),
        }))
        .filter((m: any) => m.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .map((m: any) => m.r);
      resolve(matches);
    });
  });
}

// Initialize the helper
function init() {
  console.log("Social Helper: Initializing for all platforms...");

  trackFocusedInputs(); // add to track focused input

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

  const selectors = [
    '[contenteditable="true"]',
    'textarea[placeholder*="comment" i]',
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="reply" i]',
    'textarea[placeholder*="What" i]',
    'textarea[data-testid="tweetTextarea_0"]',
    'div[data-testid="tweetTextarea_0"]',
    'div[data-testid="dmComposerTextInput"]',
    'div[data-testid="cellInnerDiv"] [contenteditable="true"]',
    'textarea[name="message"]',
    'input[type="text"][placeholder*="comment" i]',
    '[aria-label*="Tweet" i][contenteditable="true"]',
    '[aria-label*="Reply" i][contenteditable="true"]',
    '[data-text="true"][contenteditable="true"]',
    '.comments-comment-box [contenteditable="true"]',
    '.msg-form [contenteditable="true"]',
    '.share-creation-state [contenteditable="true"]',
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
      box.id = `sh-box-${Math.random().toString(36).substring(2, 11)}`;
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
      // Ensure a SuggestionManager is attached even if button was already present.
      // Resolve the actual editable inside this box (same logic as below).
      try {
        const resolvedEditable = ((): HTMLElement => {
          const el = box as HTMLElement;
          if (el.getAttribute && el.getAttribute("contenteditable") === "true") return el;
          const inner = el.querySelector?.('[contenteditable="true"], textarea, input[type="text"]') as HTMLElement | null;
          return inner || el;
        })();

        if (!resolvedEditable.id) {
          resolvedEditable.id = `${box.id}-editable`;
        }

        if (!suggestionManagers[resolvedEditable.id]) {
          suggestionManagers[resolvedEditable.id] = new InlineSuggestionManager(resolvedEditable as HTMLElement);
        }
      } catch (err) {
        console.error("Canner: Failed to attach SuggestionManager:", err);
      }
      injectedElements.add(box.id);
      return;
    }

    console.log(`Social Helper: Creating pen button for element ${index + 1}`);

    // Create minimized pen button
    const penButton = createPenButton(box as HTMLElement);
    positionPenButton(box as HTMLElement, penButton);

    // Resolve the actual editable element inside this box (Twitter often wraps the real
    // contenteditable inside additional divs). Attach the SuggestionManager to the
    // actual editable so insertion/replacement logic runs against the real editor.
    const resolvedEditable = ((): HTMLElement => {
      const el = box as HTMLElement;
      if (el.getAttribute && el.getAttribute("contenteditable") === "true") return el;
      const inner = el.querySelector?.('[contenteditable="true"], textarea, input[type="text"]') as HTMLElement | null;
      return inner || el;
    })();

    // Ensure resolvedEditable has an id we can use to track managers
    if (!resolvedEditable.id) {
      resolvedEditable.id = `${box.id}-editable`;
    }

    // Attach InlineSuggestionManager for inline completions to the resolved editable
    try {
      if (!suggestionManagers[resolvedEditable.id]) {
        suggestionManagers[resolvedEditable.id] = new InlineSuggestionManager(resolvedEditable as HTMLElement);
      }
    } catch (err) {
      console.error("Canner: Failed to create InlineSuggestionManager:", err);
    }

    injectedElements.add(box.id);
    console.log(
      `Social Helper: Pen button created and positioned for element ${index + 1
      }`
    );
  });
}

// Create a minimized pen button that expands on hover
function createPenButton(targetBox: HTMLElement): HTMLElement {
  const penContainer = document.createElement("div");
  penContainer.className = "social-helper-pen";

  // Detect platform for appropriate styling
  const _isLinkedIn =
    window.location.hostname.includes("linkedin") ||
    document.body.className.includes("linkedin") ||
    targetBox.closest('[class*="linkedin"]') !== null;

  const isTwitter =
    window.location.hostname.includes("twitter") ||
    window.location.hostname.includes("x.com") ||
    targetBox.closest("[data-testid]") !== null;

  if (_isLinkedIn) {
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

// Show menu with saved responses - Enhanced with popup-style design
async function showResponseMenu(targetBox: HTMLElement, button: HTMLElement) {
  // Remove existing menu if any
  const existingMenu = document.querySelector(".social-helper-menu");
  if (existingMenu) {
    existingMenu.remove();
    return;
  }

  // Load theme preference
  const result = await chrome.storage.sync.get(["theme"]);
  const isDarkMode = result.theme === "dark";

  // Create menu with popup-style design
  const menu = document.createElement("div");
  menu.className = "social-helper-menu";
  menu.setAttribute("data-theme", isDarkMode ? "dark" : "light");
  menu.innerHTML = `
    <div class="sh-menu-header">
      <div class="sh-menu-header-content">
        <div class="sh-menu-brand">
          <div class="sh-menu-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.9"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div class="sh-menu-title">
            <h3>Quick Responses</h3>
            <p class="sh-menu-subtitle">Loading responses...</p>
          </div>
        </div>
        <div class="sh-menu-actions">
          <button class="sh-theme-toggle" aria-label="Toggle dark mode">
            ${isDarkMode ? `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ` : `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            `}
          </button>
        </div>
      </div>
    </div>
  `;

//added first here
  menu.style.visibility = "hidden";
  menu.style.top = "-9999px";
  menu.style.left = "-9999px";
  document.body.appendChild(menu);

  // Add theme toggle functionality
  const themeToggle = menu.querySelector(".sh-theme-toggle") as HTMLButtonElement;
  let currentTheme = isDarkMode ? "dark" : "light";
  
  themeToggle?.addEventListener("click", async () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    menu.setAttribute("data-theme", currentTheme);
    
    // Save theme preference to storage
    await chrome.storage.sync.set({ theme: currentTheme });
    
    // Update theme toggle icon
    themeToggle.innerHTML = currentTheme === "dark" ? `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    ` : `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    `;
  });

  try {
    // Fetch responses from backend or local storage
    const responses = await fetchResponses();
    const subtitle = menu.querySelector(".sh-menu-subtitle") as HTMLElement;
    
    // Update subtitle with response count
    if (subtitle) {
      subtitle.textContent = `${responses.length} ${responses.length === 1 ? 'response' : 'responses'}`;
    }

    if (responses.length === 0) {
      // Add search and empty state
      const searchContainer = document.createElement("div");
      searchContainer.className = "sh-search-container";
      searchContainer.innerHTML = `
        <svg class="sh-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input class="sh-search" type="text" placeholder="Search by title, content, or tags..." disabled>
      `;
      menu.appendChild(searchContainer);

      const menuItems = document.createElement("div");
      menuItems.className = "sh-menu-items";
      menuItems.innerHTML = `
        <div class="sh-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          <h3>No saved responses</h3>
          <p>Create your first response to get started</p>
        </div>
      `;
      menu.appendChild(menuItems);
    } else {
      // Add search container
      const searchContainer = document.createElement("div");
      searchContainer.className = "sh-search-container";
      searchContainer.innerHTML = `
        <svg class="sh-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input class="sh-search" type="text" placeholder="Search by title, content, or tags...">
        <button class="sh-search-clear">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      `;
      menu.appendChild(searchContainer);

      // Add menu items container
      const menuItems = document.createElement("div");
      menuItems.className = "sh-menu-items";
      
      responses.forEach((response) => {
        const item = document.createElement("div");
        item.className = "sh-menu-item";
        item.setAttribute("data-id", response.id);
        
        const tags = Array.isArray(response.tags) ? response.tags : [];
        const tagElements = tags.slice(0, 2).map((tag: string) => 
          `<span class="sh-tag">${tag}</span>`
        ).join('');
        
        const moreTags = tags.length > 2 ? `<span class="sh-tag-more">+${tags.length - 2}</span>` : '';
        
        item.innerHTML = `
          <div class="sh-item-header">
            <h4 class="sh-item-title">${response.title}</h4>
            <div class="sh-item-tags">
              ${tagElements}
              ${moreTags}
            </div>
          </div>
          <p class="sh-item-preview">${response.content}</p>
          <div class="sh-item-actions">
            <button class="sh-btn-action sh-btn-insert" data-content="${response.content.replace(/"/g, '"')}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Insert
            </button>
            <button class="sh-btn-action sh-btn-edit" data-id="${response.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
                <path d="M14.06 4.94l3.75 3.75"/>
              </svg>
              Edit
            </button>
            <button class="sh-btn-action sh-btn-delete" data-id="${response.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          </div>
        `;
        
        menuItems.appendChild(item);
      });
      
      menu.appendChild(menuItems);

      // Add footer
      const footer = document.createElement("div");
      footer.className = "sh-menu-footer";
      footer.innerHTML = `
        <button class="sh-btn-create">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Response
        </button>
      `;
      menu.appendChild(footer);

      // Add search functionality
      const searchInput = menu.querySelector(".sh-search") as HTMLInputElement;
      const searchClear = menu.querySelector(".sh-search-clear") as HTMLButtonElement;
      
      searchInput?.addEventListener("input", (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        const items = menu.querySelectorAll(".sh-menu-item");
        let visibleCount = 0;
        
        items.forEach((item) => {
          const text = item.textContent?.toLowerCase() || "";
          const isVisible = text.includes(query);
          (item as HTMLElement).style.display = isVisible ? "block" : "none";
          if (isVisible) visibleCount++;
        });
        
        // Update subtitle with filtered count
        if (subtitle) {
          subtitle.textContent = `${visibleCount} ${visibleCount === 1 ? 'response' : 'responses'}${query ? ' filtered' : ''}`;
        }
        
        // Show/hide clear button
        if (searchClear) {
          searchClear.style.display = query ? "flex" : "none";
        }
      });

      searchClear?.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event('input'));
      });

      // Add click handlers for insert buttons
      menu.querySelectorAll(".sh-btn-insert").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const content = btn.getAttribute("data-content");
          if (content) {
            insertText(targetBox, content);
            menu.remove();
          }
        });
      });

      // Add click handlers for edit buttons
      menu.querySelectorAll(".sh-btn-edit").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const responseId = btn.getAttribute("data-id");
          if (responseId) {
            chrome.runtime.sendMessage({ action: "openPopup", editId: responseId });
            menu.remove();
          }
        });
      });

      // Add click handlers for delete buttons
      menu.querySelectorAll(".sh-btn-delete").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const responseId = btn.getAttribute("data-id");
          if (responseId && confirm("Delete this response permanently?")) {
            try {
              await deleteResponse(responseId);
              menu.remove();
              showResponseMenu(targetBox, button); // Refresh menu
            } catch (error) {
              console.error("Failed to delete response:", error);
              alert("Failed to delete response. Please try again.");
            }
          }
        });
      });

      // Handle create new button
      menu.querySelector(".sh-btn-create")?.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "openPopup" });
        menu.remove();
      });
    }
  } catch (error) {
    console.error("Canner: Error fetching responses:", error);
    menu.innerHTML = `
      <div class="sh-menu-header error">
        <div class="sh-menu-header-content">
          <div class="sh-menu-title">
            <h3>Error</h3>
            <p class="sh-menu-subtitle">Failed to load responses</p>
          </div>
        </div>
      </div>
      <div class="sh-menu-items">
        <div class="sh-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>Failed to load responses</h3>
          <p>Please check your connection and try again</p>
        </div>
      </div>
    `;
  }

    // === START: DYNAMIC POSITIONING FIX ===
  
  // 1. Append menu off-screen to measure its true dimensions
// Add force reflow here:
menu.offsetHeight;

  
  // Get its real dimensions (after it has rendered)
  const menuRect = menu.getBoundingClientRect();
  // Use 400 as a fallback height/width if it hasn't rendered correctly yet
  const menuHeight = menuRect.height > 50 ? menuRect.height : 400; 
  const menuWidth = menuRect.width > 50 ? menuRect.width : 400;

  // Get button and viewport dimensions
  const rect = button.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const padding = 10; // 10px padding from screen edges

  // 2. Calculate ideal 'top' position
  let top = rect.bottom + 5; // Default: below button

  // Check if it goes off the bottom
  if (top + menuHeight > viewportHeight - padding) {
    // Try placing it above the button
    top = rect.top - menuHeight - 5;
  }

  // Check if it *still* goes off the top (or was already off)
  if (top < padding) {
    // Pin it to the top of the viewport
    top = padding;
  }
  
  // 3. Calculate ideal 'left' position
  let left = rect.left; // Default: align with button's left

  // Check if it goes off the right
  if (left + menuWidth > viewportWidth - padding) {
    // Align to the right edge of the screen
    left = viewportWidth - menuWidth - padding;
  }

  // Check if it goes off the left
  if (left < padding) {
    // Pin it to the left of the viewport
    left = padding;
  }

  // 4. Apply final, calculated positions and make visible
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.style.visibility = "visible";

  // === END: DYNAMIC POSITIONING FIX ===

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

// Show create modal for new response
function _showCreateModal(targetBox: HTMLElement, button: HTMLElement, menu: HTMLElement) {
  // Create modal overlay
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "sh-modal-overlay";
  modalOverlay.setAttribute("data-theme", menu.getAttribute("data-theme") || "light");

  modalOverlay.innerHTML = `
    <div class="sh-modal">
      <div class="sh-modal-header">
        <h2>Create Response</h2>
        <button class="sh-modal-close" aria-label="Close modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="sh-modal-body">
        <div class="sh-form-group">
          <label for="sh-create-title" class="sh-form-label">Title</label>
          <input id="sh-create-title" class="sh-form-input" type="text" placeholder="e.g., Introduction message">
        </div>
        <div class="sh-form-group">
          <label for="sh-create-content" class="sh-form-label">Content</label>
          <textarea id="sh-create-content" class="sh-form-textarea" placeholder="Enter your response message..." rows="5"></textarea>
        </div>
        <div class="sh-form-group">
          <label for="sh-create-tags" class="sh-form-label">Tags</label>
          <input id="sh-create-tags" class="sh-form-input" type="text" placeholder="e.g., greeting, professional (comma separated)">
        </div>
      </div>
      <div class="sh-modal-footer">
        <button class="sh-btn-secondary" id="sh-cancel-create">Cancel</button>
        <button class="sh-btn-primary" id="sh-save-create">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
          </svg>
          Save Response
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Focus on title input
  setTimeout(() => {
    const titleInput = document.getElementById("sh-create-title") as HTMLInputElement;
    titleInput?.focus();
  }, 100);

  // Handle close
  const closeBtn = modalOverlay.querySelector(".sh-modal-close") as HTMLButtonElement;
  const cancelBtn = modalOverlay.querySelector("#sh-cancel-create") as HTMLButtonElement;

  const closeModal = () => {
    modalOverlay.remove();
  };

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  // Close on overlay click
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Handle save
  const saveBtn = modalOverlay.querySelector("#sh-save-create") as HTMLButtonElement;
  saveBtn.addEventListener("click", async () => {
    const title = (document.getElementById("sh-create-title") as HTMLInputElement).value.trim();
    const content = (document.getElementById("sh-create-content") as HTMLTextAreaElement).value.trim();
    const tags = (document.getElementById("sh-create-tags") as HTMLInputElement).value.trim();

    if (!title || !content) {
      alert("Please fill in title and content");
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-9 9"/>
          <path d="M9 20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-6"/>
        </svg>
        Saving...
      `;

      // Create new response
      await createResponse({
        title,
        content,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean)
      });

      // Show success message
      showToast("✅ Response created successfully!");
      
      // Close modal and menu
      closeModal();
      menu.remove();
      
      // Refresh menu to show new data
      setTimeout(() => {
        showResponseMenu(targetBox, button);
      }, 300);

    } catch (error) {
      console.error("Failed to create response:", error);
      alert("Failed to create response. Please try again.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
        </svg>
        Save Response
      `;
    }
  });
}

// Create response function
async function createResponse(data: any): Promise<void> {
  try {
    // Try backend first
    const response = await fetch(`${CONFIG.API_URL}/api/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      return;
    }
  } catch (error) {
    console.log("Canner: Backend not available for create, using local storage");
  }

  // Fallback to Chrome storage
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["responses"], (result) => {
      const responses = result.responses || [];
      const newResponse = {
        id: Date.now().toString(),
        ...data,
        created_at: new Date().toISOString()
      };
      
      responses.push(newResponse);
      
      chrome.storage.local.set({ responses }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  });
}

// Show edit modal for response
function _showEditModal(response: any, targetBox: HTMLElement, button: HTMLElement, menu: HTMLElement) {
  // Create modal overlay
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "sh-modal-overlay";
  modalOverlay.setAttribute("data-theme", menu.getAttribute("data-theme") || "light");

  const tags = Array.isArray(response.tags) ? response.tags.join(", ") : response.tags || "";

  modalOverlay.innerHTML = `
    <div class="sh-modal">
      <div class="sh-modal-header">
        <h2>Edit Response</h2>
        <button class="sh-modal-close" aria-label="Close modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="sh-modal-body">
        <div class="sh-form-group">
          <label for="sh-edit-title" class="sh-form-label">Title</label>
          <input id="sh-edit-title" class="sh-form-input" type="text" placeholder="e.g., Introduction message" value="${response.title || ""}">
        </div>
        <div class="sh-form-group">
          <label for="sh-edit-content" class="sh-form-label">Content</label>
          <textarea id="sh-edit-content" class="sh-form-textarea" placeholder="Enter your response message..." rows="5">${response.content || ""}</textarea>
        </div>
        <div class="sh-form-group">
          <label for="sh-edit-tags" class="sh-form-label">Tags</label>
          <input id="sh-edit-tags" class="sh-form-input" type="text" placeholder="e.g., greeting, professional (comma separated)" value="${tags}">
        </div>
      </div>
      <div class="sh-modal-footer">
        <button class="sh-btn-secondary" id="sh-cancel-edit">Cancel</button>
        <button class="sh-btn-primary" id="sh-save-edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
          </svg>
          Save Changes
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Focus on title input
  setTimeout(() => {
    const titleInput = document.getElementById("sh-edit-title") as HTMLInputElement;
    titleInput?.focus();
    titleInput?.select();
  }, 100);

  // Handle close
  const closeBtn = modalOverlay.querySelector(".sh-modal-close") as HTMLButtonElement;
  const cancelBtn = modalOverlay.querySelector("#sh-cancel-edit") as HTMLButtonElement;

  const closeModal = () => {
    modalOverlay.remove();
  };

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  // Close on overlay click
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Handle save
  const saveBtn = modalOverlay.querySelector("#sh-save-edit") as HTMLButtonElement;
  saveBtn.addEventListener("click", async () => {
    const title = (document.getElementById("sh-edit-title") as HTMLInputElement).value.trim();
    const content = (document.getElementById("sh-edit-content") as HTMLTextAreaElement).value.trim();
    const tags = (document.getElementById("sh-edit-tags") as HTMLInputElement).value.trim();

    if (!title || !content) {
      alert("Please fill in title and content");
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-9 9"/>
          <path d="M9 20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-6"/>
        </svg>
        Saving...
      `;

      // Update response
      await updateResponse(response.id, {
        title,
        content,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean)
      });

      // Show success message
      showToast("✅ Response updated successfully!");
      
      // Close modal and menu
      closeModal();
      menu.remove();
      
      // Refresh menu to show updated data
      setTimeout(() => {
        showResponseMenu(targetBox, button);
      }, 300);

    } catch (error) {
      console.error("Failed to update response:", error);
      alert("Failed to update response. Please try again.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
        </svg>
        Save Changes
      `;
    }
  });
}

// Update response function
async function updateResponse(id: string, data: Partial<any>): Promise<void> {
  try {
    // Try backend first
    const response = await fetch(`${CONFIG.API_URL}/api/responses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      return;
    }
  } catch (error) {
    console.log("Canner: Backend not available for update, using local storage");
  }

  // Fallback to Chrome storage
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["responses"], (result) => {
      const responses = result.responses || [];
      const index = responses.findIndex((r: any) => r.id === id);
      
      if (index !== -1) {
        responses[index] = { ...responses[index], ...data };
        
        chrome.storage.local.set({ responses }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error("Response not found"));
      }
    });
  });
}

// Add delete response function
async function deleteResponse(id: string): Promise<void> {
  try {
    // Try backend first
    const response = await fetch(`${CONFIG.API_URL}/api/responses/${id}`, {
      method: "DELETE",
    });
    
    if (response.ok) {
      return;
    }
  } catch (error) {
    console.log("Canner: Backend not available for delete, using local storage");
  }

  // Fallback to Chrome storage
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["responses"], (result) => {
      const responses = result.responses || [];
      const filteredResponses = responses.filter((r: any) => r.id !== id);
      
      chrome.storage.local.set({ responses: filteredResponses }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  });
}

// Fetch responses from backend or Chrome storage
async function fetchResponses(): Promise<any[]> {
  try {
    // Try backend first
    const response = await fetch(`${CONFIG.API_URL}/api/responses`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log("Canner: Backend not available, using local storage");
  }

  // Fallback to Chrome storage
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
      box.id = `lh-conn-${Math.random().toString(36).substring(2, 11)}`;
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
// Note: Currently unused but kept for future feature implementation
async function _showSaveDialog(text: string) {
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
      const response = await fetch(`${CONFIG.API_URL}/api/responses`, {
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
  const _isLinkedIn = window.location.hostname.includes("linkedin");
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
    const response = await fetch(`${CONFIG.API_URL}/api/responses`, {
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

// Helper function to check if element is valid input
function isValidInputElement(element: HTMLElement | null): boolean {
  if (!element) return false;

  const isContentEditable = element.getAttribute('contenteditable') === 'true';
  const tagName = element.tagName?.toLowerCase();
  const isInput = tagName === 'input' || tagName === 'textarea';

  return isContentEditable || isInput;
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle ping to check if script is loaded
  if (message.action === "ping") {
    sendResponse({ pong: true });
    return true;
  }

  if (message.action === "insertResponse") {
    console.log("Canner: Received insertResponse message", message);

    // Try to get the target element
    let targetElement = lastFocusedInput || document.activeElement as HTMLElement | null;

    // If no focused element found, search for visible input elements
    if (!targetElement || !isValidInputElement(targetElement)) {
      const possibleInputs = [
        ...Array.from(document.querySelectorAll('[contenteditable="true"]')),
        ...Array.from(document.querySelectorAll('textarea')),
        ...Array.from(document.querySelectorAll('input[type="text"]'))
      ].filter(el => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        const style = window.getComputedStyle(el as HTMLElement);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden';
      });

      targetElement = possibleInputs[0] as HTMLElement || null;
    }

    if (!targetElement || !isValidInputElement(targetElement)) {
      console.error("Canner: No valid input element found");
      sendResponse({
        success: false,
        error: "Please click in an input field first"
      });
      return true;
    }

    try {
      // Focus the element before inserting
      targetElement.focus();
      insertText(targetElement, message.content);
      console.log("Canner: Text inserted successfully");
      sendResponse({ success: true });
    } catch (error) {
      console.error("Canner: Error inserting text", error);
      sendResponse({ success: false, error: "Failed to insert text" });
    }

    return true;
  }

  return true;
});
