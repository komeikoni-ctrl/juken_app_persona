# 受験管理アプリ2027「PERSONA版」UI全面刷新 — 実装ブリーフ

作業ディレクトリ: ~/workspace/juken-persona-work/repo
これは既存アプリ（本家）のコピー。本家には一切影響しない。ここでは UI をペルソナ5風に全面刷新する。

## 絶対に守ること
- データ・同期・AI・お金計算のロジックは変更しない。`public/js/` のうち変更してよいのは:
  - `09-misc.js`: 見た目スタイル関連の関数群（UI_STYLES / applyUiStyle / setUiStyle）のみ。それ以外は触らない。
  - `11-boot.js`: 「見た目のスタイル」に関する SelfTest 2件の期待値のみ。それ以外は触らない。
  - `version.js`: APP_VERSION を 'persona-1.0' にする。
  - `sw.js`: キャッシュ名の接頭辞と PRECACHE への追加のみ。
  - 新規ファイル `public/js/21-persona.js` を作ってよい。
- その他の JS ファイル（00〜08, 10, 12〜20）は **一切変更禁止**。
- ページ遷移・レンダリング関数の名前や引数、onclick 属性の中身は変えない（テストとJSが依存している）。
- 横はみ出し（scrollWidth > innerWidth）を絶対に作らない。傾け・はみ出し装飾は transform の視覚効果に留め、レイアウト幅を広げない。`html,body{overflow-x:clip}` を維持する。

## デザインシステム（ペルソナ5）
- 基調色: 赤 #E60012 / 黒 #0D0D0D / 白 #FFFFFF。背景は白（ダーク時は黒）。差し色に赤のみ（多色化しない）。
- フォント: Google Fonts を <link> で読み込む。
  - 英字ディスプレイ: 'Anton'（極太コンデンスド）
  - 日本語: 'Zen Kaku Gothic New' weight 500/700/900
  - 数値・英字一般: 'Oswald' でも可。基本は Anton + Zen Kaku で統一。
  - フォントが読めない環境では sans-serif にフォールバック（機能に影響させない）。
- 形: 角丸は最小（0〜3px）。代わりに clip-path で角を斜めに切り落とす（右上と左下など）。太い黒枠 2.5〜3px。影はぼかさず **オフセットのハードシャドウ**（例: 6px 6px 0 #0D0D0D）。
- 見出し: 黒地に白文字（または赤地に白文字）のバナーを -3deg 傾け、Anton の英字を大きく。日本語見出しも太字900で大きく。
- 背景: `public/img/persona-bg-texture.png`（ハーフトーン+赤い斜めストライプ+星、白地）を body の固定背景レイヤーとして敷く。ただし本文の可読性を最優先し、白のグラデーション/半透明オーバーレイでテクスチャは「端に効く」程度に抑える。カード自体は不透明の白（ダーク時は #161616）で文字が読みやすいこと。
- ダークテーマ（html[data-theme="dark"]）でも成立させる: 背景は黒、カードは濃いグレー、枠は白または赤、文字は白。テクスチャ画像は opacity を落として敷く。

## ナビゲーション刷新（index.html の <nav class="top-nav">）
- 構造は変えるが制約あり: `<nav class="top-nav">` の中に全ページ分の `<button class="nav-btn" onclick="showPage('id',this)">` を残す（SelfTest が `.top-nav` と `onclick*="'id'"` で探す）。id は home/timer/calendar/uni/apply/analytics/sunzemi/aicoach/money/settings の10個。バッジ span（id="nb-home" 等）も残す。
- 各ボタンに英字ラベルを追加: `<span class="nav-en">HOME</span>` のような要素を入れ、日本語ラベルと併記する。英字対応: HOME/TIMER/CALENDAR/UNIVERSITY/APPLY/ANALYTICS/SUNDAI/AI COACH/MONEY/SETTINGS。
- `.app-logo` はロゴ画像 `img/persona-logo.png`（あれば）+「受験管理2027」の組み合わせに変える。画像が無い場合でも崩れないようにする（img に onerror で隠す等は不要。後で配置される前提で参照だけ入れる。ただし alt は付ける）。
- レイアウト:
  - 幅 900px 以上: 左固定サイドバー（幅 236px、黒背景）。ロゴは上部に大きく。ボタンは縦積み・全幅・左寄せ、英字を大きく（Anton 20px程度）、日本語は小さく添える。アクティブは赤背景・白文字・右に少し突き出す（transform: translateX）。`.main` は margin-left: 236px。
  - 幅 900px 未満: 上部バー（黒背景、横スクロール可）。ボタンは横並び、英字は小さめ、日本語主体。現行の横スクロール挙動（ナビ内だけスクロール）を維持。
- `#nav-indicator` は display:none にする（アクティブ表現はボタン自体の背景でやる）。

