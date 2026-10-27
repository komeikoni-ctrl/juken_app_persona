// ============================================================
// ★ PERSONA版のモーション（見た目だけ。データ・同期・描画ロジックには触れない）
// P5 の実物の挙動の再現を目指す:
// - ページ遷移ワイプ: 赤→白→黒の斜めパネルが横切り、覆い切る瞬間に中央で星が弾ける。
//   window.showPage をラップし、覆い切るタイミングで本来の showPage を呼ぶ。
//   ・ナビボタンからの遷移（btn 付き）のときだけ再生する。SelfTest 等のプログラム呼び出し
//     （btn なし）や起動時の初回表示は従来どおり即時に切り替える。
//   ・再生中にもう一度呼ばれたら、保留中の切り替えを取り消して即時実行にフォールバックする。
// - 数値カウントアップ: ナビ遷移のたびに、開いたページの主要数値（カウントダウン日数・
//   統計値・リング値）を 0 から一気に数え上げる（P5 のリザルト画面風）。
//   対象は単一数値＋接頭/接尾だけのテキストのみ。複合表示（29h12m 等）は対象外。
// - 見出しのランサムノート化: .page-title を1書記素ずつ span に分け、CSS で回転・反転させる。
//   textContent は変えない（テスト・検索に影響しない）。
// - 星バースト: ナビボタンのクリック位置から ★ が5個飛ぶ（アニメ後に削除）。
// - prefers-reduced-motion: reduce のときは一切行わない（CSS 側でも無効化している）。
// 11-boot.js の直前に読み込むこと（09-misc.js で定義された showPage を包むため）。
// ============================================================
(function () {
  'use strict';
  const orig = window.showPage;
  if (typeof orig !== 'function') return;

  const SWAP_AT = 220;   // パネルが画面を覆いきるタイミング（ms）
  const TOTAL = 580;     // ワイプ全体の長さ（パネル .42s ＋ 星 .56s ＋ 余裕）
  const wipe = document.getElementById('p5-wipe');
  const rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(rm && rm.matches);
  const isPersona = () => document.documentElement.getAttribute('data-style') === 'persona';

  // ワイプに白レイヤーと中央の星を追加する（赤→白→黒の順で重なる）
  if (wipe && !wipe.querySelector('.p5-wipe-white')) {
    const white = document.createElement('div');
    white.className = 'p5-wipe-white';
    const black = wipe.querySelector('.p5-wipe-black');
    if (black) wipe.insertBefore(white, black); else wipe.appendChild(white);
    const star = document.createElement('div');
    star.className = 'p5-wipe-star';
    star.textContent = '★';
    wipe.appendChild(star);
  }

  // --- 数値カウントアップ ---
  const NUM_RE = /^([^\d]*?)([\d][\d,]*(?:\.\d+)?)(.*)$/;
  const countUp = (pageEl) => {
    if (!pageEl || reduced() || !isPersona()) return;
    pageEl.querySelectorAll('.cd-big, .stat-v, .today-ring-val').forEach((el) => {
      const txt = (el.textContent || '').trim();
      const m = txt.match(NUM_RE);
      if (!m || /\d/.test(m[3])) return;             // 接尾に数字を含む複合表示は対象外
      const target = parseFloat(m[2].replace(/,/g, ''));
      if (!isFinite(target) || target === 0) return;
      if (el.dataset.p5cu === txt) return;          // 同じ値では再アニメーションしない
      el.dataset.p5cu = txt;
      const dec = (m[2].split('.')[1] || '').length;
      const fmt = (v) => m[1] + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3];
      const t0 = performance.now();
      const dur = 600;
      const step = (t) => {
        if (el.dataset.p5cu !== txt) return;         // 途中で再描画されたら譲る
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * e);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = txt;                   // 最後は元の表記にぴったり戻す
      };
      requestAnimationFrame(step);
    });
  };
  const afterShow = (id, userDriven) => {
    if (!userDriven) return;
    countUp(document.getElementById('page-' + id));
  };

  let booted = false;    // 最初の showPage（起動時の表示）ではワイプしない
  let playing = false;
  let swapTimer = 0;
  let endTimer = 0;

  window.showPage = function (id, btn) {
    const args = arguments;
    const self = this;
    const fromNav = !!(btn && btn.classList && btn.classList.contains('nav-btn'));
    const animate = booted && fromNav && !!wipe && !reduced() && isPersona()
      && !(typeof S !== 'undefined' && S && S.currentPage === id);
    booted = true;

    if (!animate || playing) {
      if (swapTimer) { clearTimeout(swapTimer); swapTimer = 0; }
      const r = orig.apply(self, args);
      afterShow(id, fromNav);
      return r;
    }

    playing = true;
    wipe.classList.remove('run');
    void wipe.offsetWidth; // アニメーションを頭から再生し直す
    wipe.classList.add('run');
    swapTimer = setTimeout(() => {
      swapTimer = 0;
      orig.apply(self, args);
      afterShow(id, true);
    }, SWAP_AT);
    clearTimeout(endTimer);
    endTimer = setTimeout(() => {
      wipe.classList.remove('run');
      playing = false;
    }, TOTAL);
  };

  // --- 見出しのランサムノート化（書記素単位。ZWJ絵文字を壊さない） ---
  const splitTitle = (el) => {
    if (!el || el.dataset.p5split) return;
    const text = el.textContent || '';
    if (!text.trim() || typeof Intl === 'undefined' || !Intl.Segmenter) return;
    const seg = new Intl.Segmenter('ja', { granularity: 'grapheme' });
    const parts = Array.from(seg.segment(text), (s) => s.segment);
    if (parts.length < 2) return;
    el.dataset.p5split = '1';
    el.textContent = '';
    parts.forEach((ch, n) => {
      const s = document.createElement('span');
      // 反転ブロックは文字・数字だけに付ける（絵文字には付けない）
      s.className = 'p5-ch' + (n % 7 === 3 && /[\p{L}\p{N}]/u.test(ch) ? ' p5-ch-inv' : '');
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      el.appendChild(s);
    });
  };
  document.querySelectorAll('.page-title').forEach(splitTitle);

  // --- 星バースト ---
  let starLayer = null;
  const getStarLayer = () => {
    if (starLayer && starLayer.isConnected) return starLayer;
    starLayer = document.createElement('div');
    starLayer.id = 'p5-stars';
    starLayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(starLayer);
    return starLayer;
  };

  const burst = (x, y) => {
    const layer = getStarLayer();
    const n = 5;
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = base + (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.6;
      const dist = 34 + Math.random() * 30;
      const s = document.createElement('span');
      s.className = 'p5-star';
      s.textContent = '★';
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.fontSize = (13 + Math.random() * 9).toFixed(0) + 'px';
      s.style.setProperty('--dx', (Math.cos(a) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(a) * dist).toFixed(1) + 'px');
      s.style.setProperty('--rot', ((Math.random() - 0.5) * 240).toFixed(0) + 'deg');
      const done = () => s.remove();
      s.addEventListener('animationend', done, { once: true });
      setTimeout(done, 900); // animationend が来ない環境でも必ず消す
      layer.appendChild(s);
    }
  };

  document.addEventListener('click', (e) => {
    const t = e.target;
    const b = t && t.closest ? t.closest('.top-nav .nav-btn') : null;
    if (!b || reduced() || !isPersona()) return;
    let x = e.clientX, y = e.clientY;
    if (!e.detail && !x && !y) { // キーボード操作のクリックはボタン中央から
      const r = b.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    burst(x, y);
  });
})();
