// Canner Content Script
// Injects helper buttons and features into LinkedIn pages
import { toBold, toItalic, toBoldItalic, toRegular, hasFormatting } from '../utils/textFormatter';
console.log("Canner: Content script loaded");

const CONFIG = {
  API_URL: "http://localhost:5000/api",
  BUTTON_ICON: "💬",
  BUTTON_COLOR: "#0a66c2", // LinkedIn blue
};

// helps to track the last focused input
let lastFocusedInput: HTMLElement | null = null;

// this function track focused inputs
function trackFocusedInputs() {
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
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
    let left = rect.right + 1;
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

async function fetchLocalSuggestions(prefix: string): Promise<any[]> {
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


   

    const composeButton = createComposeButton(box as HTMLElement);
positionComposeButton(box as HTMLElement, composeButton);

    injectedElements.add(box.id);
    console.log(
      `Social Helper: Pen button and formatting toolbar created for element ${
        index + 1

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
              <div class="lh-item-preview">${r.content.substring(
              0,
              60
            )}...</div>
              ${r.tags
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
function createComposeModal(targetBox: HTMLElement): HTMLElement {
  console.log('Canner: Opening compose modal for', targetBox);

  const modal = document.createElement('div');
  modal.className = 'canner-compose-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'compose-modal-title');

  modal.innerHTML = `
    <div class="canner-modal-overlay" aria-hidden="true"></div>
    
    <div class="canner-modal-container">
      <div class="canner-modal-header">
        <h3 id="compose-modal-title">📝 Compose Formatted Post</h3>
        <button class="canner-modal-close" title="Close (Esc)" aria-label="Close modal">✕</button>
      </div>
      
      <div class="canner-modal-toolbar">
        <button class="canner-format-btn" data-format="bold" title="Bold (Ctrl+B)" aria-label="Bold">
          <b>B</b>
        </button>
        <button class="canner-format-btn" data-format="italic" title="Italic (Ctrl+I)" aria-label="Italic">
          <i>I</i>
        </button>
        <button class="canner-format-btn" data-format="boldItalic" title="Bold Italic" aria-label="Bold Italic">
          <b><i>BI</i></b>
        </button>
        <button class="canner-format-btn" data-format="clear" title="Clear Formatting" aria-label="Clear formatting">
          <span style="text-decoration: line-through;">T</span>
        </button>
        <div class="canner-toolbar-divider"></div>
        <button class="canner-save-draft-btn" title="Save as draft" aria-label="Save draft">
          💾 Draft
        </button>
      </div>
      
      <div class="canner-modal-body">
        <div class="canner-editor-pane">
          <label for="compose-editor" class="canner-pane-label">✍️ Compose Your Message</label>
          <div 
            id="compose-editor"
            class="canner-format-editor" 
            contenteditable="true"
            role="textbox"
            aria-multiline="true"
            aria-label="Message editor"
            data-placeholder="Type your message here... Select text and use toolbar buttons to format."
          ></div>
          <div class="canner-editor-hint">
            💡 Tip: Select text and click format buttons, or use keyboard shortcuts
          </div>
        </div>
        
        <div class="canner-preview-pane">
          <label class="canner-pane-label">👁️ LinkedIn Preview</label>
          <div id="linkedin-preview" class="canner-linkedin-preview-content" aria-live="polite" aria-label="LinkedIn preview">
            <span class="canner-preview-placeholder">Your formatted text will appear here...</span>
          </div>
          <div class="canner-character-count">
            <span id="char-count">0</span> characters
            <span id="word-count" style="margin-left: 12px;">0</span> words
          </div>
        </div>
      </div>
      
      <div class="canner-modal-footer">
        <button class="canner-btn-secondary canner-cancel-btn">Cancel</button>
        <button class="canner-btn-primary canner-insert-btn">Insert to LinkedIn →</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  const editorElement = modal.querySelector('#compose-editor') as HTMLElement;
  const previewElement = modal.querySelector('#linkedin-preview') as HTMLElement;
  const charCountElement = modal.querySelector('#char-count') as HTMLElement;
  const wordCountElement = modal.querySelector('#word-count') as HTMLElement;
  const insertBtn = modal.querySelector('.canner-insert-btn') as HTMLButtonElement;
  const cancelBtn = modal.querySelector('.canner-cancel-btn') as HTMLButtonElement;
  const closeBtn = modal.querySelector('.canner-modal-close') as HTMLButtonElement;
  const overlay = modal.querySelector('.canner-modal-overlay') as HTMLElement;

  setTimeout(() => editorElement.focus(), 100);

  function updatePreview() {
    const plainText = editorElement.innerText || '';
    
    if (!plainText.trim()) {
      previewElement.innerHTML = '<span class="canner-preview-placeholder">Your formatted text will appear here...</span>';
      charCountElement.textContent = '0';
      wordCountElement.textContent = '0';
      return;
    }

    const linkedInText = convertHTMLToLinkedInFormat(editorElement);
    previewElement.innerText = linkedInText;
    charCountElement.textContent = linkedInText.length.toString();
    
    const wordCount = plainText.trim().split(/\s+/).filter(w => w.length > 0).length;
    wordCountElement.textContent = wordCount.toString();
  }

  editorElement.addEventListener('input', updatePreview);
  editorElement.addEventListener('keyup', updatePreview);

  function applyModalFormatting(formatType: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    if (!editorElement.contains(range.commonAncestorContainer)) {
      console.log('Canner: Selection not in editor');
      return;
    }

    const selectedText = range.toString();
    if (!selectedText) {
      console.log('Canner: No text selected');
      return;
    }

    if (formatType === 'clear') {
      const textNode = document.createTextNode(selectedText);
      range.deleteContents();
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      updatePreview();
      return;
    }

    let wrapper: HTMLElement;
    
    switch (formatType) {
      case 'bold':
        wrapper = document.createElement('b');
        break;
      case 'italic':
        wrapper = document.createElement('i');
        break;
      case 'boldItalic':
        const b = document.createElement('b');
        const i = document.createElement('i');
        b.appendChild(i);
        wrapper = b;
        break;
      default:
        return;
    }

    try {
      range.surroundContents(wrapper);
      range.setStartAfter(wrapper);
      range.setEndAfter(wrapper);
      selection.removeAllRanges();
      selection.addRange(range);
      updatePreview();
    } catch (error) {
      console.error('Canner: Error applying format:', error);
      const contents = range.extractContents();
      wrapper.appendChild(contents);
      range.insertNode(wrapper);
      updatePreview();
    }
  }

  function convertHTMLToLinkedInFormat(element: HTMLElement): string {
    let result = '';
    
    function processNode(node: Node): void {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        
        let text = '';
        for (const child of Array.from(node.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            text += child.textContent || '';
          }
        }
        
        if ((tagName === 'b' || tagName === 'strong' || tagName === 'i' || tagName === 'em') && text) {
          const parentBold = el.parentElement?.closest('b, strong') !== null;
          const parentItalic = el.parentElement?.closest('i, em') !== null;
          
          const effectiveBold = (tagName === 'b' || tagName === 'strong') || parentBold;
          const effectiveItalic = (tagName === 'i' || tagName === 'em') || parentItalic;
          
          if (effectiveBold && effectiveItalic) {
            result += toBoldItalic(text);
          } else if (effectiveBold) {
            result += toBold(text);
          } else if (effectiveItalic) {
            result += toItalic(text);
          } else {
            result += text;
          }
        } else {
          for (const child of Array.from(node.childNodes)) {
            processNode(child);
          }
        }
      }
    }
    
    processNode(element);
    return result;
  }

  modal.querySelectorAll('.canner-format-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const format = (btn as HTMLElement).getAttribute('data-format');
      if (format) {
        applyModalFormatting(format);
        editorElement.focus();
      }
    });
  });

  editorElement.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      applyModalFormatting('bold');
    } else if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      applyModalFormatting('italic');
    } else if (e.ctrlKey && e.shiftKey && e.key === 'B') {
      e.preventDefault();
      applyModalFormatting('boldItalic');
    } else if (e.key === 'Escape') {
      closeModal();
    }
  });

  function closeModal() {
    document.body.style.overflow = '';
    modal.classList.add('canner-modal-closing');
    setTimeout(() => modal.remove(), 200);
  }

  insertBtn.addEventListener('click', () => {
    const linkedInText = convertHTMLToLinkedInFormat(editorElement);
    
    if (!linkedInText.trim()) {
      alert('Please enter some text before inserting.');
      return;
    }
    
    insertText(targetBox, linkedInText);
    closeModal();
    showToast('✅ Text inserted to LinkedIn!');
  });

  cancelBtn.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

  const saveDraftBtn = modal.querySelector('.canner-save-draft-btn');
  saveDraftBtn?.addEventListener('click', async () => {
    const plainText = editorElement.innerText || '';
    if (!plainText.trim()) {
      showToast('⚠️ Nothing to save');
      return;
    }
    
    await saveResponseDirectly(plainText);
    showToast('✅ Saved as draft!');
  });

  modal.querySelector('.canner-modal-container')?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  return modal;
}