## CSS の作り方
- `public/index.html` の <style> 内、既存CSS の **末尾に「PERSONA」セクションを追加** する形で実装する（既存セレクタへの上書きで全コンポーネントを変える）。既存の data-style（glass/pop/modern）向けルールは、html[data-style="persona"] のルールが後に来て勝つようにする。基本は `html[data-style="persona"]` スコープで書き、レイアウト構造（サイドバー化など）も同スコープで行う。
- 対象コンポーネントは漏れなく: .card / .card-hdr / .page-title / .page-hdr / .btn (.btn-p/.btn-s/.btn-sm) / .seg-row とその .btn / .badge / .tag系 / input・select・textarea / テーブル / .mo（モーダル）と .mo-card 等モーダル内部品 / .toast / プログレスバー（.bar や [role=progressbar] 的な要素は実際のクラス名をコードで確認）/ カレンダーのセル / チャットの吹き出し / タイマーの大きな数字 / グラフの囲み / .empty / リスト項目 / チェックボックス・トグル類。実際に使われているクラス名は index.html と js ファイル群を grep して確認すること。
- 数値表示（残高・タイマー・カウントダウン）は Anton/Oswald で大きく。
- ホーム先頭にヒーローバナーを追加する（#page-home の .page-hdr の後あたりに静的HTML）: ロゴ画像（img/persona-logo.png）と「TAKE YOUR TIME ★」の英字、赤い斜め帯を含む装飾ブロック。renderHome が触る id は避け、新規 id/class（p5-hero）にする。

## モーション（public/js/21-persona.js + CSS）
- ページ遷移ワイプ: window.showPage をラップし、遷移時に画面全体を赤と黒の斜めパネルがサッと横切るオーバーレイ（#p5-wipe、index.html に要素を追加）を 450ms 程度で再生してから本来の showPage を呼ぶ。初回起動時は再生しない。連打されても壊れない（再生中は即時実行にフォールバック）。
- 登場アニメーション: .page.active 内の直下カード等が、斜め下から少し回転して入る（animation、nth-child で最大8個まで遅延）。transform のみ。
- 星バースト: ナビボタンのクリック位置から ★ が数個飛ぶ（span を生成してアニメーション後に削除）。やりすぎない大きさ・数（5個程度）。
- ホバー（pointer:fine のみ）: .card が少し浮く（translate + ハードシャドウ拡大）。
- ボタン押下: :active で translate(2px,2px) + 影縮小。
- `@media (prefers-reduced-motion: reduce)` ではワイプ・バースト・登場アニメーションを無効化。
- 21-persona.js は index.html の script 群で 11-boot.js の **直前** に読み込む。sw.js の PRECACHE に './js/21-persona.js' と './img/persona-bg-texture.png' と './img/persona-logo.png' を追加。

## スタイル固定（09-misc.js）
- UI_STYLES を persona 1つだけにする: { id:'persona', name:'🎭 ペルソナ', desc:'ペルソナ5風・専用デザイン' }。
- applyUiStyle は常に data-style="persona" を付け、style-pick ボックスには persona のボタンを1つだけ描く（押しても何も起きなくてよい見た目にするか、現状維持の表示にする）。
- **重要**: setUiStyle は S.userStyle を書き換えない（本家とプロフィールを共有しているため、本家の設定を壊さない）。setUiStyle('persona') が呼ばれても S.userStyle には触らず、applyUiStyle('persona') だけ呼ぶ。DbService.setMainProfile() も呼ばない。
- 起動時に applyUiStyle(S.userStyle) と呼ばれても persona になるよう、applyUiStyle は引数を無視して persona を適用してよい（ただし style-pick の描画は維持）。

## SelfTest 書き換え（11-boot.js）
- 「見た目のスタイル: ぷっくりポップの切替」と「見た目のスタイル: すっきりモダンが増えて…」の2件を、persona 前提の内容に書き換える:
  - UI_STYLES が persona のみ（length 1、id 'persona'）であること
  - applyUiStyle('pop') 等何を渡しても data-style="persona" になること
  - テスト後に applyUiStyle(S.userStyle) で戻す既存パターンは維持
- 他の SelfTest には触らない。

## その他
- manifest.json: name を「受験管理アプリ 2027 PERSONA」、short_name「受験PERSONA」、theme_color「#E60012」、background_color「#0D0D0D」にする。
- <title> を「受験管理アプリ2027 ★ PERSONA」に。
- index.html の <head> にフォントの preconnect と stylesheet リンクを追加。
- 作業後に全 JS ファイルへ node --check を通すこと（public/js/*.js, public/sw.js）。
- 変更はこの repo 内だけ。git 操作はしない（コミット不要、ファイル編集のみ）。
