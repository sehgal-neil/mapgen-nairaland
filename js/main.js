/* main.js — nav, count-up, iframe resize, tabs, lazy fine data */

// ── Nav: hamburger ────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');
hamburger.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', isOpen);
});
// Close menu on nav link click
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

// ── Nav: active section highlight ────────────────────────────
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      navAnchors.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + id);
      });
    }
  });
}, { rootMargin: '-30% 0px -60% 0px' });
sections.forEach(s => sectionObserver.observe(s));

// ── Hero count-up animation ───────────────────────────────────
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function animateCount(el) {
  const target = parseInt(el.dataset.count, 10);
  const divisor = parseInt(el.dataset.divisor || '1', 10);
  const suffix = el.dataset.suffix || '';
  const prefix = el.dataset.prefix || '';
  const duration = 1200;
  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);
    const value = Math.round(eased * target);
    const display = divisor > 1 ? (value / divisor).toFixed(divisor === 1000000 ? 0 : 0) : value.toLocaleString();
    el.textContent = prefix + display + suffix;
    if (progress < 1) requestAnimationFrame(frame);
    else {
      // Final precise value
      if (divisor > 1) {
        el.textContent = prefix + (target / divisor).toFixed(0) + suffix;
      } else {
        el.textContent = prefix + target.toLocaleString() + suffix;
      }
    }
  }
  requestAnimationFrame(frame);
}

const heroObserver = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) {
    document.querySelectorAll('.stat-num[data-count]').forEach(animateCount);
    heroObserver.disconnect();
  }
}, { threshold: 0.3 });
const heroSection = document.getElementById('hero');
if (heroSection) heroObserver.observe(heroSection);

// ── Iframe auto-height ────────────────────────────────────────
const frames = {
  'frame-dot':    document.getElementById('frame-dot'),
  'frame-bar':    document.getElementById('frame-bar'),
  'frame-bubble': document.getElementById('frame-bubble'),
};
window.addEventListener('message', e => {
  if (e.data && typeof e.data.iframeHeight === 'number') {
    // Find which iframe sent it
    Object.values(frames).forEach(iframe => {
      if (iframe && e.source === iframe.contentWindow) {
        iframe.style.height = e.data.iframeHeight + 'px';
      }
    });
  }
});

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const panelId = 'tab-' + btn.dataset.tab;
    document.getElementById(panelId).classList.add('active');

    if (btn.dataset.tab === 'fine') initFineTable();
  });
});

// ── Coarse table (immediate init) ─────────────────────────────
const coarseTable = new ThemeTable('coarse-tbody', COARSE_THEMES, {
  mode: 'coarse',
  defaultSort: 'n',
  defaultDir: 'desc',
  tableId: 'coarse-table',
  countEl: 'coarse-count',
});
coarseTable.attachSearch('coarse-search');
coarseTable.attachFilterPills('#tab-coarse .table-controls');

// ── Fine table (lazy init) ────────────────────────────────────
let fineTableInited = false;

function initFineTable() {
  if (fineTableInited) return;

  const loadingEl = document.getElementById('fine-loading');
  const controlsEl = document.getElementById('fine-controls');

  if (typeof FINE_CLUSTERS !== 'undefined') {
    _buildFineTable();
  } else {
    // Lazy-load fine-data.js
    const script = document.createElement('script');
    script.src = 'js/fine-data.js';
    script.onload = () => _buildFineTable();
    script.onerror = () => {
      if (loadingEl) loadingEl.textContent = 'Failed to load cluster data.';
    };
    document.head.appendChild(script);
  }

  function _buildFineTable() {
    fineTableInited = true;
    if (loadingEl) loadingEl.style.display = 'none';
    if (controlsEl) controlsEl.style.display = '';

    const fineTable = new ThemeTable('fine-tbody', FINE_CLUSTERS, {
      mode: 'fine',
      defaultSort: 'n',
      defaultDir: 'desc',
      tableId: 'fine-table',
      countEl: 'fine-count',
      pageSize: 25,
      paginationEl: 'fine-pagination',
    });
    fineTable.attachSearch('fine-search');
    fineTable.attachFilterPills('#tab-fine #fine-controls .table-controls');
    fineTable.attachTopicFilters('topic-filters');

    // Wire fine filter pills
    document.querySelectorAll('#fine-controls .filter-pill[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#fine-controls .filter-pill[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fineTable.activeFilter = btn.dataset.filter;
        fineTable._applyAndRender();
      });
    });
  }
}

// Also trigger fine table init via IntersectionObserver when explorer scrolls into view
const explorerSection = document.getElementById('explorer');
if (explorerSection) {
  const explorerObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      // Pre-load fine data in background while user reads coarse table
      if (!fineTableInited && typeof FINE_CLUSTERS === 'undefined') {
        const script = document.createElement('script');
        script.src = 'js/fine-data.js';
        document.head.appendChild(script);
      }
      explorerObserver.disconnect();
    }
  }, { rootMargin: '200px' });
  explorerObserver.observe(explorerSection);
}
