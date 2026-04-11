/* tables.js — ThemeTable class for coarse and fine data tables */

class ThemeTable {
  constructor(containerId, data, config = {}) {
    this.tbody = document.getElementById(containerId);
    this.data = data;
    this.filtered = [...data];
    this.sortKey = config.defaultSort || 'n';
    this.sortDir = config.defaultDir || 'desc';
    this.searchTerm = '';
    this.activeFilter = 'all';
    this.activeTopic = 'all';
    this.page = 1;
    this.pageSize = config.pageSize || data.length; // no pagination by default
    this.config = config;
    this.expandedId = null;
    this.countEl = config.countEl ? document.getElementById(config.countEl) : null;
    this.paginationEl = config.paginationEl ? document.getElementById(config.paginationEl) : null;

    this._attachHeaderSort(config.tableId);
    this._applyAndRender();
  }

  // ── Filtering & sorting ──────────────────────────────────────

  applyFilters() {
    let result = [...this.data];

    // Search
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      result = result.filter(d => {
        const nameMatch = (d.label || d.name || '').toLowerCase().includes(q);
        const beliefMatch = (d.top3 || []).some(b => b.toLowerCase().includes(q));
        return nameMatch || beliefMatch;
      });
    }

    // Constraint filter
    switch (this.activeFilter) {
      case 'women_high': result = result.filter(d => d.r_diff > 0.5); break;
      case 'large':      result = result.filter(d => d.r_diff > 1.0); break;
      case 'men':        result = result.filter(d => d.r_diff < 0);   break;
    }

    // Topic filter (fine table only)
    if (this.activeTopic && this.activeTopic !== 'all') {
      result = result.filter(d => d.topic === this.activeTopic);
    }

    // Sort
    result.sort((a, b) => {
      const va = a[this.sortKey] ?? '';
      const vb = b[this.sortKey] ?? '';
      const mult = this.sortDir === 'asc' ? 1 : -1;
      if (typeof va === 'number') return mult * (va - vb);
      return mult * String(va).localeCompare(String(vb));
    });

