'use strict';

// 人生の画面：じぶん・査定・オファー・経歴書と、役職ごとに開く画面と操作の決まり

const TAB_NEED = { roster: 'roster', order: 'roster', train: 'train', money: 'front', trade: 'front', fa: 'front', prospects: 'front' };
function tabAllowed(k) { return !TAB_NEED[k] || hasControl(TAB_NEED[k]); }

const ACT_NEED = {
  promote: 'roster', demote: 'roster', autoActive: 'roster', autoOrder: 'roster', osel: 'roster', ofield: 'roster', rsel: 'roster', lmove: 'roster', tactic: 'roster',
  lpos: 'roster', lplayer: 'roster', rot: 'roster', closer: 'roster', setup: 'roster',
  intensity: 'train', focus: 'train', tryTwoWay: 'train', dropTwoWay: 'train',
  release: 'front', upgrade: 'front', downgrade: 'front', promo: 'front', devGoods: 'front', stopGoods: 'front', scoutForeign: 'front', signFA: 'front', signForeign: 'front', propose: 'front',
  retain: 'front', retireNo: 'front', faBid: 'front', faBidCancel: 'front', faMul: 'front', faYears: 'front', draftBid: 'front', draftPick: 'front', draftPass: 'front', faComp: 'front',
};
function actionAllowed(a, el) {
  if (!S || !ACT_NEED[a]) return true;
  if (!hasControl(ACT_NEED[a])) return false;
  // コーチは自分の受け持ちの選手だけ（投手コーチなら投手）
  const p = ACT_NEED[a] === 'train' && el && el.dataset.pid ? S.players[+el.dataset.pid] : null;
  return !p || coachCanTouch(p);
}

function lifeBar(v, mark) {
  return `<div class="life-bar"><span style="width:${U.clamp(v, 0, 100)}%"></span>${mark != null ? `<i style="left:${mark}%"></i>` : ''}</div>`;
}

function repWord(r) { return r >= 75 ? '球界の顔' : r >= 55 ? '名の通った人' : r >= 35 ? 'そこそこ知られている' : r >= 15 ? '知る人ぞ知る' : 'ほぼ無名'; }

// ホームに出す、いまの仕事のひと目
function careerStrip() {
  const j = S.me.job;
  if (!j) return '';
  const t = S.teams[j.teamId], m = missionNow(j, t);
  return `<section class="card"><div class="row"><h2>${h(t.short)}の${h(j.title)}</h2><button class="sm" data-act="tab" data-tab="career">くわしく</button></div>
    <div>信頼度 <b>${Math.round(j.trust)}</b>（解任の目安 ${fireLine(t)}）${lifeBar(j.trust, fireLine(t))}</div>
    <div>ノルマ：<b>${h(j.mission ? j.mission.text : '-')}</b> <span class="${m.ok ? 'win' : 'lose'}">${h(m.now)}</span></div></section>`;
}

function renderJobCard() {
  const me = S.me, j = me.job;
  if (!j) return '';
  const t = S.teams[j.teamId], m = missionNow(j, t), o = OWNER_TYPES[t.owner.type];
  const reqOk = !hasControl('front');
  return `<section class="card" style="border-top:4px solid ${t.color}"><h2>いまの仕事：${h(t.name)}の${h(j.title)}</h2>
    <div class="life-kv">
      <div><small>オーナー</small>${h(t.owner.name)}（${o.name}・我慢強さ ${'★'.repeat(t.owner.patience)}）</div>
      <div><small>契約</small>残り ${Math.max(0, j.yearsLeft)}年 ・ 「${h(j.pkg)}」</div>
      <div><small>年俸</small>${U.money(j.salary)}</div>
      <div><small>ボーナス</small>ノルマ達成 +${Math.round(BONUS_MISSION * 100)}% ・ 日本一 +${Math.round(BONUS_JP * 100)}%</div>
      <div><small>発言力</small>${j.voice}</div>
    </div>
    <div>信頼度 <b>${Math.round(j.trust)}</b>（赤い線を下回ると解任。目安 ${fireLine(t)}）${lifeBar(j.trust, fireLine(t))}</div>
    <p>今季のノルマ：<b>${h(j.mission ? j.mission.text : '-')}</b> <span class="${m.ok ? 'win' : 'lose'}">${h(m.now)}</span></p>
    <p class="muted small">${h(o.desc)}。この球団の戦力は開幕前の見立てでリーグ${j.exp}位です。あなたの仕事は「${{ manager: '一軍・オーダー・采配', pcoach: '投手の練習方針と、投手ごとの重点', bcoach: '野手の練習方針と、野手ごとの重点', gm: 'トレード・FA・ドラフト・経営' }[j.role]}」で、ほかは球団の人が動かします。</p>
    ${reqOk ? `<p><label>フロントへの要望：<select data-chg="request">${Object.keys(REQUESTS).map(k => `<option value="${k}" ${me.request === k ? 'selected' : ''}>${REQUESTS[k]}</option>`).join('')}</select></label>
      <span class="muted small">発言力と信頼度が高いほど通ります。</span></p>` : ''}
    <p class="muted small">解任されると、残りの契約の年俸は ${Math.round(FIRE_PAYOUT * 100)}% だけ受け取れます。辞任すると受け取れません。</p>
    <p><button class="sm danger" data-act="careerResign">辞任する</button></p>
  </section>
  ${renderStaff()}`;
}

