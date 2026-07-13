/* ============================================
   SALEH DIAA — SECURITY ENGINEER PORTFOLIO
   script.js
   ============================================ */

/* ============================================
   1. CUSTOM CURSOR
   ============================================ */
const cursorDot  = document.querySelector('.cursor-dot');
const cursorRing = document.querySelector('.cursor-ring');

let mouseX = 0, mouseY = 0;
let ringX  = 0, ringY  = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursorDot.style.left = mouseX + 'px';
  cursorDot.style.top  = mouseY + 'px';
});

function animateCursor() {
  ringX += (mouseX - ringX) * 0.12;
  ringY += (mouseY - ringY) * 0.12;
  cursorRing.style.left = ringX + 'px';
  cursorRing.style.top  = ringY + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

/* ============================================
   2. PARTICLE / GRID CANVAS BACKGROUND
   ============================================ */
const canvas = document.getElementById('bg-canvas');
const ctx    = canvas.getContext('2d');

let particles = [];
let W, H;

function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); initParticles(); });

class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x   = Math.random() * W;
    this.y   = Math.random() * H;
    this.vx  = (Math.random() - 0.5) * 0.3;
    this.vy  = (Math.random() - 0.5) * 0.3;
    this.r   = Math.random() * 1.5 + 0.5;
    this.a   = Math.random() * 0.4 + 0.1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > W) this.vx *= -1;
    if (this.y < 0 || this.y > H) this.vy *= -1;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 240, 180, ${this.a})`;
    ctx.fill();
  }
}

function initParticles() {
  const count = Math.floor((W * H) / 18000);
  particles = Array.from({ length: count }, () => new Particle());
}
initParticles();

function connectParticles() {
  const maxDist = 140;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx   = particles[i].x - particles[j].x;
      const dy   = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist) {
        const alpha = (1 - dist / maxDist) * 0.12;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(0, 240, 180, ${alpha})`;
        ctx.lineWidth   = 0.5;
        ctx.stroke();
      }
    }
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, W, H);
  particles.forEach(p => { p.update(); p.draw(); });
  connectParticles();
  requestAnimationFrame(animateParticles);
}
animateParticles();

/* ============================================
   3. TERMINAL ANIMATION (HERO)
   ============================================ */
const terminalLines = [
  { id: 'tl-1', text: '$ whoami',                            delay: 300,  cls: 'cmd' },
  { id: 'tl-2', text: '> saleh_diaa_ahmed',                  delay: 700,  cls: 'out' },
  { id: 'tl-3', text: '$ cat specialization.txt',            delay: 1100, cls: 'cmd' },
  { id: 'tl-4', text: '> kernel_security | mobile_pentest',  delay: 1500, cls: 'out' },
  { id: 'tl-5', text: '$ status --threat-level',             delay: 2000, cls: 'warn' },
];

const loopLines = [
  '> [MONITOR] WatchZork driver active...',
  '> [ALERT]   APC injection attempt detected',
  '> [BLOCK]   Thread restricted by Terminator',
  '> [INFO]    Signal normalized → Wazuh SIEM',
  '> [CVE]     NVD feed updated: 3 new targets',
  '> [OK]      Homelab heartbeat nominal',
];

function typeText(el, text, speed = 28) {
  return new Promise(resolve => {
    let i = 0;
    const interval = setInterval(() => {
      el.textContent += text[i];
      i++;
      if (i >= text.length) { clearInterval(interval); resolve(); }
    }, speed);
  });
}

async function runTerminal() {
  for (const line of terminalLines) {
    const el = document.getElementById(line.id);
    if (!el) continue;
    el.className = 'terminal-line ' + line.cls;
    await new Promise(r => setTimeout(r, line.delay - (terminalLines.indexOf(line) > 0 ? terminalLines[terminalLines.indexOf(line)-1].delay : 0)));
    await typeText(el, line.text, 30);
  }
  // Loop status lines
  let loopIdx = 0;
  const statusEl = document.getElementById('tl-5');
  if (!statusEl) return;
  setInterval(() => {
    statusEl.textContent = loopLines[loopIdx % loopLines.length];
    loopIdx++;
  }, 2500);
}

runTerminal();

/* ============================================
   4. HERO TYPING ANIMATION
   ============================================ */
const typingStrings = [
  'Kernel Security Engineer.',
  'Threat Researcher.',
  'Penetration Tester.',
  'CTF Challenge Designer.',
  'Systems & Secure Architect.',
];

const typingEl = document.getElementById('typing-text');
let strIndex  = 0;
let charIndex = 0;
let isDeleting = false;

function typeLoop() {
  const current = typingStrings[strIndex];
  if (isDeleting) {
    typingEl.textContent = current.substring(0, charIndex - 1);
    charIndex--;
  } else {
    typingEl.textContent = current.substring(0, charIndex + 1);
    charIndex++;
  }

  let delay = isDeleting ? 40 : 70;

  if (!isDeleting && charIndex === current.length) {
    delay = 1800;
    isDeleting = true;
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    strIndex = (strIndex + 1) % typingStrings.length;
    delay = 300;
  }

  setTimeout(typeLoop, delay);
}

setTimeout(typeLoop, 1200);

/* ============================================
   5. NAVBAR: SCROLL BEHAVIOR & ACTIVE SECTION
   ============================================ */