    this.filtered = result;
    this.page = 1;
  }

  _applyAndRender() {
    this.applyFilters();
    this.render();
    this._updateCount();
    this._renderPagination();
  }

  // ── Rendering ────────────────────────────────────────────────

  render() {
    this.tbody.innerHTML = '';
    const start = (this.page - 1) * this.pageSize;
    const end = this.pageSize < this.filtered.length ? start + this.pageSize : this.filtered.length;
    const page = this.filtered.slice(start, end);

    if (page.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.setAttribute('colspan', '7');
      td.style.cssText = 'padding:32px;text-align:center;color:var(--color-text-tertiary);font-size:14px;';
      td.textContent = 'No results match your search or filters.';
      tr.appendChild(td);
      this.tbody.appendChild(tr);
      return;
    }

    page.forEach(record => {
      this.tbody.appendChild(this._renderRow(record));
      // render expand row (hidden by default)
      const expRow = this._renderExpandRow(record);
      expRow.style.display = 'none';
      this.tbody.appendChild(expRow);
    });
  }

  _renderRow(d) {
    const tr = document.createElement('tr');
    tr.dataset.id = d.id;
    tr.addEventListener('click', () => this._toggleExpand(d.id));

    const isCoarse = this.config.mode === 'coarse';
    const name = d.label || d.name || '';

    // Theme / name
    const tdName = document.createElement('td');
    tdName.style.maxWidth = '260px';
    tdName.style.fontWeight = '500';
    tdName.textContent = name;
    tr.appendChild(tdName);

    // N
    const tdN = document.createElement('td');
    tdN.style.cssText = 'text-align:right;color:var(--color-text-secondary);white-space:nowrap;';
    tdN.textContent = d.n.toLocaleString();
    tr.appendChild(tdN);

    if (isCoarse) {
      // R Women
      const tdRW = document.createElement('td');
      tdRW.className = 'score-w hide-mobile';
      tdRW.textContent = d.r_w != null ? d.r_w.toFixed(2) : '—';
      tr.appendChild(tdRW);

      // R Men
      const tdRM = document.createElement('td');
      tdRM.className = 'score-m hide-mobile';
      tdRM.textContent = d.r_m != null ? d.r_m.toFixed(2) : '—';
      tr.appendChild(tdRM);
    }

    // R Gap
    const tdRGap = document.createElement('td');
    tdRGap.style.whiteSpace = 'nowrap';
    tdRGap.appendChild(this._gapBar(d.r_diff, 2.5));
    tr.appendChild(tdRGap);

    // B Gap
    const tdBGap = document.createElement('td');
    tdBGap.className = 'hide-mobile';
    tdBGap.style.whiteSpace = 'nowrap';
    tdBGap.appendChild(this._gapBar(d.b_diff, 2.5));
    tr.appendChild(tdBGap);

    if (isCoarse) {
      // Sample belief
      const tdBelief = document.createElement('td');
      tdBelief.className = 'hide-mobile';
      tdBelief.style.maxWidth = '260px';
      const span = document.createElement('span');
      span.className = 'belief-snippet';
      span.textContent = (d.top3 && d.top3[0]) ? d.top3[0] : '—';
      tdBelief.appendChild(span);
      tr.appendChild(tdBelief);
    } else {
      // Topic
      const tdTopic = document.createElement('td');
      tdTopic.className = 'hide-mobile';
      if (d.topic) {
        const chip = document.createElement('span');
        chip.className = 'topic-chip';
        chip.textContent = d.topic;
        tdTopic.appendChild(chip);
      }
      tr.appendChild(tdTopic);

      // Norm type
      const tdNT = document.createElement('td');
      tdNT.className = 'hide-mobile';
      if (d.nt_w) {
        const badge = document.createElement('span');
        badge.className = d.nt_w === 'injunctive' ? 'badge badge-inj' : 'badge badge-desc';
        badge.textContent = d.nt_w;
        tdNT.appendChild(badge);
      }
      tr.appendChild(tdNT);
    }

    return tr;
  }

  _renderExpandRow(d) {
    const isCoarse = this.config.mode === 'coarse';
    const cols = isCoarse ? 7 : 6;
    const tr = document.createElement('tr');
    tr.className = 'expand-row';
    tr.dataset.expandId = d.id;

    const td = document.createElement('td');
    td.setAttribute('colspan', cols);

    const inner = document.createElement('div');
    inner.className = 'expand-inner';

    // Left: beliefs + example
    const beliefsDiv = document.createElement('div');
    beliefsDiv.className = 'expand-beliefs';
    const beliefsH4 = document.createElement('h4');
    beliefsH4.textContent = 'Sample beliefs (from Nairaland)';
    beliefsDiv.appendChild(beliefsH4);
    const ul = document.createElement('ul');
    (d.top3 || []).forEach(b => {
      const li = document.createElement('li');
      li.textContent = b;
      ul.appendChild(li);
    });
    if (!d.top3 || d.top3.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No sample beliefs available.';
      ul.appendChild(li);
    }
    beliefsDiv.appendChild(ul);

    if (d.example) {
      const exH4 = document.createElement('h4');
      exH4.textContent = 'Example forum post';
      beliefsDiv.appendChild(exH4);
      const quote = document.createElement('div');
      quote.className = 'expand-example';
      quote.textContent = '"' + d.example + '"';
      beliefsDiv.appendChild(quote);
    }

    // Right: score comparison
    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'expand-score';
    const scoreH4 = document.createElement('h4');
    scoreH4.textContent = 'Scores by gender';
    scoreDiv.appendChild(scoreH4);

    scoreDiv.appendChild(this._miniScoreBlock('Restrictiveness', d.r_w, d.r_m, 5));
    scoreDiv.appendChild(this._miniScoreBlock('Burden', d.b_w, d.b_m, 5));

    // Norm type if fine
    if (!isCoarse && (d.nt_w || d.nt_m)) {
      const ntDiv = document.createElement('div');
      ntDiv.style.marginTop = '12px';
      ntDiv.innerHTML = `
        <div style="font-size:12px;color:var(--color-text-tertiary);margin-bottom:6px;">Norm type</div>
        <div style="font-size:13px;color:var(--color-text-secondary);">
          Women: <strong>${d.nt_w || '—'}</strong> &nbsp;|&nbsp; Men: <strong>${d.nt_m || '—'}</strong>
        </div>`;
      scoreDiv.appendChild(ntDiv);
    }

    inner.appendChild(beliefsDiv);
    inner.appendChild(scoreDiv);
    td.appendChild(inner);
    tr.appendChild(td);
    return tr;
  }

  _miniScoreBlock(label, wVal, mVal, max) {
    const row = document.createElement('div');
    row.className = 'mini-score-row';

    const lbl = document.createElement('div');
    lbl.className = 'mini-score-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const barWrap = document.createElement('div');
    barWrap.className = 'mini-bar-wrap';

    if (wVal != null) {
      const wLine = document.createElement('div');
      wLine.className = 'mini-bar-line';
      const wBar = document.createElement('div');
      wBar.className = 'mini-bar';
      wBar.style.cssText = `width:${(wVal/max*100).toFixed(1)}%;max-width:120px;background:var(--color-women);opacity:0.8;`;
      const wV = document.createElement('span');
      wV.className = 'mini-val';
      wV.innerHTML = `<span style="color:var(--color-women);font-size:10px;margin-right:3px;">W</span>${wVal.toFixed(2)}`;
      wLine.appendChild(wBar);
      wLine.appendChild(wV);
      barWrap.appendChild(wLine);
    }

    if (mVal != null) {
      const mLine = document.createElement('div');
      mLine.className = 'mini-bar-line';
      const mBar = document.createElement('div');
      mBar.className = 'mini-bar';
      mBar.style.cssText = `width:${(mVal/max*100).toFixed(1)}%;max-width:120px;background:var(--color-men);opacity:0.8;`;
      const mV = document.createElement('span');
      mV.className = 'mini-val';
      mV.innerHTML = `<span style="color:var(--color-men);font-size:10px;margin-right:3px;">M</span>${mVal.toFixed(2)}`;
      mLine.appendChild(mBar);
      mLine.appendChild(mV);
      barWrap.appendChild(mLine);
    }

    row.appendChild(barWrap);
    return row;
  }

  _gapBar(value, maxAbs) {
    const wrap = document.createElement('span');
    wrap.className = 'gap-bar-wrap';

    const track = document.createElement('span');
    track.className = 'gap-bar-track';
    const fill = document.createElement('span');
    fill.className = 'gap-bar-fill';
    const pct = Math.min(Math.abs(value || 0) / maxAbs * 100, 100).toFixed(1);
    fill.style.width = pct + '%';
    fill.style.background = (value >= 0) ? 'var(--color-women)' : 'var(--color-men)';
    track.appendChild(fill);

    const val = document.createElement('span');
    val.className = 'gap-val ' + ((value >= 0) ? 'pos' : 'neg');
    val.textContent = (value >= 0 ? '+' : '') + (value || 0).toFixed(2);

    wrap.appendChild(track);
    wrap.appendChild(val);
    return wrap;
  }

  // ── Expand / collapse rows ───────────────────────────────────

  _toggleExpand(id) {
    const expRow = this.tbody.querySelector(`[data-expand-id="${id}"]`);
    const mainRow = this.tbody.querySelector(`[data-id="${id}"]`);
    if (!expRow || !mainRow) return;

    const isOpen = expRow.style.display !== 'none';
    // Close any open row first
    this.tbody.querySelectorAll('.expand-row').forEach(r => r.style.display = 'none');
    this.tbody.querySelectorAll('tr[data-id]').forEach(r => r.classList.remove('row-expanded'));

    if (!isOpen) {
      expRow.style.display = '';
      mainRow.classList.add('row-expanded');
      this.expandedId = id;
    } else {
      this.expandedId = null;
    }
  }

  // ── Header sort ──────────────────────────────────────────────

  _attachHeaderSort(tableId) {
    if (!tableId) return;
    const table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (this.sortKey === key) {
          this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortKey = key;
          this.sortDir = 'desc';
        }
        // Update caret visuals
        table.querySelectorAll('th[data-sort]').forEach(t => {
          t.classList.remove('sorted');
          t.querySelector('.sort-caret').textContent = '↕';
        });
        th.classList.add('sorted');
        th.querySelector('.sort-caret').textContent = this.sortDir === 'desc' ? '↓' : '↑';
        this._applyAndRender();
      });
    });
  }

  // ── Count display ────────────────────────────────────────────

  _updateCount() {
    if (this.countEl) {
      this.countEl.textContent = `${this.filtered.length.toLocaleString()} result${this.filtered.length !== 1 ? 's' : ''}`;
    }
  }

  // ── Pagination ───────────────────────────────────────────────

  _renderPagination() {
    if (!this.paginationEl || this.pageSize >= this.filtered.length) {
      if (this.paginationEl) this.paginationEl.innerHTML = '';
      return;
    }
    const totalPages = Math.ceil(this.filtered.length / this.pageSize);
    const p = this.page;

    const info = document.createElement('span');
    const start = (p - 1) * this.pageSize + 1;
    const end = Math.min(p * this.pageSize, this.filtered.length);
    info.textContent = `Showing ${start}–${end} of ${this.filtered.length.toLocaleString()}`;

    const btnWrap = document.createElement('div');
    btnWrap.className = 'page-btns';

    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = '← Prev';
    prev.disabled = p === 1;
    prev.addEventListener('click', () => { this.page--; this._applyAndRender(); });
    btnWrap.appendChild(prev);

    // Show up to 5 page numbers around current
    const pages = [];
    for (let i = Math.max(1, p - 2); i <= Math.min(totalPages, p + 2); i++) pages.push(i);
    if (pages[0] > 1) {
      const dots = document.createElement('span');
      dots.style.cssText = 'padding:5px 4px;color:var(--color-text-tertiary);font-size:13px;';
      dots.textContent = '…';
      btnWrap.appendChild(dots);
    }
    pages.forEach(pg => {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (pg === p ? ' current' : '');
      btn.textContent = pg;
      btn.addEventListener('click', () => { this.page = pg; this._applyAndRender(); });
      btnWrap.appendChild(btn);
    });
    if (pages[pages.length - 1] < totalPages) {
      const dots = document.createElement('span');
      dots.style.cssText = 'padding:5px 4px;color:var(--color-text-tertiary);font-size:13px;';
      dots.textContent = '…';
      btnWrap.appendChild(dots);
    }

    const next = document.createElement('button');
    next.className = 'page-btn';
    next.textContent = 'Next →';
    next.disabled = p === totalPages;
    next.addEventListener('click', () => { this.page++; this._applyAndRender(); });
    btnWrap.appendChild(next);

    this.paginationEl.innerHTML = '';
    this.paginationEl.appendChild(info);
    this.paginationEl.appendChild(btnWrap);
  }

  // ── Public: attach search input ──────────────────────────────

  attachSearch(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    let timer;
    el.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.searchTerm = el.value.trim();
        this._applyAndRender();
      }, 200);
    });
  }

  // ── Public: attach filter pills ──────────────────────────────

  attachFilterPills(containerSelector) {
    document.querySelectorAll(containerSelector + ' .filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(containerSelector + ' .filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter;
        this._applyAndRender();
      });
    });
  }

  // ── Public: attach topic filters ────────────────────────────

  attachTopicFilters(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const topics = [...new Set(this.data.map(d => d.topic).filter(Boolean))].sort();
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-pill active';
    allBtn.textContent = 'All forums';
    allBtn.addEventListener('click', () => {
      container.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      allBtn.classList.add('active');
      this.activeTopic = 'all';
      this._applyAndRender();
    });
    container.appendChild(allBtn);

    topics.forEach(topic => {
      const btn = document.createElement('button');
      btn.className = 'filter-pill';
      btn.textContent = 'Forum: ' + topic;
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTopic = topic;
        this._applyAndRender();
      });
      container.appendChild(btn);
    });
  }
}
