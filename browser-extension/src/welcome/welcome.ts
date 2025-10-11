// Enhanced Professional Welcome Page Script

console.log("Canner Welcome Page Loaded - Enhanced Professional Edition");

// DOM Elements
const nav = document.getElementById('mainNav') as HTMLElement;
const progressBar = document.getElementById('progressBar') as HTMLElement;
const navLinks = document.querySelectorAll('.nav-link');

// Close button functionality
const closeBtn = document.getElementById("closeBtn");
if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    window.close();
  });
}

// Track page view with enhanced analytics
chrome.storage.local.set({
  welcomePageViewed: true,
  welcomePageViewedAt: new Date().toISOString(),
  welcomePageVersion: '3.0-enhanced-navbar',
  userAgent: navigator.userAgent,
  language: navigator.language,
  platform: navigator.platform,
  screenResolution: `${screen.width}x${screen.height}`
});

// Footer: populate current year
const yearEl = document.getElementById('currentYear');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear().toString();
}

// Smooth scroll navigation
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = (link as HTMLAnchorElement).getAttribute('href')?.substring(1);
    if (targetId) {
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        const offsetTop = targetElement.offsetTop - 80; // Account for fixed nav
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    }
  });
});

// Active navigation highlighting
const updateActiveNavLink = () => {
  const scrollPosition = window.scrollY + 100;

  navLinks.forEach(link => {
    const targetId = (link as HTMLAnchorElement).getAttribute('href')?.substring(1);
    if (targetId) {
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        const offsetTop = targetElement.offsetTop;
        const offsetBottom = offsetTop + targetElement.offsetHeight;

        if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      }
    }
  });
};

// Progress bar functionality
const updateProgressBar = () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const scrollPercent = (scrollTop / docHeight) * 100;
  progressBar.style.width = Math.min(scrollPercent, 100) + '%';
};

// Navbar scroll effect
const updateNavbarOnScroll = () => {
  if (window.scrollY > 50) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
};

// Intersection Observer for animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate-in');
    }
  });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.feature-card, .step, .testimonial-card').forEach(card => {
  observer.observe(card);
});

// Scroll event listeners
window.addEventListener('scroll', () => {
  updateActiveNavLink();
  updateProgressBar();
  updateNavbarOnScroll();
});

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  updateActiveNavLink();
  updateProgressBar();
  updateNavbarOnScroll();
});

// Enhanced interaction tracking
const trackInteraction = (action: string, element: string, details?: any) => {
  console.log(`User interaction: ${action} on ${element}`, details);
  // In production, this would send to analytics service
};

// Track navigation clicks
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    const section = (link as HTMLElement).dataset.section;
    trackInteraction('click', 'nav_link', { section });
  });
});

// Track CTA clicks
document.querySelectorAll('.btn, .nav-cta').forEach(element => {
  element.addEventListener('click', () => {
    const action = element.classList.contains('btn-primary') ? 'cta_primary' :
                   element.classList.contains('btn-secondary') ? 'cta_secondary' :
                   element.classList.contains('nav-cta') ? 'nav_cta' : 'button';
    const text = element.textContent?.trim();
    trackInteraction('click', action, { text });
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // ESC to close
  if (e.key === 'Escape') {
    window.close();
  }

  // Number keys for quick navigation (1-2 for sections)
  if (e.key >= '1' && e.key <= '2' && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    const sections = ['features', 'how-it-works'];
    const targetId = sections[parseInt(e.key) - 1];
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      const offsetTop = targetElement.offsetTop - 80;
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
  }
});

// Performance monitoring
const loadTime = performance.now();
console.log(`Page loaded in ${loadTime.toFixed(2)}ms`);

// Service worker ready check
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(() => {
    console.log('Service worker ready');
  });
}

// Add loading states for better UX
const addLoadingStates = () => {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.addEventListener('load', () => {
      img.classList.add('loaded');
    });
  });
};

addLoadingStates();

// Animated Demo Workflow
const animatedCursor = document.getElementById('animatedCursor') as HTMLElement;
const cannerButton = document.getElementById('cannerButton') as HTMLElement;
const typingMessage = document.getElementById('typingMessage') as HTMLElement;
const typedText = document.getElementById('typedText') as HTMLElement;

const fullMessage = "Thank you for reaching out! I'm very interested in learning more about the opportunities at The CloudOps Community. Could we schedule a quick call next week?";

let animationRunning = false;
let currentAnimationTimeouts: number[] = [];

