// Text Formatter Utility for LinkedIn Unicode Text Formatting
// Converts regular text to Unicode bold, italic, and bold-italic variants

// Unicode character mappings for mathematical alphanumeric symbols
const UNICODE_MAPS = {
  bold: {
    // Uppercase A-Z (𝐀-𝐙)
    upper: Array.from({ length: 26 }, (_, i) => String.fromCodePoint(0x1d400 + i)),
    // Lowercase a-z (𝐚-𝐳)
    lower: Array.from({ length: 26 }, (_, i) => String.fromCodePoint(0x1d41a + i)),
    // Numbers 0-9 (𝟎-𝟗)
    numbers: Array.from({ length: 10 }, (_, i) => String.fromCodePoint(0x1d7ce + i)),
  },
  italic: {
    // Uppercase A-Z (𝐴-𝑍)
    upper: Array.from({ length: 26 }, (_, i) => String.fromCodePoint(0x1d434 + i)),
    // Lowercase a-z (𝑎-𝑧) - note: 'h' has special handling
    lower: Array.from({ length: 26 }, (_, i) => {
      if (i === 7) return 'ℎ'; // Special case for 'h'
      return String.fromCodePoint(0x1d44e + i);
    }),
    // Numbers use regular digits in italic context
    numbers: Array.from({ length: 10 }, (_, i) => String(i)),
  },
  boldItalic: {
    // Uppercase A-Z (𝑨-𝒁)
    upper: Array.from({ length: 26 }, (_, i) => String.fromCodePoint(0x1d468 + i)),
    // Lowercase a-z (𝒂-𝒛)
    lower: Array.from({ length: 26 }, (_, i) => String.fromCodePoint(0x1d482 + i)),
    // Numbers 0-9 (use bold numbers)
    numbers: Array.from({ length: 10 }, (_, i) => String.fromCodePoint(0x1d7ce + i)),
  },
};

// Regular character sets
const REGULAR = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
};

/**
 * Transform text to Unicode bold
 */
export function toBold(text: string): string {
  return transformText(text, UNICODE_MAPS.bold);
}

/**
 * Transform text to Unicode italic
 */
export function toItalic(text: string): string {
  return transformText(text, UNICODE_MAPS.italic);
}

/**
 * Transform text to Unicode bold italic
 */
export function toBoldItalic(text: string): string {
  return transformText(text, UNICODE_MAPS.boldItalic);
}

/**
 * Check if text contains Unicode formatting
 */
export function hasFormatting(text: string): boolean {
  // Check if any character is in the mathematical alphanumeric symbols range
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code && code >= 0x1d400 && code <= 0x1d7ff) {
      return true;
    }
  }
  return false;
}

/**
 * Remove all Unicode formatting and return to regular text
 */
export function toRegular(text: string): string {
  let result = '';

  for (const char of text) {
    const code = char.codePointAt(0);
    if (!code) {
      result += char;
      continue;
    }

    // Check if character is in mathematical alphanumeric symbols range
    if (code >= 0x1d400 && code <= 0x1d7ff) {
      // Try to convert back to regular character
      const converted = unicodeToRegular(char);
      result += converted || char;
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Core transformation function
 */
function transformText(text: string, mapping: typeof UNICODE_MAPS.bold): string {
  let result = '';

  for (const char of text) {
    // Check uppercase letters
    const upperIndex = REGULAR.upper.indexOf(char);
    if (upperIndex !== -1) {
      result += mapping.upper[upperIndex];
      continue;
    }

    // Check lowercase letters
    const lowerIndex = REGULAR.lower.indexOf(char);
    if (lowerIndex !== -1) {
      result += mapping.lower[lowerIndex];
      continue;
    }

    // Check numbers
    const numberIndex = REGULAR.numbers.indexOf(char);
    if (numberIndex !== -1) {
      result += mapping.numbers[numberIndex];
      continue;
    }

    // Keep other characters (spaces, punctuation, emojis) unchanged
    result += char;
  }

  return result;
}

/**
 * Convert Unicode formatted character back to regular
 */
function unicodeToRegular(char: string): string {
  const code = char.codePointAt(0);
  if (!code) return char;

  // Bold uppercase (𝐀-𝐙)
  if (code >= 0x1d400 && code <= 0x1d419) {
    return REGULAR.upper[code - 0x1d400];
  }
  // Bold lowercase (𝐚-𝐳)
  if (code >= 0x1d41a && code <= 0x1d433) {
    return REGULAR.lower[code - 0x1d41a];
  }
  // Bold numbers (𝟎-𝟗)
  if (code >= 0x1d7ce && code <= 0x1d7d7) {
    return REGULAR.numbers[code - 0x1d7ce];
  }

  // Italic uppercase (𝐴-𝑍)
  if (code >= 0x1d434 && code <= 0x1d44d) {
    return REGULAR.upper[code - 0x1d434];
  }
  // Italic lowercase (𝑎-𝑧)
  if (code >= 0x1d44e && code <= 0x1d467) {
    return REGULAR.lower[code - 0x1d44e];
  }
  // Special case: ℎ (italic h)
  if (char === 'ℎ') {
    return 'h';
  }

  // Bold italic uppercase (𝑨-𝒁)
  if (code >= 0x1d468 && code <= 0x1d481) {
    return REGULAR.upper[code - 0x1d468];
  }
  // Bold italic lowercase (𝒂-𝒛)
  if (code >= 0x1d482 && code <= 0x1d49b) {
    return REGULAR.lower[code - 0x1d482];
  }

  return char;
}

/**
 * Get formatting type of text
 */
export function getFormattingType(text: string): 'bold' | 'italic' | 'boldItalic' | 'regular' {
  if (!hasFormatting(text)) return 'regular';

  for (const char of text) {
    const code = char.codePointAt(0);
    if (!code) continue;

    // Check bold
    if ((code >= 0x1d400 && code <= 0x1d433) || (code >= 0x1d7ce && code <= 0x1d7d7)) {
      return 'bold';
    }
    // Check italic
    if ((code >= 0x1d434 && code <= 0x1d467) || char === 'ℎ') {
      return 'italic';
    }
    // Check bold italic
    if (code >= 0x1d468 && code <= 0x1d49b) {
      return 'boldItalic';
    }
  }

  return 'regular';
}