// 代表の監督の打診
function renderNatOffer() {
  const me = S.me, o = me.natOffer;
  if (!o) return '';
  return `<section class="card"><h2>🎌 ${NATIONAL_NAME}の監督の打診</h2>
    <p>${o.y}年の国際大会まで、代表の監督に専念してほしいという話です。${me.job ? '<b>いまの球団の仕事は辞めることになります。</b>' : ''}</p>
    <p class="muted small">報酬 ${U.money(NAT_PAY.manager)}（優勝すると倍）。大会のあとは、また球団の話を待ちます。ほかの話を受けると、この話は流れます。</p>
    <p><button class="primary" data-act="acceptNational">受ける</button> <button data-act="declineNational">断る</button></p></section>`;
}

function renderOffers() {
  const me = S.me, nat = renderNatOffer();
  if (!me.offers.length) return nat;
  return `${nat}<section class="card"><h2>📨 届いた話</h2>
    ${me.offers.map((o, i) => {
    const t = S.teams[o.teamId];
    const w = OWNER_TYPES[t.owner.type];
    const tag = o.renew ? '<span class="tag">続投</span>' : o.hero ? '<span class="tag">古巣から</span>' : o.natFame ? `<span class="tag">${NATIONAL_NAME}の実績で</span>` : (me.ties[t.short] ? `<span class="tag">縁あり ${me.ties[t.short]}年</span>` : '');
    return `<div class="offer" style="--c:${t.color}"><h3>${h(t.name)}の${h(o.title)} ${tag}</h3>
      <div class="muted small">オーナー：${w.name}・我慢強さ ${'★'.repeat(t.owner.patience)} ／ 人気 ${Math.round(t.pop)} ／ 今季 ${LEAGUE_NAME[t.lg]}${rankOf(t.id)}位 ／ 戦力の見立て ${strengthRank(t)}位</div>
      <div class="pkgs">${packagesOf(o).map((pk, p) => `<div class="pkg"><b>${pk.name}</b>：${pk.years}年・年俸 ${U.money(pk.salary)}<br><span class="muted">${pk.desc}</span>
        <button data-act="acceptOffer" data-i="${i}" data-p="${p}">この条件で受ける</button></div>`).join('')}</div></div>`;
  }).join('')}
    <p><button data-act="declineOffers">${me.job ? 'どの話も受けない' : 'どの話も受けず、1 年待つ'}</button></p>
  </section>`;
}

// 国際大会の画面に出す、代表の監督・コーチ
function renderNationalStaff(I) {
  if (!I.staff) return '';
  const rows = ['manager', 'pcoach', 'bcoach'].map(r => {
    const s = I.staff[r];
    return `<tr class="${s.me ? 'me' : ''}"><th>${ROLES[r].name}</th><td class="l">${h(s.name)}${s.me ? '（じぶん）' : ''}</td></tr>`;
  }).join('');
  return `<h3>${NATIONAL_NAME}の監督・コーチ</h3><table class="tbl">${rows}</table>`;
}
// 代表の経歴
function renderNatLog() {
  const hide = pbpUnseenKind('intl'); // 決勝を見るまで、今年の結果は出さない
  const list = (S.me.natLog || []).filter(n => !(hide && n.y === S.year));
  if (!list.length) return '';
  return `<section class="card"><h2>🎌 ${NATIONAL_NAME}の経歴</h2><div class="scroll"><table class="tbl"><tr><th>年</th><th>仕事</th><th>結果</th><th>報酬</th></tr>
    ${list.slice().reverse().map(n => `<tr><td>${n.y}</td><td>${h(n.title)}</td><td>${h(n.result)}</td><td>${U.money(n.pay)}</td></tr>`).join('')}</table></div></section>`;
}