const clearAllAnimationTimeouts = () => {
  if (currentAnimationTimeouts.length === 0) return;
  currentAnimationTimeouts.forEach(id => window.clearTimeout(id));
  currentAnimationTimeouts = [];
};

const animateWorkflow = () => {
  if (animationRunning) return;
  animationRunning = true;

  // Reset state
  if (typedText) typedText.textContent = '';
  if (typingMessage) typingMessage.style.opacity = '0';
  if (animatedCursor) animatedCursor.classList.remove('active');

  // Step 1: Show cursor after delay
  const t1 = window.setTimeout(() => {
    if (animatedCursor) {
      animatedCursor.classList.add('active');
      // Move cursor to button position
      moveCursorToButton();
    }
  }, 300);
  currentAnimationTimeouts.push(t1);

  // Step 2: Click the button (after cursor reaches it)
  const t2 = window.setTimeout(() => {
    if (cannerButton) {
      cannerButton.classList.add('animate-click');
      window.setTimeout(() => {
        cannerButton.classList.remove('animate-click');
      }, 300);
    }
  }, 1700);
  currentAnimationTimeouts.push(t2);

  // Step 3: Start typing animation (after button click completes)
  const t3 = window.setTimeout(() => {
    if (typingMessage) {
      typingMessage.style.opacity = '1';
    }
    typeText();
  }, 2200);
  currentAnimationTimeouts.push(t3);

  // Step 4: Hide cursor and reset
  const t4 = window.setTimeout(() => {
    if (animatedCursor) {
      animatedCursor.classList.remove('active');
    }
    animationRunning = false;
  }, 2200 + fullMessage.length * 30 + 1500);
  currentAnimationTimeouts.push(t4);
};

const moveCursorToButton = () => {
  if (!animatedCursor || !cannerButton) return;
  
  const mockupContainer = document.querySelector('.mockup-container') as HTMLElement;
  const buttonRect = cannerButton.getBoundingClientRect();
  const containerRect = mockupContainer.getBoundingClientRect();
  
  const targetX = buttonRect.left - containerRect.left + buttonRect.width / 2 - 12;
  const targetY = buttonRect.top - containerRect.top + buttonRect.height / 2 - 12;
  
  // Initial position (top left of mockup)
  animatedCursor.style.left = '20px';
  animatedCursor.style.top = '20px';
  
  // Animate to button
  window.setTimeout(() => {
    animatedCursor.style.transition = 'all 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
    animatedCursor.style.left = targetX + 'px';
    animatedCursor.style.top = targetY + 'px';
  }, 50);
};

const typeText = () => {
  if (!typedText) return;
  
  let charIndex = 0;
  const typeChar = () => {
    if (charIndex < fullMessage.length) {
      typedText.textContent = fullMessage.substring(0, charIndex + 1);
  charIndex++;
  const t = window.setTimeout(typeChar, 30);
  currentAnimationTimeouts.push(t);
    } else {
      // Add brief cursor blink at end
      typedText.classList.add('typing-cursor');
      window.setTimeout(() => {
        typedText.classList.remove('typing-cursor');
      }, 1500);
    }
  };
  typeChar();
};

// Start animation when hero section is visible
const heroObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !animationRunning) {
      // Start first animation after a delay
          window.setTimeout(() => {
            animateWorkflow();
          }, 500);
    }
  });
}, { threshold: 0.3 });

const heroSection = document.querySelector('.hero-visual');
if (heroSection) {
  heroObserver.observe(heroSection);
}

// Loop animation every 8 seconds
setInterval(() => {
  if (!animationRunning) {
    animateWorkflow();
  }
}, 8000);

// Restart animation when Quick Response button is clicked
if (cannerButton) {
  cannerButton.addEventListener('click', (e) => {
    e.preventDefault();
    // clear any running timeouts and stop current animation
    clearAllAnimationTimeouts();
    animationRunning = false;
    // reset visual state
    if (typedText) typedText.textContent = '';
    if (typingMessage) typingMessage.style.opacity = '0';
    if (animatedCursor) animatedCursor.classList.remove('active');
    // start animation immediately
    animateWorkflow();
  });
}

// Interactive steps: click or keyboard to reveal hint and scroll to target
const steps = document.querySelectorAll('.step[role="button"]');
steps.forEach(step => {
  const el = step as HTMLElement;
  el.addEventListener('click', () => {
    const target = el.dataset.target;
    if (target) {
      const targetEl = document.querySelector(target) as HTMLElement;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    // toggle pressed state briefly to show hint
    el.setAttribute('aria-pressed', 'true');
    setTimeout(() => el.setAttribute('aria-pressed', 'false'), 2000);
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
});