const navbar  = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-links a');
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
  // Scrolled state
  if (window.scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }

  // Active section detection
  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 120;
    if (window.scrollY >= sectionTop) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-section') === current) {
      link.classList.add('active');
    }
  });
});

/* ============================================
   6. SMOOTH SCROLLING
   ============================================ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Close mobile menu if open
      mobileMenu.classList.remove('open');
      burger.classList.remove('open');
    }
  });
});

/* ============================================
   7. MOBILE MENU TOGGLE
   ============================================ */
const burger     = document.getElementById('burger');
const mobileMenu = document.getElementById('mobile-menu');

burger.addEventListener('click', () => {
  burger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
});

document.querySelectorAll('.mobile-link').forEach(link => {
  link.addEventListener('click', () => {
    burger.classList.remove('open');
    mobileMenu.classList.remove('open');
  });
});

/* ============================================
   8. SCROLL REVEAL ANIMATIONS
   ============================================ */
const revealEls = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      // Stagger delay based on position among siblings
      const siblings = Array.from(entry.target.parentElement.children);
      const idx = siblings.indexOf(entry.target);
      entry.target.style.transitionDelay = `${idx * 0.08}s`;
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px',
});

revealEls.forEach(el => revealObserver.observe(el));

/* ============================================
   9. PROJECT CARD GLOW (mouse tracking)
   ============================================ */
document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mx', `${x}px`);
    card.style.setProperty('--my', `${y}px`);

    const glow = card.querySelector('.project-glow');
    if (glow) {
      glow.style.left = (x - 100) + 'px';
      glow.style.top  = (y - 100) + 'px';
      glow.style.opacity = '1';
    }
  });
  card.addEventListener('mouseleave', () => {
    const glow = card.querySelector('.project-glow');
    if (glow) {
      glow.style.top   = '-80px';
      glow.style.right = '-80px';
      glow.style.left  = '';
      glow.style.opacity = '0.6';
    }
  });
});

/* ============================================
   10. CONTACT FORM (UI only — simulated submit)
   ============================================ */
const formSubmit = document.getElementById('form-submit');
const formSuccess = document.getElementById('form-success');
const nameInput  = document.getElementById('name');
const emailInput = document.getElementById('email');
const msgInput   = document.getElementById('message');

formSubmit.addEventListener('click', () => {
  const name  = nameInput.value.trim();
  const email = emailInput.value.trim();
  const msg   = msgInput.value.trim();

  if (!name || !email || !msg) {
    // Shake effect on empty fields
    [nameInput, emailInput, msgInput].forEach(el => {
      if (!el.value.trim()) {
        el.style.borderColor = '#ef4444';
        el.style.animation   = 'shake 0.3s ease';
        setTimeout(() => {
          el.style.borderColor = '';
          el.style.animation   = '';
        }, 600);
      }
    });
    return;
  }

  // Simulate sending
  formSubmit.textContent = 'Sending...';
  formSubmit.disabled    = true;

  setTimeout(() => {
    formSubmit.style.display = 'none';
    formSuccess.classList.add('show');
    nameInput.value  = '';
    emailInput.value = '';
    msgInput.value   = '';
  }, 1200);
});

// Shake keyframes (injected)
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25%       { transform: translateX(-6px); }
  75%       { transform: translateX(6px); }
}`;
document.head.appendChild(shakeStyle);

/* ============================================
   11. BADGE HOVER RIPPLE EFFECT
   ============================================ */
document.querySelectorAll('.badge').forEach(badge => {
  badge.addEventListener('click', (e) => {
    const ripple = document.createElement('span');
    const rect   = badge.getBoundingClientRect();
    ripple.style.cssText = `
      position: absolute;
      width: 40px; height: 40px;
      background: rgba(0,240,180,0.3);
      border-radius: 50%;
      transform: translate(-50%, -50%) scale(0);
      animation: rippleAnim 0.5s ease forwards;
      left: ${e.clientX - rect.left}px;
      top:  ${e.clientY - rect.top}px;
      pointer-events: none;
    `;
    badge.style.position = 'relative';
    badge.style.overflow = 'hidden';
    badge.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
});

const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
@keyframes rippleAnim {
  to { transform: translate(-50%, -50%) scale(3); opacity: 0; }
}`;
document.head.appendChild(rippleStyle);

/* ============================================
   12. SECTION ENTRANCE: subtle counter for stats
   ============================================ */
function animateCounter(el, target) {
  let start  = 0;
  const dur  = 1200;
  const step = 16;
  const inc  = target / (dur / step);
  const isStr = isNaN(parseInt(target));
  if (isStr) return;

  const numTarget = parseInt(target);
  const suffix    = target.toString().replace(/[0-9]/g, '');

  const timer = setInterval(() => {
    start = Math.min(start + inc, numTarget);
    el.textContent = Math.floor(start) + suffix;
    if (start >= numTarget) clearInterval(timer);
  }, step);
}

const statObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const numEl = entry.target.querySelector('.stat-num');
      if (numEl) {
        const raw = numEl.textContent;
        if (!isNaN(parseInt(raw))) {
          animateCounter(numEl, raw);
        }
      }
      statObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-card').forEach(c => statObserver.observe(c));

/* ============================================
   13. PARALLAX: subtle hero parallax
   ============================================ */
const heroContent = document.querySelector('.hero-content');
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  if (heroContent) {
    heroContent.style.transform = `translateY(${scrollY * 0.18}px)`;
    heroContent.style.opacity   = 1 - scrollY / 600;
  }
});
