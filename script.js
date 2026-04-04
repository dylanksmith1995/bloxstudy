/* ============================================================
   BloxStudy — script.js (Shared across all pages)
   ============================================================ */

// ── Mobile Nav ──────────────────────────────────────────────
const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });

  // Close menu when a link inside is clicked
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });
}

// ── Toast Notification ──────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast toast-${type} show`;

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

// ── Animate Progress Bars ────────────────────────────────────
function animateProgressBars() {
  document.querySelectorAll('.progress-fill[data-width]').forEach(bar => {
    const target = bar.getAttribute('data-width');
    bar.style.width = '0%';
    requestAnimationFrame(() => {
      setTimeout(() => { bar.style.width = target + '%'; }, 200);
    });
  });
}

// ── Smooth Scroll for anchor links ──────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Intersection Observer — fade cards in on scroll ──────────
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.card, .pricing-card, .stat-card').forEach(el => {
  el.style.opacity    = '0';
  el.style.transform  = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// ── Helper: fake async delay (remove when real API is in place) ──
function fakeDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  animateProgressBars();
});


/* ============================================================
   AWS INTEGRATION STUBS
   Replace these with real AWS SDK / API Gateway calls.
   See AWS_SETUP.md for full setup instructions.
   ============================================================ */

const API_BASE = 'https://YOUR_API_GATEWAY_URL/prod'; // ← replace after AWS setup

const Auth = {
  /**
   * Sign in via AWS Cognito
   * @param {string} email
   * @param {string} password
   */
  async signIn(email, password) {
    // TODO: Use amazon-cognito-identity-js or Amplify Auth
    // import { CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';
    console.log('[Auth] signIn called', email);
    return fakeDelay(1000);
  },

  /**
   * Register a new parent account
   */
  async signUp(email, password, firstName, lastName) {
    console.log('[Auth] signUp called', email);
    return fakeDelay(1000);
  },

  /**
   * Sign out the current user
   */
  async signOut() {
    console.log('[Auth] signOut called');
    window.location.href = 'index.html';
  },

  /**
   * Get the currently authenticated user
   */
  async getCurrentUser() {
    console.log('[Auth] getCurrentUser called');
    return null; // return Cognito user object when real
  }
};

const API = {
  /**
   * Create a Stripe Checkout session via Lambda
   * @param {string} plan — 'starter' | 'family' | 'premium'
   */
  async createCheckoutSession(plan) {
    console.log('[API] createCheckoutSession', plan);
    // Real implementation:
    // const res = await fetch(`${API_BASE}/checkout`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    //   body: JSON.stringify({ plan })
    // });
    // const { url } = await res.json();
    // window.location.href = url; // redirect to Stripe Checkout
    return fakeDelay(1000);
  },

  /**
   * Fetch user + kids progress from DynamoDB via Lambda
   */
  async getProgress(userId) {
    console.log('[API] getProgress', userId);
    // const res = await fetch(`${API_BASE}/progress/${userId}`, {
    //   headers: { Authorization: `Bearer ${token}` }
    // });
    // return res.json();
    return fakeDelay(500);
  },

  /**
   * Log a game session (called after kid finishes a game)
   */
  async logGameSession(kidId, gameName, score, subject) {
    console.log('[API] logGameSession', kidId, gameName, score);
    // await fetch(`${API_BASE}/sessions`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    //   body: JSON.stringify({ kidId, gameName, score, subject, timestamp: Date.now() })
    // });
    return fakeDelay(400);
  }
};