// 自分年表：できごとと、年ごとの成績を 1 本に並べる。n を渡すと新しいほうから n 件だけ
const TL_ORDER = { move: 0, out: 0, retire: 0, job: 0, fired: 0, end: 0, season: 1 }; // 同じ年の中の並び（オフのできごと → 成績 → その年の記録）
function timelineItems() {
  const me = S.me, items = [];
  const hideNat = pbpUnseenKind('intl'); // 決勝を見るまで、代表の結果を年表で明かさない
  (me.events || []).forEach(e => { if (!(hideNat && e.kind === 'nat' && e.y === S.year && /国際大会/.test(e.text))) items.push({ ...e }); });
  me.diary.forEach(d => {
    const line = d.first ? [d.pit, d.bat].filter(Boolean).join(' ／ ') : '二軍（一軍の出場なし）';
    items.push({ y: d.y, age: d.age, kind: 'season', chip: d.team, color: d.color, text: `${line} ・ 総合${d.ovr} ・ 年俸${U.money(d.salary)}` });
  });
  me.log.forEach(r => {
    items.push({ y: r.y, age: r.y - me.birthYear, kind: 'season', chip: r.team, color: r.color, text: `${r.title} ${r.w}勝${r.l}敗${r.d ? r.d + '分' : ''} ${r.rank}位${r.post ? ` ${r.post}` : ''} ・ ノルマ${r.ok ? '達成' : '未達'} ・ 信頼度${r.trust}` });
  });
  const rank = e => (TL_ORDER[e.kind] != null ? TL_ORDER[e.kind] : 2);
  return items.map((e, i) => ({ e, i })).sort((a, b) => b.e.y - a.e.y || rank(a.e) - rank(b.e) || b.i - a.i).map(x => x.e);
}
function timelineRows(n) {
  const list = timelineItems();
  const shown = n ? list.slice(0, n) : list;
  return `<ol class="tl">${shown.map(e => `<li class="tl-${e.kind}"><span class="tl-when">${e.y}${e.off && (e.kind === 'move' || e.kind === 'out') ? 'オフ' : ''}<small>${e.age}歳</small></span><span class="tl-ic">${e.kind === 'season' ? '📊' : LIFE_ICON[e.kind] || '・'}</span><span class="tl-text">${e.chip ? `<span class="chip" style="background:${e.color}">${h(e.chip)}</span> ` : ''}${h(e.text)}</span></li>`).join('')}</ol>`;
}
// 現役の通算成績（引退したあとは記録から）
function careerTotals() {
  const me = S.me, p = mePlayer();
  const c = me.card ? me.card.total : p ? careerTotal(p) : null;
  if (!c) return '';
  const pit = me.card ? me.card.pit : canPitch(p), bat = me.card ? me.card.bat : canBat(p);
  const parts = [];
  if (pit && c.pg) parts.push(`${c.pg}登板 ${c.w}勝${c.l}敗${c.sv ? c.sv + 'S' : ''} 防御率${U.era(c.per, c.outs)} ${c.pk}奪三振`);
  if (bat && c.pa) parts.push(`${c.g}試合 打率${U.avg(c.h, c.ab)} ${c.h}安打 ${c.hr}本塁打 ${c.rbi}打点 ${c.sb}盗塁`);
  return parts.length ? `<p class="tl-total"><b>通算</b> ${h(parts.join(' ／ '))}</p>` : '<p class="tl-total muted">通算：一軍の出場なし</p>';
}
function renderTimeline() {
  if (!(S.me.events || []).length) return '';
  return `<section class="card"><h2>📅 じぶん年表</h2>${careerTotals()}${timelineRows()}</section>`;
}

