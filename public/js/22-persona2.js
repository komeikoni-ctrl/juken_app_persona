// ============================================================
// ★ PERSONA 2.0 のビュー層（画面構成・モーション。データ・同期・AI・計算には触れない）
// - HUD／ホームの日付・時間帯表示（P5 の左上の日付表示と時間帯）
// - モバイルの MENU（P5 のメニュー: 赤パネルが先に来て、項目がスタッガーでポップイン）
// - showPage のラップ（21-persona.js のワイプの外側）: メニューを閉じ、新画面の要素を
//   左から回転付きで滑り込ませる（.p5-enter を付け直してアニメを再発火）
// - Take Your Time（起動時の幕。load 後に上へワイプアウト。CSS にもフェイルセーフあり）
// - STATUS（人間パラメータ5種の五角形レーダー＋ランク）
// - 日送りスプラッシュ（カレンダーの月送り・今月ボタンで日付が横に流れてロック）
// - 数値カウントアップ（カウントダウン日数・総資産）
// すべて防御的に: 要素が無ければ何もしない。例外は握りつぶして他の機能を止めない。
// 21-persona.js の後・11-boot.js の前に読み込むこと。
// ============================================================
(function () {
  'use strict';

  const rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(rm && rm.matches);
  const isPersona = () => document.documentElement.getAttribute('data-style') === 'persona';
  const $ = (id) => document.getElementById(id);
  const safe = (fn) => function () { try { return fn.apply(this, arguments); } catch (e) { console.warn('[persona2]', e); } };
  const escHtml = (v) => (typeof esc === 'function' ? esc(v) : String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const getS = () => (typeof S !== 'undefined' && S ? S : null);

  const DOW3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const DOWF = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  // --- 時間帯（P5 の「放課後」「夜」など） ---
  const phaseOf = (h) => {
    if (h >= 5 && h < 8) return { ico: '🌅', ja: '早朝', en: 'EARLY MORNING' };
    if (h >= 8 && h < 11) return { ico: '☀️', ja: '午前', en: 'MORNING' };
    if (h >= 11 && h < 14) return { ico: '🍱', ja: '昼', en: 'LUNCHTIME' };
    if (h >= 14 && h < 16) return { ico: '🌤', ja: '午後', en: 'AFTERNOON' };
    if (h >= 16 && h < 19) return { ico: '🌆', ja: '放課後', en: 'AFTER SCHOOL' };
    if (h >= 19 && h < 23) return { ico: '🌙', ja: '夜', en: 'EVENING' };
    return { ico: '🌃', ja: '深夜', en: 'NIGHT' };
  };

  // --- HUD／デイリー更新（M10: 時間帯が変わったら HUD を小さく揺らす） ---
  let lastPhase = null;
  const setText = (id, v) => { const el = $(id); if (el && el.textContent !== v) el.textContent = v; };
  const updateP5Clock = safe(() => {
    const now = new Date();
    const dow = now.getDay();
    const md = (now.getMonth() + 1) + '/' + now.getDate();
    const ph = phaseOf(now.getHours());
    const phTxt = ph.ja + ' ' + ph.en;
    setText('p5-hud-date', md);
    setText('p5-hud-dow', DOW3[dow]);
    setText('p5-hud-phase-ico', ph.ico);
    setText('p5-hud-phase', phTxt);
    setText('p5-daily-md', md);
    setText('p5-daily-dow', DOWF[dow]);
    setText('p5-daily-phase', ph.ico + ' ' + phTxt);
    [$('p5-hud'), $('p5-daily')].forEach((el) => {
      if (!el) return;
      el.classList.toggle('sun', dow === 0);
      el.classList.toggle('sat', dow === 6);
    });
    const hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    document.querySelectorAll('.p5-phone-clock').forEach((el) => { if (el.textContent !== hh) el.textContent = hh; });
    const hud = $('p5-hud');
    if (hud && lastPhase !== null && lastPhase !== ph.en) {
      hud.classList.remove('p5-hud-tick');
      void hud.offsetWidth;
      hud.classList.add('p5-hud-tick');
      setTimeout(() => hud.classList.remove('p5-hud-tick'), 450);
    }
    lastPhase = ph.en;
  });

  // --- メニュー開閉（モバイル） ---
  const setMenu = safe((open) => {
    document.body.classList.toggle('p5-menu-open', !!open);
    const b = $('p5-menu-btn');
    if (b) {
      b.textContent = open ? 'CLOSE' : 'MENU';
      b.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  });
  const closeMenu = () => { if (document.body && document.body.classList.contains('p5-menu-open')) setMenu(false); };

  // --- 数値カウントアップ（M6: オドメーター式・約600ms） ---
  const NUM_RE = /^([^\d]*?)([\d][\d,]*(?:\.\d+)?)(.*)$/;
  const countUp = safe((root) => {
    if (!root || reduced() || !isPersona()) return;
    root.querySelectorAll('.p5-cd-num, .p5-wallet-amt').forEach((el) => {
      const txt = (el.textContent || '').trim();
      const m = txt.match(NUM_RE);
      if (!m || /\d/.test(m[3])) return;
      const target = parseFloat(m[2].replace(/,/g, ''));
      if (!isFinite(target) || target === 0) return;
      if (el.dataset.p5cu2 === txt) return;
      el.dataset.p5cu2 = txt;
      const dec = (m[2].split('.')[1] || '').length;
      const comma = m[2].indexOf(',') >= 0;
      const fmt = (v) => m[1] + (comma
        ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
        : v.toFixed(dec)) + m[3];
      const t0 = performance.now();
      const step = (t) => {
        if (!el.isConnected || el.dataset.p5cu2 !== txt) return;
        const p = Math.min(1, (t - t0) / 600);
        // 段階的に刻む（オドメーターらしく、なめらかすぎない）
        const e = Math.round((1 - Math.pow(1 - p, 3)) * 24) / 24;
        el.textContent = p < 1 ? fmt(target * e) : txt;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  // --- STATUS（人間パラメータ） ---
  const RANK_NAMES = {
    knowledge: ['Oblivious まだまだ', 'Learned 学識', 'Scholarly 博識', 'Encyclopedic 碩学', 'Erudite 賢者'],
    guts: ['Milquetoast びびり', 'Bold 度胸あり', 'Staunch 不動', 'Dauntless 豪胆', 'Lionhearted 獅子心'],
    proficiency: ['Clumsy 不器用', 'Decent そこそこ', 'Skillful 器用', 'Masterful 達人', 'Transcendent 神業'],
    kindness: ['Inoffensive 無関心', 'Considerate 思いやり', 'Empathetic 共感', 'Selfless 献身', 'Angelic 天使'],
    charm: ['Plain 地味', 'Noticeable 目立つ', 'Head-Turning 振り返る', 'Debonair 洒落者', 'Charismatic カリスマ'],
  };
  const rankOf = (value) => {
    const v = Math.max(0, Math.min(1, isFinite(value) ? value : 0));
    if (v >= 1) return { value: 1, rank: 5, notes: 3 };
    const rank = v < 0.2 ? 1 : v < 0.4 ? 2 : v < 0.6 ? 3 : v < 0.8 ? 4 : 5;
    const notes = Math.max(0, Math.min(3, Math.floor(((v - (rank - 1) * 0.2) / 0.2) * 3)));
    return { value: v, rank, notes };
  };
  const dayStr = (d) => (typeof DateManager !== 'undefined' && DateManager.getTodayStr)
    ? DateManager.getTodayStr(d)
    : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  const compute = () => {
    const s = getS() || {};
    // 知識: 共テ得点目標の達成率（target>0 の科目の current/target 平均）
    const tg = s.scoreTargets || {};
    const ratios = Object.keys(tg).map((k) => tg[k] || {}).filter((t) => Number(t.target) > 0)
      .map((t) => Math.max(0, Math.min(1, (Number(t.current) || 0) / Number(t.target))));
    const know = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
    // 度胸: 模試・過去問の回数
    const gutsN = (s.mocks || []).length + (s.pastExams || []).length;
    // 器用さ: 直近28日の学習実施率
    const logs = s.dailyLogs || {};
    let studied = 0;
    const base = new Date();
    for (let i = 0; i < 28; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
      const l = logs[dayStr(d)];
      if (l && Number(l.total) > 0) studied++;
    }
    // 魅力: 累計学習時間
    let mins = 0;
    try { mins = typeof calcTotalMinutes === 'function' ? calcTotalMinutes() : (s.totalMinutes || 0); } catch (e) { mins = s.totalMinutes || 0; }
    mins = Number(mins) || 0;
    // 優しさ: タスク達成率
    const tasks = s.tasks || [];
    const done = tasks.filter((t) => t && t.done).length;
    const kind = tasks.length ? done / tasks.length : 0;

    const mk = (key, ja, en, value, metric) => Object.assign({ key, ja, en, metric, rankName: RANK_NAMES[key][rankOf(value).rank - 1] }, rankOf(value));
    const p = {
      knowledge: mk('knowledge', '知識', 'KNOWLEDGE', know, `共テ目標達成率 ${Math.round(know * 100)}%`),
      guts: mk('guts', '度胸', 'GUTS', Math.min(1, gutsN / 12), `模試・過去問 ${gutsN}回`),
      proficiency: mk('proficiency', '器用さ', 'PROFICIENCY', studied / 28, `直近28日の学習実施率 ${Math.round((studied / 28) * 100)}%`),
      charm: mk('charm', '魅力', 'CHARM', Math.min(1, mins / 12000), `累計学習 ${Math.floor(mins / 60)}時間`),
      kindness: mk('kindness', '優しさ', 'KINDNESS', kind, `タスク達成率 ${Math.round(kind * 100)}%（${done}/${tasks.length}）`),
    };
    return p;
  };

  // 頂点順: 上=知識、右上=魅力、右下=器用さ、左下=優しさ、左上=度胸（-90° から 72° 刻み）
  const AXES = ['knowledge', 'charm', 'proficiency', 'kindness', 'guts'];
  const CX = 100, CY = 95, R = 70;
  const pt = (i, r) => {
    const a = (-90 + 72 * i) * Math.PI / 180;
    return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
  };
  const poly = (r) => AXES.map((_, i) => pt(i, r).map((v) => v.toFixed(1)).join(',')).join(' ');

  const renderStatus = safe(() => {
    const host = $('p5-status');
    if (!host) return;
    const p = compute();
    let svg = '<svg viewBox="0 0 200 190" role="img" aria-label="人間パラメータの五角形グラフ" xmlns="http://www.w3.org/2000/svg">';
    [0.2, 0.4, 0.6, 0.8, 1].forEach((f) => {
      svg += `<polygon class="p5-pent-grid" points="${poly(R * f)}" fill="${f === 1 ? '#FFFFFF' : 'none'}" stroke="#0D0D0D" stroke-opacity="${f === 1 ? 0.9 : 0.22}" stroke-width="${f === 1 ? 2 : 1}"/>`;
    });
    AXES.forEach((_, i) => {
      const [x, y] = pt(i, R);
      svg += `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#0D0D0D" stroke-opacity=".22" stroke-width="1"/>`;
    });
    const vals = AXES.map((k, i) => pt(i, R * Math.max(0.04, p[k].value)));
    svg += '<g class="p5-pent-val">';
    svg += `<polygon points="${vals.map((v) => v.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="rgba(230,0,18,.28)" stroke="#E60012" stroke-width="2.5" stroke-linejoin="round"/>`;
    vals.forEach(([x, y]) => { svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#E60012" stroke="#FFFFFF" stroke-width="1.5"/>`; });
    svg += '</g>';
    AXES.forEach((k, i) => {
      const [x, y] = pt(i, R + (i === 0 ? 12 : 15));
      const lx = Math.max(24, Math.min(176, x));
      const top = i === 0 ? y - 9 : (i === 2 || i === 3) ? y + 2 : y - 4;
      svg += `<text class="p5-pent-lbl" x="${lx.toFixed(1)}" y="${top.toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="900" fill="#0D0D0D">${p[k].ja}</text>`;
      svg += `<text class="p5-pent-lbl-en" x="${lx.toFixed(1)}" y="${(top + 9).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="#E60012" letter-spacing=".5">${p[k].en}</text>`;
    });
    svg += '</svg>';

    const rows = ['knowledge', 'guts', 'proficiency', 'kindness', 'charm'].map((k) => {
      const v = p[k];
      const stars = '★'.repeat(v.rank) + '<span class="off">☆</span>'.repeat(5 - v.rank);
      const notes = '♪'.repeat(v.notes) + '<span class="off">♪</span>'.repeat(3 - v.notes);
      return `<div class="p5-param p5-param-${k}">
        <div class="p5-param-main"><div class="p5-param-name">${v.ja} <small>${v.en}</small></div>
        <div class="p5-param-rank">Lv.${v.rank} ${escHtml(v.rankName)}</div></div>
        <div class="p5-param-gauge"><span class="p5-param-stars">${stars}</span><span class="p5-param-notes" title="次のランクまで">${notes}</span></div>
        <div class="p5-param-metric">${escHtml(v.metric)}</div>
      </div>`;
    }).join('');
    host.innerHTML = `<div class="p5-status-in"><div class="p5-status-chart">${svg}</div><div class="p5-status-params">${rows}</div></div>`;
  });
  window.P5Status = { render: renderStatus, compute };

  // --- 日送りスプラッシュ（M7） ---
  let dsTimer = 0;
  const P5DaySplash = safe((date) => {
    const host = $('p5-daysplash');
    if (!host || reduced() || !isPersona()) return;
    const d = date instanceof Date && !isNaN(date) ? date : new Date();
    const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    const prev = new Date(y, m, day - 1), next = new Date(y, m, day + 1);
    const dow = d.getDay();
    const cls = dow === 0 ? ' sun' : dow === 6 ? ' sat' : '';
    host.innerHTML = `<div class="p5-ds-inner">
      <div class="p5-ds-row">
        <span class="p5-ds-num" style="animation-delay:0s">${prev.getDate()}</span>
        <span class="p5-ds-num big${cls}" style="animation-delay:.12s">${(m + 1)}/${day}</span>
        <span class="p5-ds-num" style="animation-delay:.06s">${next.getDate()}</span>
      </div>
      <div class="p5-ds-dow${cls}">${DOWF[dow]}</div>
    </div>`;
    host.classList.remove('show');
    void host.offsetWidth;
    host.classList.add('show');
    clearTimeout(dsTimer);
    dsTimer = setTimeout(() => { host.classList.remove('show'); host.innerHTML = ''; }, 950);
  });
  window.P5DaySplash = P5DaySplash;

  const wrapCal = () => {
    const oCh = window.chMonth;
    if (typeof oCh === 'function' && !oCh.__p5w) {
      const w = function () {
        const r = oCh.apply(this, arguments);
        try {
          const s = getS();
          const cm = s && s.calMonth instanceof Date ? s.calMonth : new Date();
          const today = new Date();
          const lastDay = new Date(cm.getFullYear(), cm.getMonth() + 1, 0).getDate();
          P5DaySplash(new Date(cm.getFullYear(), cm.getMonth(), Math.min(today.getDate(), lastDay)));
        } catch (e) { /* 演出の失敗は無視 */ }
        return r;
      };
      w.__p5w = true;
      window.chMonth = w;
    }
    const oToday = window.chCalToday;
    if (typeof oToday === 'function' && !oToday.__p5w) {
      const w = function () {
        const r = oToday.apply(this, arguments);
        P5DaySplash(new Date());
        return r;
      };
      w.__p5w = true;
      window.chCalToday = w;
    }
  };

  // --- showPage ラップ（21-persona.js の外側） ---
  const enterPage = (id, userDriven) => {
    const page = $('page-' + id);
    if (!page || !page.classList.contains('active')) return false;
    if (!reduced()) {
      page.classList.remove('p5-enter');
      void page.offsetWidth; // アニメーションを頭から再発火
      page.classList.add('p5-enter');
    }
    if (id === 'analytics') renderStatus();
    if (id === 'home') updateP5Clock();
    if (userDriven) countUp(page);
    return true;
  };
  const wrapShowPage = () => {
    const inner = window.showPage;
    if (typeof inner !== 'function' || inner.__p5w2) return;
    const w = function (id, btn) {
      try { closeMenu(); } catch (e) { /* 無視 */ }
      const r = inner.apply(this, arguments);
      try {
        const userDriven = !!btn;
        // 21 のワイプ中は実際の切替が約220ms遅れるので、切り替わってから再生する
        if (!enterPage(id, userDriven)) setTimeout(safe(() => enterPage(id, userDriven)), 260);
      } catch (e) { console.warn('[persona2]', e); }
      return r;
    };
    w.__p5w2 = true;
    window.showPage = w;
  };

  // --- Take Your Time ---
  const hideTyt = safe(() => {
    const t = $('p5-tyt');
    if (!t || t.classList.contains('hide')) return;
    t.classList.add('hide');
    const gone = () => { t.style.display = 'none'; };
    t.addEventListener('transitionend', gone, { once: true });
    setTimeout(gone, 700); // transitionend が来ない環境でも必ず消す
  });
  const scheduleTyt = () => {
    const go = () => setTimeout(hideTyt, 900);
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  };

  // --- 初期化 ---
  const init = safe(() => {
    wrapShowPage();
    wrapCal();
    updateP5Clock();
    setInterval(updateP5Clock, 60000);
    scheduleTyt();
    const mb = $('p5-menu-btn');
    if (mb) {
      mb.setAttribute('aria-controls', 'p5-menu-list');
      mb.setAttribute('aria-expanded', 'false');
      mb.addEventListener('click', (e) => {
        e.preventDefault();
        setMenu(!document.body.classList.contains('p5-menu-open'));
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') closeMenu();
    });
    if ($('p5-status') && $('page-analytics') && $('page-analytics').classList.contains('active')) renderStatus();
  });

  // showPage／chMonth は同期スクリプトで定義済みなので、ラップはここで即座に行う
  // （11-boot.js が後から参照しても 22 のラップが外側になる）。DOM 依存の初期化は DOMContentLoaded 後。
  try { wrapShowPage(); wrapCal(); } catch (e) { console.warn('[persona2]', e); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
