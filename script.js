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
   AWS Cognito Authentication (direct REST API — no SDK needed)
   ============================================================ */

const API_BASE = 'https://z4ecr949gc.execute-api.us-east-1.amazonaws.com';

const _COGNITO_ENDPOINT = 'https://cognito-idp.us-east-1.amazonaws.com/';
const _COGNITO_CLIENT_ID = '7cv8rlf4d76kajlsfcf4stnp0b';

async function _cognitoRequest(target, body) {
  const res = await fetch(_COGNITO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`
    },
    body: JSON.stringify({ ClientId: _COGNITO_CLIENT_ID, ...body })
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || 'Cognito error');
    err.code = (data.__type || '').replace('com.amazonaws.cognito.identity.idp.model.', '');
    throw err;
  }
  return data;
}

const Auth = {
  // Register a new parent account
  async signUp(email, password) {
    return _cognitoRequest('SignUp', {
      Username: email,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }]
    });
  },

  // Confirm the 6-digit email verification code
  async confirmSignUp(email, code) {
    return _cognitoRequest('ConfirmSignUp', { Username: email, ConfirmationCode: code });
  },

  // Sign in and return tokens
  async signIn(email, password) {
    const data = await _cognitoRequest('InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: email, PASSWORD: password }
    });
    // Store tokens in sessionStorage
    const tokens = data.AuthenticationResult;
    sessionStorage.setItem('bs_id_token',      tokens.IdToken);
    sessionStorage.setItem('bs_access_token',  tokens.AccessToken);
    sessionStorage.setItem('bs_refresh_token', tokens.RefreshToken);
    // Decode sub (userId) from IdToken
    const payload = JSON.parse(atob(tokens.IdToken.split('.')[1]));
    sessionStorage.setItem('bs_user_id', payload.sub);
    sessionStorage.setItem('bs_email',   payload.email || email);
    return tokens;
  },

  // Sign out and redirect home
  signOut() {
    sessionStorage.clear();
    window.location.href = 'index.html';
  },

  // Returns user info if logged in, or null
  getCurrentUser() {
    const token = sessionStorage.getItem('bs_id_token');
    if (!token) return Promise.resolve(null);
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Check token hasn't expired
      if (payload.exp * 1000 < Date.now()) {
        sessionStorage.clear();
        return Promise.resolve(null);
      }
      return Promise.resolve({ userId: payload.sub, email: payload.email });
    } catch {
      return Promise.resolve(null);
    }
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