function renderDiary() {
  const me = S.me;
  if (!me.diary.length) return '';
  const rows = me.diary.slice().reverse().map(d => `<tr><td>${d.y}</td><td>${d.age}</td><td>${d.team ? `<span class="chip" style="background:${d.color}">${h(d.team)}</span>` : '<span class="muted">無所属</span>'}</td>
    <td>${d.first ? '一軍' : '<span class="muted">二軍</span>'}</td><td>${d.ovr}</td><td class="l">${h([d.pit, d.bat].filter(Boolean).join(' ／ ')) || '-'}</td><td>${U.money(d.salary)}</td><td class="l">${h(d.notes.join('、'))}</td></tr>`).join('');
  const c = me.card;
  return `<section class="card"><h2>⚾ 現役時代</h2>
    ${c ? `<p><b>${h(c.pos)}</b> ・ ${h(c.draft)} ・ ${h(c.teams.join('→') || '-')} ・ ${me.retireYear}年に${c.age}歳で引退</p>
      ${c.pit ? `<p>通算 ${c.total.pg}登板 ${c.total.w}勝${c.total.l}敗${c.total.sv ? c.total.sv + 'S' : ''} 防御率${U.era(c.total.per, c.total.outs)} ${c.total.pk}奪三振</p>` : ''}
      ${c.bat ? `<p>通算 ${c.total.g}試合 打率${U.avg(c.total.h, c.total.ab)} ${c.total.h}安打 ${c.total.hr}本塁打 ${c.total.rbi}打点 ${c.total.sb}盗塁</p>` : ''}
      ${c.titles.length ? `<p>タイトル：${h(c.titles.join('、'))}</p>` : ''}${c.ms.length ? `<p>達成：${h(c.ms.join('、'))}</p>` : ''}` : ''}
    <div class="scroll"><table class="tbl"><tr><th>年</th><th>歳</th><th>球団</th><th></th><th>総合</th><th>成績</th><th>年俸</th><th>できごと</th></tr>${rows}</table></div></section>`;
}

function renderJobLog() {
  const me = S.me;
  if (!me.log.length) return '';
  const rows = me.log.slice().reverse().map(r => `<tr><td>${r.y}</td><td><span class="chip" style="background:${r.color}">${h(r.team)}</span></td><td>${h(r.title)}</td><td>${r.w}勝${r.l}敗${r.d ? r.d + '分' : ''}</td><td>${r.rank}位${r.post ? ` ${h(r.post)}` : ''}</td>
    <td class="l">${h(r.mission)} <span class="${r.ok ? 'win' : 'lose'}">${r.ok ? '達成' : '未達'}</span></td><td>${r.trust}</td><td>${r.end ? `<b class="${/解任/.test(r.end) ? 'neg' : ''}">${h(r.end)}</b>` : ''}</td></tr>`).join('');
  return `<section class="card"><h2>📋 指導者・フロントの経歴</h2><div class="scroll"><table class="tbl"><tr><th>年</th><th>球団</th><th>仕事</th><th>勝敗</th><th>順位</th><th>ノルマ</th><th>信頼</th><th></th></tr>${rows}</table></div></section>`;
}

function renderCareer() {
  const me = S.me, p = mePlayer();
  const head = `<section class="card"><h2>${h(me.name)} <small class="muted">${myAge()}歳 ・ ${h(careerLabel())}</small></h2>
    <div class="life-kv">
      <div><small>評判</small>${me.phase === 'player' ? 'まだこれから' : `${Math.round(me.rep)}（${repWord(me.rep)}）`}</div>
      <div><small>スコア（これまでの収入）</small><b>${U.money(me.earned)}</b></div>
      <div><small>うち現役／仕事</small>${U.money(me.earnedPlayer || 0)} ／ ${U.money(me.earnedJob || 0)}</div>
      <div><small>解任された回数</small>${me.fired}回</div>
      <div><small>${NATIONAL_NAME}（選手）</small>${natPlayerCount()}回</div>
      ${me.phase === 'free' && !me.natDuty ? `<div><small>無職の年数</small>${me.jobless}年（${JOBLESS_END}年話がないと引退）</div>` : ''}
    </div></section>`;
  let main = '';
  if (me.phase === 'player' && p) {
    const t = p.teamId != null ? S.teams[p.teamId] : null;
    main = `<section class="card"><h2>現役選手</h2>
      <p>${t ? `${teamChip(t)} ${isActive(t, p) ? '一軍' : '二軍'}` : '所属球団なし（自由契約）'} ・ ${h(draftLabel(p))}</p>
      <div>${nameCell(p)} ・ 総合 <b>${Math.round(ovr(p))}</b> ・ 才能 <span class="stars">${potStars(p.pot)}</span> ・ ${p.age}歳</div>
      <div class="pc-abil">${abilSum(p)}</div>
      ${p.stats.g || p.stats.pg ? `<p class="muted">今季：${h(statLine(p))}</p>` : ''}
      <p><button class="primary big" data-act="lifeYear">次の 1 年へ ▶</button> <button data-act="lifeRetire">引退まで飛ばす ⏭</button></p></section>`;
  } else if (me.natDuty) {
    main = `<section class="card"><h2>🎌 ${NATIONAL_NAME}の監督</h2><p>${me.natDuty.y}年の国際大会に向けて、代表に専念しています。</p>
      <p><button class="primary big" data-act="lifeYear">${S.phase === 'off' ? '次のシーズンへ ▶' : '国際大会へ ▶'}</button></p></section>`;
  } else if (me.phase === 'free') {
    const v = me.verdict;
    main = `${v ? `<div class="verdict ${v.kind === 'fired' ? 'fired' : ''}">${h(v.text)}</div>` : ''}
      ${renderOffers()}
      ${me.offers.length ? '' : `<section class="card"><h2>無職</h2><p>いまは解説の仕事でしのいでいます。空いた席があれば、話が来るかもしれません。</p>
        <p><button class="primary big" data-act="lifeYear">${S.phase === 'off' ? '次のシーズンへ ▶' : 'シーズンの終わりまで ▶'}</button>
        <button class="danger" data-act="careerQuit">野球の世界を離れる</button></p></section>`}`;
  } else {
    main = renderJobCard();
  }
  return head + main + renderTimeline() + renderNatLog() + renderJobLog() + renderDiary() + `<section class="card"><h2>ニュース</h2>${newsList(10)}</section>`;
}

