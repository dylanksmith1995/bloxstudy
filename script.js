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
   AWS Cognito Authentication
   ============================================================ */

const API_BASE = 'https://z4ecr949gc.execute-api.us-east-1.amazonaws.com';

// Cognito config — pool created lazily so the CDN library just needs to exist
// before any Auth method is called (not at script parse time).
const _COGNITO_CONFIG = {
  UserPoolId: 'us-east-1_f69hqs3Tl',
  ClientId:   '7cv8rlf4d76kajlsfcf4stnp0b'
};

const Auth = {
  _pool() {
    return new AmazonCognitoIdentity.CognitoUserPool(_COGNITO_CONFIG);
  },
  _user(email) {
    return new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: this._pool() });
  },

  // Sign in an existing parent account
  signIn(email, password) {
    return new Promise((resolve, reject) => {
      const details = new AmazonCognitoIdentity.AuthenticationDetails({ Username: email, Password: password });
      this._user(email).authenticateUser(details, {
        onSuccess: resolve,
        onFailure: reject,
        newPasswordRequired: () => reject({ code: 'NewPasswordRequired', message: 'Password change required.' })
      });
    });
  },

  // Register a new parent account; Cognito will send a verification email
  signUp(email, password, firstName, lastName) {
    return new Promise((resolve, reject) => {
      const attrs = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'given_name',  Value: firstName }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'family_name', Value: lastName  }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email',       Value: email     }),
      ];
      this._pool().signUp(email, password, attrs, null, (err, result) => {
        if (err) reject(err); else resolve(result);
      });
    });
  },

  // Confirm the email verification code Cognito sends after signUp
  confirmSignUp(email, code) {
    return new Promise((resolve, reject) => {
      this._user(email).confirmRegistration(code, true, (err, result) => {
        if (err) reject(err); else resolve(result);
      });
    });
  },

  // Sign out and redirect to home
  signOut() {
    const user = this._pool().getCurrentUser();
    if (user) user.signOut();
    window.location.href = 'index.html';
  },

  // Returns the logged-in CognitoUser or null
  getCurrentUser() {
    return new Promise((resolve) => {
      const user = this._pool().getCurrentUser();
      if (!user) { resolve(null); return; }
      user.getSession((err, session) => {
        resolve((!err && session && session.isValid()) ? user : null);
      });
    });
  }
};

const API = {
  /**
   * Create a Stripe Checkout session via Lambda
   * @param {string} plan — 'starter' | 'family' | 'premium'
   */
  async createCheckoutSession(userId, email, childCount) {
    const res = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, childCount })
    });
    if (!res.ok) throw new Error('Failed to create checkout session');
    const { url } = await res.json();
    window.location.href = url; // redirect to Stripe Checkout page
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