function createComposeButton(targetBox: HTMLElement): HTMLElement {
  const composeBtn = document.createElement('div');
  composeBtn.className = 'social-helper-compose';
  
  composeBtn.innerHTML = `
    <div class="compose-icon">📝</div>
    <div class="compose-tooltip">Compose with Formatting</div>
  `;
  
  composeBtn.title = 'Compose with formatting (Ctrl+Shift+E)';
  
  composeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    createComposeModal(targetBox);
  });
  
  let hoverTimeout: number;
  composeBtn.addEventListener('mouseenter', () => {
    clearTimeout(hoverTimeout);
    composeBtn.classList.add('compose-hover');
  });
  
  composeBtn.addEventListener('mouseleave', () => {
    hoverTimeout = window.setTimeout(() => {
      composeBtn.classList.remove('compose-hover');
    }, 200);
  });
  
  return composeBtn;
}

function positionComposeButton(
  inputElement: HTMLElement,
  composeBtn: HTMLElement
): void {
  document.body.appendChild(composeBtn);
  
  let isVisible = false;
  let showTimeout: number;
  let hideTimeout: number;
  
  const updatePosition = () => {
    const rect = inputElement.getBoundingClientRect();
    
    if (rect.width === 0 || rect.height === 0) {
      hideButton();
      return;
    }
    
    let top = rect.bottom - 45;
    let right = window.innerWidth - rect.right + 54;
    
    if (rect.height > 60) {
      top = rect.bottom - 50;
      right = window.innerWidth - rect.right + 58;
    }
    
    if (rect.bottom > window.innerHeight - 60) {
      top = rect.top - 50;
    }
    
    top = Math.max(8, Math.min(top, window.innerHeight - 60));
    right = Math.max(8, right);
    
    composeBtn.style.position = 'fixed';
    composeBtn.style.top = `${top}px`;
    composeBtn.style.right = `${right}px`;
    composeBtn.style.zIndex = '10000';
  };
  
  const showButton = () => {
    clearTimeout(hideTimeout);
    clearTimeout(showTimeout);
    
    showTimeout = window.setTimeout(() => {
      if (!isVisible) {
        updatePosition();
        composeBtn.classList.add('visible');
        isVisible = true;
      }
    }, 200);
  };
  
  const hideButton = () => {
    clearTimeout(showTimeout);
    clearTimeout(hideTimeout);
    
    hideTimeout = window.setTimeout(() => {
      if (isVisible && !composeBtn.matches(':hover') && !inputElement.matches(':focus')) {
        composeBtn.classList.remove('visible');
        isVisible = false;
      }
    }, 1500);
  };
  
  updatePosition();
  
  const updateHandler = () => {
    if (isVisible) updatePosition();
  };
  
  window.addEventListener('scroll', updateHandler, { passive: true });
  window.addEventListener('resize', updateHandler, { passive: true });
  
  inputElement.addEventListener('focus', showButton);
  inputElement.addEventListener('blur', hideButton);
  inputElement.addEventListener('input', showButton);
  inputElement.addEventListener('mouseenter', showButton);
  inputElement.addEventListener('mouseleave', hideButton);
  
  composeBtn.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
  composeBtn.addEventListener('mouseleave', hideButton);
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node === inputElement || (node as HTMLElement)?.contains?.(inputElement)) {
          clearTimeout(showTimeout);
          clearTimeout(hideTimeout);
          window.removeEventListener('scroll', updateHandler);
          window.removeEventListener('resize', updateHandler);
          composeBtn.remove();
          observer.disconnect();
        }
      });
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================
// Initialize when DOM is ready
// ============================================
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