// いまの球団のスタッフ
function renderStaff() {
  const t = myTeam(), me = S.me;
  const rows = ROLE_KEYS.map(r => {
    const s = S.staff[t.id][r];
    if (!s) return `<tr><td class="l">${ROLES[r].name}</td><td class="l muted" colspan="4">空席</td></tr>`;
    if (s.me) return `<tr class="me"><td class="l">${ROLES[r].name}</td><td class="l">${h(me.name)}（じぶん）</td><td>${myAge()}</td><td>${U.money(me.job.salary)}</td><td>${Math.max(0, me.job.yearsLeft)}年</td></tr>`;
    return `<tr><td class="l">${ROLES[r].name}</td><td class="l">${h(s.name)}${s.mate ? ' <span class="tag">元同僚</span>' : ''}</td><td>${s.age}</td><td>${U.money(s.salary || 0)}</td><td>${Math.max(0, s.yearsLeft || 0)}年</td></tr>`;
  }).join('');
  return `<section class="card"><h2>${h(t.short)}のスタッフ</h2><div class="scroll"><table class="tbl"><tr><th class="l">仕事</th><th class="l">名前</th><th>歳</th><th>年俸</th><th>契約</th></tr>${rows}</table></div></section>`;
}

function renderScores() {
  const list = loadScores();
  if (!list.length) return '';
  return `<h3>🏅 生涯収入ランキング</h3><div class="scroll"><table class="tbl"><tr><th>順</th><th class="l">名前</th><th>スコア</th><th>現役</th><th class="l">仕事</th><th>日本一</th><th>解任</th><th>去った歳</th><th>試合数</th></tr>
    ${list.map((r, i) => `<tr><td>${i + 1}</td><td class="l">${h(r.name)}</td><td><b>${U.money(r.score)}</b></td><td>${r.years}年</td><td class="l">${h(r.jobs || 'なし')}</td><td>${r.jp}</td><td>${r.fired}</td><td>${r.age}</td><td>${r.games}</td></tr>`).join('')}</table></div>`;
}

// オフの査定の画面（仕事があるとき）。解任されたら無職の画面に移る
function renderReview() {
  const me = S.me, j = me.job, v = me.verdict;
  if (!j) return renderCareer();
  const t = S.teams[j.teamId], last = me.log[me.log.length - 1];
  return `<section class="card"><h2>📝 ${S.year}年の査定</h2>
    ${last ? `<p>${h(t.short)} ${last.w}勝${last.l}敗 ${LEAGUE_NAME[t.lg]}${last.rank}位${last.post ? ` ・ ${h(last.post)}` : ''}</p>
    <p>ノルマ「${h(last.mission)}」：<b class="${last.ok ? 'win' : 'lose'}">${last.ok ? '達成' : '未達'}</b></p>` : ''}
    <div>信頼度 <b>${Math.round(j.trust)}</b>（解任の目安 ${fireLine(t)}）${lifeBar(j.trust, fireLine(t))}</div>
    <div>評判 <b>${Math.round(me.rep)}</b>（${repWord(me.rep)}）${lifeBar(me.rep)}</div>
    ${v ? `<div class="verdict">${h(v.text)}</div>` : ''}
  </section>
  ${renderOffers()}
  ${v && v.kind === 'renew' && me.offers.some(o => o.renew) ? '<p class="muted">続投するなら、上の「続投」の話から条件を選んでください。</p>' : ''}
  <section class="card"><button class="primary big" data-act="careerNext">${j.yearsLeft <= 0 ? '契約を終えて次へ ▶' : hasControl('front') ? 'FAへ ▶' : '球団に任せてオフを進める ▶'}</button></section>`;
}

// 球団に任せたオフに、何が起きたか
function offSummary() {
  const O = S.off, t = myTeam();
  const fa = ((O.fa && O.fa.results) || []).filter(r => r.note !== '宣言残留' && (r.to === t.id || r.from === t.id) && r.to !== r.from);
  const dr = ((O.draft && O.draft.result) || []).filter(r => r.team === t.id).sort((a, b) => a.round - b.round);
  return `<div class="grid2"><div><h3>FA の動き</h3>${fa.length ? `<ul>${fa.map(r => `<li>${h(r.name)}：${r.to === t.id ? `${h(S.teams[r.from].short)}から獲得` : `${h(S.teams[r.to].short)}へ流出`}</li>`).join('')}</ul>` : '<p class="muted">ありません</p>'}</div>
    <div><h3>ドラフト</h3>${dr.length ? `<ul>${dr.map(r => `<li>${r.round}位 ${h(r.name)}（${h(r.kind)}・${h(r.pos)}）</li>`).join('')}</ul>` : '<p class="muted">ありません</p>'}</div></div>`;
}

// 監督の采配方針（オーダーの画面の上）
function renderTactic() {
  const tc = myTeam().tactic || {};
  const seg = (k, names) => `<span class="seg">${names.map(n => `<button class="${(tc[k] || '普通') === n ? 'on' : ''}" data-act="tactic" data-k="${k}" data-v="${n}">${n}</button>`).join('')}</span>`;
  return `<section class="card"><h2>采配方針</h2>
    <p>走塁：${seg('steal', Object.keys(TACTIC_STEAL))} ・ 投手の交代：${seg('hook', Object.keys(TACTIC_HOOK))}</p></section>`;
}

function renderNotices(list) {
  return `<div class="notice-box">${list.map(n => `<h2>${h(n.title)}</h2><p><b>${h(n.text)}</b></p>${n.sub ? `<p class="muted">${h(n.sub)}</p>` : ''}`).join('<hr>')}
    ${list.some(n => n.timeline) ? `<h3>じぶん年表</h3><div class="tl-mini">${careerTotals()}${timelineRows(6)}</div>` : ''}
    <p><button class="primary big" data-act="closeModal">閉じる</button></p></div>`;
}

// 人生の経歴書
function renderResume() {
  const me = S.me;
  const by = {};
  me.log.forEach(r => { by[r.title] = (by[r.title] || 0) + 1; });
  const jp = me.log.filter(r => r.jp).length;
  return `<div class="resume title"><h1>📜 ${h(me.name)} の野球人生</h1>
    <p class="sub">${me.birthYear}年生まれ ・ ${me.endAge}歳で球界を去る ・ ${h(me.endWhy || '')}</p>
    <section class="card"><h2>スコア（生涯収入）：${U.money(me.earned)}${me.scoreRank && me.scoreRank <= SCORE_TOP ? ` ・ このブラウザで ${me.scoreRank}位` : ''}</h2>
      <p class="muted">現役 ${U.money(me.earnedPlayer || 0)} ＋ 仕事 ${U.money(me.earnedJob || 0)}</p>
      <div class="life-kv">
        <div><small>現役</small>${me.diary.length}年</div>
        <div><small>仕事</small>${h(Object.keys(by).map(k => `${k} ${by[k]}年`).join('、') || 'なし')}</div>
        <div><small>日本一（仕事で）</small>${jp}回</div>
        <div><small>解任</small>${me.fired}回</div>
        <div><small>最後の評判</small>${Math.round(me.rep)}（${repWord(me.rep)}）</div>
      </div>
      <p><button data-act="toTitle">タイトルへ戻る</button></p>
    </section>
    ${renderTimeline()}${renderNatLog()}${renderJobLog()}${renderDiary()}</div>`;
}
