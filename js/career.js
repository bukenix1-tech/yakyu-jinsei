'use strict';

// 1 人の野球人の人生：現役時代 → 引退 → 届いた話から仕事を選ぶ（監督・コーチ・GM）→ 評価 → 続投／解任／引き抜き → 次の仕事へ
// S.myTeamId は「いま追っている球団」。操作できる範囲は役職で決まる（hasControl）
// ここの数値はすべて仮（AI）。tools/測定.html で測って、人が決める

const ROLES = {
  manager: { name: '監督', can: 'roster', base: 10000, need: 25, w: { win: 1, grow: 0.15, money: 0, pop: 0.25 } },
  pcoach:  { name: '投手コーチ', can: 'train', side: 'pit', base: 2500, need: 0, w: { win: 0.25, grow: 1, money: 0, pop: 0.05 } },
  bcoach:  { name: '野手コーチ', can: 'train', side: 'bat', base: 2500, need: 0, w: { win: 0.25, grow: 1, money: 0, pop: 0.05 } },
  gm:      { name: 'GM', can: 'front', base: 8000, need: 20, w: { win: 0.6, grow: 0.35, money: 0.6, pop: 0.15 } },
};
const ROLE_KEYS = Object.keys(ROLES);
const OWNER_TYPES = {
  win:   { name: '勝利至上', desc: 'とにかく勝て' },
  grow:  { name: '育成重視', desc: '若い選手を育てろ' },
  money: { name: '黒字第一', desc: '赤字は許さない' },
  pop:   { name: '人気第一', desc: 'お客さんを呼べ' },
};
const OWNER_EXTRA = 0.4;       // オーナーの好みの項目に足す重み
const TRUST_START = 50, TRUST_SCORE = 22, TRUST_OK = 8, TRUST_NG = -12, TRUST_RENEW = 45, TRUST_LAST = 10, TRUST_DRIFT = 4;
const OWNER_CHANGE = 0.08, OWNER_NEW_TRUST = 15, RENEW_AGE = 70; // オーナーの交代の確率と、そのとき下がる信頼度。この歳からは更新されない
const FIRE_BASE = 32, FIRE_PATIENCE = 3; // 信頼度がこれ（我慢強さで下がる）を切ると解任
const TALK_AT = [0.33, 0.6, 0.85], TALK_GAIN = 6;
const REP_SCORE = 6, REP_MISSION = 2, REP_JP = 8, REP_LG = 4, REP_FIRED = -8, REP_RESIGN = -5, REP_LEFT = -3, REP_JOBLESS = -3;
const OFFER_MAX = 5, JOBLESS_END = 3, AGE_END = 75;
const PACKAGES = [
  { k: 'safe', name: '安定', years: 3, pay: 0.85, lv: 0, voice: 20, desc: '長く、安く、ノルマは軽い' },
  { k: 'std',  name: '標準', years: 2, pay: 1,    lv: 1, voice: 40, desc: 'ふつうの条件' },
  { k: 'bold', name: '勝負', years: 1, pay: 1.3,  lv: 2, voice: 70, desc: '短く、高く、ノルマは重い。発言力は強い' },
];
const STAFF_LEAVE = { manager: [0.15, 0.4, 0.75], pcoach: [0.25, 0.35, 0.5], bcoach: [0.25, 0.35, 0.5], gm: [0.2, 0.35, 0.5] }; // 契約が切れたとき、上位・中位・下位の球団で更新されない確率
const STAFF_YEARS = [1, 3], STAFF_MID_FIRE = { manager: 0.15, pcoach: 0.03, bcoach: 0.03, gm: 0.03 }; // AI のスタッフの契約年数と、下位のときの途中解任の確率
const FIRE_PAYOUT = 0.5, BONUS_MISSION = 0.2, BONUS_JP = 0.5; // 解任のとき受け取れる残り年俸の割合と、成果のボーナス（年俸に対する割合）
const SCORE_KEY = 'yakyujin_scores', SCORE_TOP = 10;
const TACTIC_STEAL = { 控えめ: 0.5, 普通: 1, 積極: 1.6 };
const TACTIC_HOOK = { 早め: 0.8, 普通: 1, 粘る: 1.15 };
const REQUESTS = { '': '要望なし', 投手: '投手を補強してほしい', 野手: '野手を補強してほしい', 若手: 'ドラフトは若手を', };
const ME_POT = 0.08, ME_POT_MIN = 0.8, ME_Q = 4;
// 代表の監督・コーチ。選手として代表に選ばれたことがある人から、功績で選ぶ（人の言葉）。監督は専任で、大会の前の年のオフに打診が来る。コーチは大会の年に選ばれ、球団の仕事と兼ねられる
const NATIONAL_NAME = '侍ジャパン';
const NAT_W = { merit: 40, rep: 0.6, jp: 5 }, NAT_JP_MAX = 3; // 選考の点：現役の功績・評判・日本一（仕事で）の重み
const NAT_LINE = { manager: 60, coach: 35 }, NAT_CHANCE = 0.7, NAT_AGE = 70; // この点を超えると、この確率で話が来る。この歳からは選ばれない
const NAT_PAY = { manager: 8000, coach: 1000 }; // 報酬（万円）。優勝すると同じ額のボーナス。監督は専任なので高い
const NAT_FAME = { pay: { manager: 1.3, coach: 1.1 }, champ: 0.1, champMax: 2, extra: { manager: 0.35, coach: 0.12 }, jobMul: 0.5 }; // 代表の経験のあとの監督の話：年俸の倍率、優勝 1 回で足す倍率と数える上限、席が空いていない球団から話が来る確率、仕事があるときに掛ける割合
const NAT_REP = { 優勝: 8, 準優勝: 3, ベスト4: 0, '1次リーグ敗退': -3 }, NAT_REP_COACH = 0.5; // 大会の結果で変わる評判。コーチはこの割合
const KIND_START = { 高校: { age: 18, q: [34, 46], pot: 0.08 }, 大学: { age: 22, q: [42, 54], pot: 0 }, 社会人: { age: 24, q: [46, 58], pot: 0 } };

function hasControl(k) { const m = S.me; return !!(m && m.job && !m.bot && ROLES[m.job.role].can === k); }
function humanRoster(t) { return t.id === S.myTeamId && hasControl('roster'); }
function humanFront(t) { return t.id === S.myTeamId && hasControl('front'); }
function mePlayer() { return S.me && S.me.pid != null ? S.players[S.me.pid] : null; }
function isMe(p) { return !!(S.me && p && S.me.pid === p.id); }
function myAge() { return S.year - S.me.birthYear; }
// コーチは投手か野手のどちらかを受け持つ。元の専門の席だけ話が来る
function myCoachRole() { return S.me.isP ? 'pcoach' : 'bcoach'; }
function coachSide() { const m = S.me; return m && m.job ? ROLES[m.job.role].side || null : null; }
function onSide(p, side) { return !side || (side === 'pit' ? canPitch(p) : canBat(p)); }
function coachCanTouch(p) { return onSide(p, coachSide()); }
function roleTitle(role, rep) {
  const side = ROLES[role].side;
  if (side) return rep < 25 ? `二軍${ROLES[role].name}` : rep < 55 ? `一軍${ROLES[role].name}` : `${side === 'pit' ? '投手' : '野手'}総合コーチ`;
  if (role === 'gm') return rep < 30 ? 'GM補佐' : 'GM';
  return '監督';
}
function careerLabel() {
  const m = S.me;
  if (m.ended) return '引退';
  if (m.natDuty) return `${NATIONAL_NAME}の監督`;
  if (m.job) return `${S.teams[m.job.teamId].short}の${m.job.title}`;
  if (m.phase !== 'player') return '無職';
  const p = mePlayer();
  return p && p.teamId == null ? '現役選手（自由契約）' : '現役選手';
}

// ---------- 年表 ----------
const LIFE_ICON = { start: '🎉', debut: '⚾', title: '🏆', move: '🔁', out: '📄', hurt: '🩹', money: '💰', mile: '🎖️', retire: '👋', job: '🤝', fired: '📰', champ: '👑', end: '📜', nat: '🎌' };
function lifeEvent(text, kind) {
  const me = S.me;
  if (!me.events) me.events = [];
  me.events.push({ y: S.year, age: myAge(), off: S.phase === 'off', text, kind: kind || '' });
}
// 選手として球団が変わったとき。年表に残し、知らせを出す
function careerMoved(p, from, to, how, partner) {
  if (!isMe(p)) return;
  lifeEvent(`${how}で${from.short}から${to.short}へ移籍${partner ? `（交換相手：${partner}）` : ''}`, 'move');
  S.me.notices.push({ title: how === 'トレード' ? '📰 トレード通告' : '📰 移籍', text: `${from.name}から${to.name}へ移ることになりました。`, sub: partner ? `交換相手は${partner}です。` : '', timeline: true });
}
function careerCut(p, from) {
  if (!isMe(p)) return;
  lifeEvent(`${from ? `${from.short}から` : ''}戦力外通告を受け、自由契約に`, 'out');
  S.me.notices.push({ title: '📰 戦力外通告', text: `${from ? from.name : '球団'}から戦力外を告げられました。`, sub: '拾ってくれる球団を待ちます。', timeline: true });
}
function careerSigned(p, t) {
  if (!isMe(p)) return;
  lifeEvent(`自由契約から${t.short}と契約`, 'move');
  S.me.notices.push({ title: '📰 再出発', text: `${t.name}が拾ってくれました。`, sub: '', timeline: true });
}
// 年表の入る前のセーブでは、成績表と経歴から作り直す
function rebuildEvents() {
  const me = S.me;
  if (!me || me.events) return;
  const ev = [], at = (y, text, kind) => ev.push({ y, age: y - me.birthYear, off: false, text, kind });
  const d0 = me.diary[0];
  if (d0) at(d0.y, `${d0.team}に入団`, 'start');
  let debuted = false;
  me.diary.forEach(d => {
    if (d.first && !debuted) { debuted = true; at(d.y, '一軍デビュー', 'debut'); }
    (d.notes || []).forEach(n => at(d.y, n, /移籍/.test(n) ? 'move' : /故障/.test(n) ? 'hurt' : 'title'));
  });
  if (debuted) me.debuted = true;
  if (me.card) at(me.retireYear, `${me.card.age}歳で現役引退`, 'retire');
  let cur = '';
  me.log.forEach(r => {
    const key = r.team + r.title;
    if (key !== cur) at(r.y, `${r.team}の${r.title}に就任`, 'job');
    cur = r.end ? '' : key;
    if (r.jp) at(r.y, `${r.team}が日本一`, 'champ');
    if (r.end) at(r.y, `${r.team}の${r.title}を${r.end}`, /解任/.test(r.end) ? 'fired' : 'job');
  });
  // まだ成績表に載っていない移籍（今の球団がちがう）
  const p = mePlayer(), last = me.diary[me.diary.length - 1];
  if (p && last && p.teamId != null && S.teams[p.teamId].short !== last.team) at(S.year, `${last.team}から${S.teams[p.teamId].short}へ移籍`, 'move');
  me.events = ev;
}

// コーチが 1 つの席だったころのセーブを、投手コーチと野手コーチに分ける
function migrateCoachRoles() {
  const me = S.me;
  if (!me || !S.staff) return;
  const mine = myCoachRole(), other = mine === 'pcoach' ? 'bcoach' : 'pcoach';
  S.teams.forEach(t => {
    const st = S.staff[t.id];
    if (!st || !('coach' in st)) return;
    const s = st.coach;
    delete st.coach;
    if (s && s.me) { st[mine] = s; st[other] = makeStaff(other, t); }
    else { st.pcoach = s; st.bcoach = makeStaff('bcoach', t); }
  });
  (S.vacancies || []).forEach(v => { if (v.role === 'coach') v.role = 'pcoach'; });
  (me.offers || []).forEach(o => { if (o.role === 'coach') { o.role = mine; o.title = roleTitle(mine, me.rep); } });
  if (me.job && me.job.role === 'coach') {
    me.job.role = mine;
    me.job.title = roleTitle(mine, me.rep);
    if (me.job.mission) me.job.mission = makeMission(me.job, S.teams[me.job.teamId]);
  }
  if (me.xp && me.xp.coach != null) { me.xp[mine] = me.xp.coach; me.xp[other] = 0; delete me.xp.coach; }
  (me.log || []).forEach(r => { if (r.role === 'coach') r.role = mine; });
  if (me.lastLeft && me.lastLeft.role === 'coach') me.lastLeft.role = mine;
}

// ---------- 始まり ----------
function staffSalary(role, rep, t) { return Math.round(ROLES[role].base * (0.6 + rep / 100) * (0.7 + t.pop / 100) / 10) * 10; }
function makeStaff(role, t) {
  const pool = S.staffPool || [];
  const pick = pool.length && U.chance(0.6) ? pool.splice(U.rint(0, pool.length - 1), 1)[0] : null;
  const rep = U.rint(25, 70);
  return { name: pick ? pick.name : makeName(), mate: !!(pick && pick.mate), age: U.rint(42, 66), rep, years: 0, salary: staffSalary(role, rep, t), yearsLeft: U.rint(STAFF_YEARS[0], STAFF_YEARS[1]) };
}
// 球団が 1 年に払う、監督・コーチ・GM の年俸（自分の席は自分の契約の額）
function staffPay(t) {
  const me = S.me;
  return U.sum(ROLE_KEYS, r => {
    const s = S.staff && S.staff[t.id] && S.staff[t.id][r];
    if (!s) return 0;
    return s.me ? (me.job && me.job.teamId === t.id && me.job.role === r ? me.job.salary : 0) : (s.salary || 0);
  });
}
// 自分の収入。スコアになるので、現役と仕事に分けて数える
function earn(amount, kind) {
  const me = S.me;
  me.earned += amount;
  if (kind === 'player') me.earnedPlayer = (me.earnedPlayer || 0) + amount;
  else me.earnedJob = (me.earnedJob || 0) + amount;
}

function initCareer(o) {
  S.staff = {}; S.vacancies = []; S.staffPool = [];
  S.teams.forEach(t => {
    t.owner = { name: makeName(), type: U.pick(Object.keys(OWNER_TYPES)), patience: U.rint(1, 5) };
    t.tactic = { steal: '普通', hook: '普通' };
    S.staff[t.id] = {};
    ROLE_KEYS.forEach(r => { const s = makeStaff(r, t); s.years = U.rint(0, 4); S.staff[t.id][r] = s; });
  });
  const K = KIND_START[o.kind] || KIND_START.高校;
  const t = S.teams[S.myTeamId];
  const pot = U.clamp(0.97 + ME_POT + U.gauss() * 0.24 + K.pot, ME_POT_MIN, 1.7);
  const q = U.rnd(K.q[0], K.q[1]) + ME_Q;
  const p = newPlayer(S, { isP: !!o.isP, q, age: K.age, pot });
  p.name = o.name || p.name;
  p.kind = o.kind || '高校';
  p.salary = 600;
  p.svc = 0;
  p.faNeed = p.kind === '高校' ? 8 : 7;
  p.loyalty = U.rint(55, 75);
  const round = U.clamp(Math.round(1 + (K.q[1] + ME_Q - q) / 2 + U.gauss()), 1, DRAFT_ROUNDS);
  p.drafted = { year: S.year - 1, round, team: t.short, note: '', from: '' };
  const worst = teamPlayers(t).filter(x => !t.active.includes(x.id)).sort((a, b) => tradeValue(a) - tradeValue(b))[0];
  if (worst) toFreeAgent(worst);
  signPlayer(t, p);
  S.me = {
    name: p.name, isP: !!o.isP, kind: p.kind, birthYear: S.year - K.age, pid: p.id, phase: 'player', job: null, rep: 0, earned: 0,
    diary: [], log: [], offers: [], jobless: 0, fired: 0, xp: { manager: 0, pcoach: 0, bcoach: 0, gm: 0 }, ties: {}, mates: {}, notices: [], request: '',
    card: null, merit: 0, retireYear: null, justRetired: false, ended: false, verdict: null, bot: !!o.bot, events: [], msDone: [],
  };
  lifeEvent(`${S.year - 1}年ドラフト${round}位で${t.name}に入団`, 'start');
}

// ---------- シーズンの始まりと途中 ----------
function teamStrength(t) {
  const list = teamPlayers(t).map(ovr).sort((a, b) => b - a).slice(0, 25);
  return list.length ? U.sum(list) / list.length : 0;
}
function strengthRank(t) {
  const lg = S.teams.filter(x => x.lg === t.lg).sort((a, b) => teamStrength(b) - teamStrength(a));
  return lg.indexOf(t) + 1;
}

function makeMission(j, t) {
  const type = t.owner.type, lv = j.lv;
  let k = 'rank';
  if (ROLES[j.role].side) k = 'grow';
  else if (j.role === 'manager') k = type === 'grow' ? 'young' : type === 'pop' || type === 'money' ? 'pop' : 'rank';
  else k = type === 'win' ? 'rank' : type;
  const exp = j.exp;
  if (k === 'rank') { const n = U.clamp(exp + [1, 0, -1][lv], 1, 6); return { k, n, text: `リーグ${n}位以内` }; }
  if (k === 'grow') { const n = [8, 5, 3][lv]; return { k, n, text: `若手${ROLES[j.role].side === 'pit' ? '投手' : '野手'}の伸びが 12 球団で${n}位以内` }; }
  if (k === 'young') { const n = [0.12, 0.2, 0.3][lv]; return { k, n, text: `25 歳以下の出場の割合 ${Math.round(n * 100)}% 以上` }; }
  if (k === 'money') { const n = [8, 5, 3][lv]; return { k, n, text: `今季の収支が 12 球団で${n}位以内` }; }
  const n = [0, 2, 5][lv];
  return { k: 'pop', n, text: `球団の人気を ${n} 以上上げる` };
}

function careerSeasonStart() {
  const me = S.me;
  if (!me) return;
  S.growthBase = {};
  S.moneyBase = {};
  S.teams.forEach(t => { S.moneyBase[t.id] = t.money; });
  S.teams.forEach(t => teamPlayers(t).forEach(p => { if (p.age <= 28) S.growthBase[p.id] = ovr(p); }));
  if (!me.job) return;
  const j = me.job, t = S.teams[j.teamId];
  j.exp = strengthRank(t);
  j.moneyStart = t.money; j.popStart = t.pop; j.talk = 0;
  j.mission = makeMission(j, t);
  addNews(`${t.owner.name}オーナー「今季は${j.mission.text}。頼んだぞ」`, 'big');
}

function growthRank(t, side) {
  const score = x => {
    const ds = teamPlayers(x).filter(p => onSide(p, side) && S.growthBase && S.growthBase[p.id] != null).map(p => ovr(p) - S.growthBase[p.id]);
    return ds.length ? U.sum(ds) / ds.length : -99;
  };
  return S.teams.slice().sort((a, b) => score(b) - score(a)).indexOf(t) + 1;
}
function moneyRank(t) {
  const net = x => x.money - ((S.moneyBase && S.moneyBase[x.id]) || 0);
  return S.teams.slice().sort((a, b) => net(b) - net(a)).indexOf(t) + 1;
}
function youngShare(t) {
  let y = 0, all = 0;
  teamPlayers(t).forEach(p => { const v = (p.stats.pa || 0) + (p.stats.outs || 0); all += v; if (p.age <= 25) y += v; });
  return all ? y / all : 0;
}
function fireLine(t) { return FIRE_BASE - t.owner.patience * FIRE_PATIENCE; }

function missionNow(j, t) {
  const M = j.mission;
  if (!M) return { ok: false, now: '' };
  if (M.k === 'rank') { const r = rankOf(t.id); return { ok: r <= M.n, now: `いま${r}位` }; }
  if (M.k === 'grow') { const r = growthRank(t, ROLES[j.role].side); return { ok: r <= M.n, now: `いま${r}位` }; }
  if (M.k === 'young') { const v = youngShare(t); return { ok: v >= M.n, now: `いま${Math.round(v * 100)}%` }; }
  if (M.k === 'money') { const r = moneyRank(t); return { ok: r <= M.n, now: `いま${r}位` }; }
  const v = t.pop - j.popStart;
  const shown = Math.abs(v) < 0.05 ? 0 : v;
  return { ok: v >= M.n, now: `いま${shown >= 0 ? '+' : ''}${shown.toFixed(1)}` };
}

// 開幕から一定の試合ごとの、オーナーとの面談。監督は成績が悪いと途中で休養になる
function careerTick() {
  const me = S.me;
  if (!me || !me.job || S.phase !== 'season') return;
  const j = me.job, t = S.teams[j.teamId];
  const f = gamesPlayed(t) / Math.max(1, S.games);
  if (j.talk >= TALK_AT.length || f < TALK_AT[j.talk]) return;
  j.talk++;
  const r = rankOf(t.id);
  const pace = U.clamp((j.exp - r) / 3 + (pct(t) - 0.5) * 2, -1, 1);
  const d = pace * TALK_GAIN * ROLES[j.role].w.win;
  j.trust = U.clamp(j.trust + d, 0, 100);
  const m = missionNow(j, t);
  const line = j.role === 'manager'
    ? (pace > 0.25 ? '順調だな。この調子で頼む。' : pace < -0.25 ? 'この成績はどういうことだ。説明してもらおう。' : 'まだ分からん。結果で見せてくれ。')
    : (m.ok ? '任せた仕事は順調のようだな。' : '任せた仕事の成果が見えてこないぞ。');
  me.notices.push({ title: '🤝 オーナーとの面談', text: `${t.owner.name}オーナー「${line}」`, sub: `${t.short} ${r}位 ・ 信頼度 ${Math.round(j.trust)}（解任の目安 ${fireLine(t)}）・ ノルマ：${j.mission.text}（${m.now}）` });
  if (j.role === 'manager' && j.trust < fireLine(t) - 5 && r >= 5) {
    me.notices.push({ title: '📰 休養', text: `${t.owner.name}オーナー「成績不振の責任を取ってもらう。明日から来なくていい」`, sub: `監督を解任されました（残りの契約の年俸は ${Math.round(FIRE_PAYOUT * 100)}% 受け取れます）。` });
    leaveJob('解任（途中）');
  }
}

// ---------- シーズンの終わり ----------
function careerEndSeason() {
  const me = S.me;
  if (!me || me.ended) return;
  const p = mePlayer();
  if (p && me.phase === 'player') writeDiary(p);
  if (me.job) evaluateJob();
}

function writeDiary(p) {
  const me = S.me, t = p.teamId != null ? S.teams[p.teamId] : null;
  const s = p.stats, prev = me.diary[me.diary.length - 1];
  const notes = [];
  if (prev && t && prev.team !== t.short) notes.push(`${prev.team || '無所属'}から${t.short}へ移籍`);
  titlesOf(p.id).filter(x => x.year === S.year).forEach(x => notes.push(x.title));
  if ((s.injd || 0) >= 30) notes.push(`故障で${s.injd}日離脱`);
  if ((s.g || s.pg) && !me.debuted) { me.debuted = true; lifeEvent('一軍デビュー', 'debut'); }
  titlesOf(p.id).filter(x => x.year === S.year).forEach(x => lifeEvent(x.title, 'title'));
  if ((s.injd || 0) >= 30) lifeEvent(`故障で${s.injd}日離脱`, 'hurt');
  if (p.salary >= 10000 && !me.oku) { me.oku = true; lifeEvent(`年俸が 1 億円に到達（${U.money(p.salary)}）`, 'money'); }
  const total = careerTotal(p);
  if (!me.msDone) me.msDone = [];
  MILESTONES.filter(x => total[x.k] >= byGames(x.n) && !me.msDone.includes(x.label)).forEach(x => { me.msDone.push(x.label); lifeEvent(`${x.label}を達成`, 'mile'); });
  me.diary.push({
    y: S.year, age: p.age, team: t ? t.short : '', color: t ? t.color : '#64748b', first: !!(s.g || s.pg), ovr: Math.round(ovr(p)), salary: p.salary,
    bat: canBat(p) && s.pa ? `${U.avg(s.h, s.ab)} ${s.hr}本 ${s.rbi}点` : '',
    pit: canPitch(p) && s.pg ? `${s.pg}登板 ${s.w}勝${s.l}敗${s.sv ? s.sv + 'S' : ''} ${U.era(s.per, s.outs)}` : '',
    notes,
  });
  earn(p.salary, 'player');
  if (t) {
    me.ties[t.short] = (me.ties[t.short] || 0) + 1;
    teamPlayers(t).filter(x => x.id !== p.id).sort((a, b) => ovr(b) - ovr(a)).slice(0, 10).forEach(x => { me.mates[x.id] = S.year; });
  }
}

function yearMetrics(t, j) {
  const rank = rankOf(t.id), P = S.off || {}, growRank = growthRank(t, ROLES[j.role].side);
  const jp = P.champ === t.name, lgChamp = S.post && S.post.champs && S.post.champs[t.lg] === t.id;
  return {
    rank, jp, lgChamp, growRank,
    win: U.clamp((j.exp - rank) / 3 + (pct(t) - 0.5) * 2 + (jp ? 0.8 : lgChamp ? 0.4 : 0), -1.2, 1.5),
    grow: (6.5 - growRank) / 5.5,
    money: (6.5 - moneyRank(t)) / 5.5,
    pop: U.clamp((t.pop - j.popStart) / 8, -1, 1),
  };
}

function evaluateJob() {
  const me = S.me, j = me.job, t = S.teams[j.teamId];
  const m = yearMetrics(t, j);
  const w = { ...ROLES[j.role].w };
  w[t.owner.type] += OWNER_EXTRA;
  const ws = U.sum(Object.keys(w), k => w[k]);
  const score = U.sum(Object.keys(w), k => w[k] * m[k]) / ws;
  const ok = missionNow(j, t).ok;
  let d = score * TRUST_SCORE + (ok ? TRUST_OK : TRUST_NG);
  if (m.rank >= 6) d -= TRUST_LAST * ROLES[j.role].w.win; // 最下位は、どの役職でも責められる
  if (d < 0) d *= 1.3 - t.owner.patience * 0.1;
  j.trust = U.clamp(j.trust + d - (j.trust - 50) / 50 * TRUST_DRIFT, 0, 100);
  me.rep = U.clamp(me.rep + score * REP_SCORE + (ok ? REP_MISSION : -REP_MISSION) + (m.jp ? REP_JP : m.lgChamp ? REP_LG : 0), 0, 100);
  j.yearsLeft--; j.years++;
  me.xp[j.role]++;
  const bonus = Math.round(j.salary * ((ok ? BONUS_MISSION : 0) + (m.jp ? BONUS_JP : 0)));
  earn(j.salary + bonus, 'job');
  t.money -= bonus;
  me.ties[t.short] = (me.ties[t.short] || 0) + 1;
  const row = { bonus,  y: S.year, role: j.role, title: j.title, team: t.short, color: t.color, rank: m.rank, w: t.w, l: t.l, d: t.d, post: (S.off && S.off.post) || '', jp: m.jp, mission: j.mission ? j.mission.text : '', ok, trust: Math.round(j.trust), rep: Math.round(me.rep), end: '' };
  me.log.push(row);
  j.last = { score, ok, rank: m.rank };
  if (m.jp) lifeEvent(`${t.short}の${j.title}として日本一`, 'champ');
  else if (m.lgChamp) lifeEvent(`${t.short}の${j.title}としてリーグ優勝`, 'champ');
}

function leaveJob(reason) {
  const me = S.me, j = me.job;
  if (!j) return;
  const t = S.teams[j.teamId];
  const fired = /解任/.test(reason);
  if (j.yearsLeft > 0 && fired) { const v = Math.round(j.salary * j.yearsLeft * FIRE_PAYOUT); earn(v, 'job'); t.money -= v; }
  if (fired) { me.fired++; me.rep = U.clamp(me.rep + REP_FIRED, 0, 100); }
  if (reason === '辞任') me.rep = U.clamp(me.rep + REP_RESIGN, 0, 100);
  if (reason === '引き抜き' && j.yearsLeft > 0) me.rep = U.clamp(me.rep + REP_LEFT, 0, 100);
  const last = me.log[me.log.length - 1];
  if (last && last.team === t.short && last.y === S.year) last.end = reason;
  else me.log.push({ y: S.year, role: j.role, title: j.title, team: t.short, color: t.color, rank: rankOf(t.id), w: t.w, l: t.l, d: t.d, post: '', mission: j.mission ? j.mission.text : '', ok: false, trust: Math.round(j.trust), rep: Math.round(me.rep), end: reason });
  if (t.tactic) t.tactic = { steal: '普通', hook: '普通' };
  if (S.phase === 'season' || S.phase === 'post') S.staff[t.id][j.role] = makeStaff(j.role, t);
  else { S.staff[t.id][j.role] = null; S.vacancies.push({ teamId: t.id, role: j.role }); }
  me.lastLeft = { teamId: t.id, role: j.role, reason };
  addNews(`${t.short}の${j.title}・${me.name}が${reason === '満了' ? '契約満了で退任' : reason}となりました。`, 'big');
  lifeEvent(`${t.short}の${j.title}を${reason === '満了' ? '契約満了で退任' : reason}`, fired ? 'fired' : 'job');
  me.job = null; me.phase = 'free'; me.jobless = 0; me.request = '';
}

// ---------- 引退 ----------
function careerRetire(p) {
  const me = S.me;
  if (me.card) return;
  me.card = { ...honorCard(p), draft: draftLabel(p), pos: canPitch(p) && !p.twoWay ? '投手' : p.pos, teams: [...new Set((p.career || []).map(x => x.t))] };
  me.merit = meritOf(p);
  me.rep = U.clamp(Math.round(me.merit * 60 + Math.min(me.diary.length, 18) + 5), 5, 85);
  me.retireYear = S.year; me.phase = 'free'; me.justRetired = true; me.pid = null; me.jobless = 0;
  addNews(`${me.name}（${p.age}歳）が現役を引退しました。`, 'big');
  lifeEvent(`${p.age}歳で現役引退（現役${me.diary.length}年）`, 'retire');
}

// 引退した選手のうち、名を残した人と元同僚は、のちに指導者の候補になる
function noteStaffCandidate(p, notable) {
  const me = S.me;
  noteNationalAlumni(p);
  if (!me || !S.staffPool) return;
  const mate = me.mates && me.mates[p.id] != null;
  if (!notable && !mate) return;
  S.staffPool.push({ name: p.name, mate });
  if (S.staffPool.length > 40) S.staffPool.shift();
}

// ---------- 査定と席の入れ替わり ----------
function staffTurnover() {
  S.teams.forEach(t => {
    const r = rankOf(t.id), tier = r <= 2 ? 0 : r <= 4 ? 1 : 2;
    ROLE_KEYS.forEach(role => {
      const s = S.staff[t.id][role];
      if (!s || s.me) return;
      s.age++; s.years++; s.yearsLeft = (s.yearsLeft || 0) - 1;
      const out = s.yearsLeft <= 0 ? U.chance(STAFF_LEAVE[role][tier]) : tier === 2 && U.chance(STAFF_MID_FIRE[role]);
      if (!out && s.yearsLeft <= 0) { s.yearsLeft = U.rint(STAFF_YEARS[0], STAFF_YEARS[1]); s.salary = staffSalary(role, s.rep, t); }
      if (out || s.age >= 72) {
        S.staff[t.id][role] = null;
        S.vacancies.push({ teamId: t.id, role });
        if (t.id === S.myTeamId) addNews(`${t.short}の${ROLES[role].name}・${s.name}が退任しました。`);
      }
    });
  });
}

function ownerTurnover() {
  const me = S.me;
  S.teams.forEach(t => {
    if (!U.chance(OWNER_CHANGE)) return;
    t.owner = { name: makeName(), type: U.pick(Object.keys(OWNER_TYPES)), patience: U.rint(1, 5) };
    if (t.id !== S.myTeamId) return;
    addNews(`${t.short}のオーナーが${t.owner.name}氏（${OWNER_TYPES[t.owner.type].name}）に交代しました。`, 'big');
    if (me.job && me.job.teamId === t.id) me.job.trust = U.clamp(me.job.trust - OWNER_NEW_TRUST, 0, 100);
  });
}

function fillVacancies() {
  S.vacancies.forEach(v => {
    if (S.staff[v.teamId][v.role]) return;
    const s = makeStaff(v.role, S.teams[v.teamId]);
    S.staff[v.teamId][v.role] = s;
    if (s.mate) addNews(`元同僚の${s.name}が${S.teams[v.teamId].short}の${ROLES[v.role].name}に就任しました。`, 'big');
  });
  S.vacancies = [];
}

// 代表の経験（監督をやったか、コーチまでか）と優勝の回数
function natFame() {
  const list = S.me.natLog || [];
  if (!list.length) return null;
  return { kind: list.some(n => n.title === '監督') ? 'manager' : 'coach', champ: Math.min(list.filter(n => n.result === '優勝').length, NAT_FAME.champMax) };
}
function offerFor(teamId, role, extra) {
  const me = S.me, t = S.teams[teamId], fame = role === 'manager' ? natFame() : null;
  const base = ROLES[role].base * (0.6 + me.rep / 100) * (0.7 + t.pop / 100) * (fame ? NAT_FAME.pay[fame.kind] + fame.champ * NAT_FAME.champ : 1);
  return { teamId, role, title: roleTitle(role, me.rep), base: Math.round(base / 10) * 10, ...(extra || {}) };
}

function makeOffers() {
  const me = S.me, out = [], last = me.lastLeft, j = me.job;
  S.vacancies.forEach(v => {
    const t = S.teams[v.teamId];
    if (S.staff[v.teamId][v.role]) return;
    if (ROLES[v.role].side && v.role !== myCoachRole()) return;
    if (last && last.teamId === v.teamId && /解任/.test(last.reason) && last.y === S.year) return;
    if (j && j.teamId === v.teamId && j.role === v.role) return;
    const score = me.rep + (me.ties[t.short] || 0) * 2 + Math.min(me.xp[v.role], 10) * 2 - t.pop * 0.5 - ROLES[v.role].need;
    let chance = U.clamp(0.25 + score / 50, 0.02, 0.95);
    if (j) chance *= j.trust >= 50 ? 0.5 : 0.25;
    if (U.chance(chance)) out.push(offerFor(v.teamId, v.role));
  });
  // 代表の経験があると、監督の席が空いていない球団からも話が来る
  const fame = natFame();
  if (fame && myAge() < RENEW_AGE) S.teams.forEach(t => {
    if (out.some(o => o.teamId === t.id && o.role === 'manager')) return;
    if (j && j.teamId === t.id && j.role === 'manager') return;
    if (last && last.teamId === t.id && /解任/.test(last.reason) && last.y === S.year) return;
    if (U.chance(NAT_FAME.extra[fame.kind] * (j ? NAT_FAME.jobMul : 1))) out.push(offerFor(t.id, 'manager', { natFame: true }));
  });
  out.sort((a, b) => b.base - a.base);
  out.length = Math.min(out.length, OFFER_MAX);
  if (j && j.yearsLeft <= 0 && j.trust >= TRUST_RENEW && myAge() < RENEW_AGE) out.unshift(offerFor(j.teamId, j.role, { renew: true }));
  return out;
}

// 引退してすぐの話。スターには古巣から監督の打診、そうでなくても古巣か縁のある球団がコーチの席を用意する
function makeRetireOffers() {
  const me = S.me, teamBy = n => S.teams.find(t => t.short === n);
  const out = makeOffers();
  const home = Object.keys(me.ties).sort((a, b) => me.ties[b] - me.ties[a]).map(teamBy).filter(Boolean)[0] || S.teams[S.myTeamId];
  const has = (tid, r) => out.some(o => o.teamId === tid && o.role === r);
  if (me.merit >= 0.5 && !has(home.id, 'manager')) out.unshift(offerFor(home.id, 'manager', { hero: true }));
  if (!out.length) out.push(offerFor(home.id, myCoachRole(), { hero: true }));
  return out;
}

// ---------- 代表の監督・コーチ ----------
function nationalScore() {
  const me = S.me, jp = Math.min(me.log.filter(r => r.jp).length, NAT_JP_MAX);
  return me.merit * NAT_W.merit + me.rep * NAT_W.rep + jp * NAT_W.jp;
}
// 自分が代表の選手に選ばれた回数
function natPlayerCount() {
  const me = S.me, p = mePlayer();
  if (p) return p.jp || 0;
  const row = me.card && (me.card.honors || []).find(x => /^日本代表×/.test(x));
  return row ? +row.split('×')[1] : 0;
}
// 代表の監督・コーチになれるのは、代表の選手だった人だけ。引退した代表選手を覚えておく
function noteNationalAlumni(p) {
  if (!p.jp) return;
  if (!S.natPool) S.natPool = [];
  S.natPool.push({ name: p.name, isP: !!p.isP });
  if (S.natPool.length > 60) S.natPool.shift();
}
// 自分が選ばれなかった席。まだ引退した代表選手がいない最初のうちは、始まる前の時代の代表選手として名前を作る
function nationalPick(side, used) {
  const list = (S.natPool || []).filter(x => !used.includes(x.name) && (!side || x.isP === (side === 'pit')));
  const name = list.length ? U.pick(list).name : makeName();
  used.push(name);
  return { name };
}
// 選手として代表に選ばれたとき
function careerNationalPicked(players) {
  const me = S.me;
  if (!me || !players.some(isMe)) return;
  lifeEvent(`${NATIONAL_NAME}に選手として選ばれる`, 'nat');
  me.notices.push({ title: `🎌 ${NATIONAL_NAME}`, text: `${NATIONAL_NAME}に選手として選ばれました。`, sub: '代表の経験がある人だけが、のちに代表の監督・コーチになれます。', timeline: true });
}
function selectNationalStaff() {
  const me = S.me, used = [];
  const staff = { manager: nationalPick(null, used), pcoach: nationalPick('pit', used), bcoach: nationalPick('bat', used) };
  if (!me) return staff;
  if (me.natDuty && me.natDuty.y === S.year) {
    staff.manager = { name: me.name, me: true };
    me.national = { y: S.year, role: 'manager', title: '監督' };
    return staff;
  }
  if (me.phase === 'player' || !me.card || me.ended || myAge() >= NAT_AGE) return staff;
  if (!natPlayerCount() || nationalScore() < NAT_LINE.coach || !U.chance(NAT_CHANCE)) return staff;
  const role = myCoachRole(), title = ROLES[role].name;
  staff[role] = { name: me.name, me: true };
  me.national = { y: S.year, role, title };
  lifeEvent(`${NATIONAL_NAME}の${title}に選ばれる`, 'nat');
  addNews(`${me.name}が${NATIONAL_NAME}の${title}に選ばれました。`, 'big');
  me.notices.push({ title: `🎌 ${NATIONAL_NAME}`, text: `${NATIONAL_NAME}の${title}に選ばれました。`, sub: me.job ? 'これまでの功績が認められました。球団の仕事はそのまま続けられます。' : 'これまでの功績が認められました。', timeline: true });
  return staff;
}
// 代表の監督の打診。大会の前の年のオフに、点が届いた人へ来る
function makeNationalOffer() {
  const me = S.me, y = S.year + 1;
  if (me.phase === 'player' || !me.card || !natPlayerCount() || me.ended || me.natDuty || y % INTL_EVERY !== 0 || myAge() + 1 >= NAT_AGE) return null;
  return nationalScore() >= NAT_LINE.manager && U.chance(NAT_CHANCE) ? { y } : null;
}
// 打診を受ける：球団の仕事を辞めて、大会まで代表に専念する
function acceptNational() {
  const me = S.me, o = me.natOffer;
  if (!o) return;
  if (me.job) leaveJob('代表監督就任のため退任');
  me.offers = []; me.natOffer = null; me.verdict = null;
  me.natDuty = { y: o.y };
  me.phase = 'free'; me.jobless = 0;
  lifeEvent(`${NATIONAL_NAME}の監督に就任（${o.y}年の国際大会まで専任）`, 'nat');
  addNews(`${me.name}が${NATIONAL_NAME}の監督に就任しました。`, 'big');
}
// 大会の結果を受け取る（決勝の結果を隠している画面の先、査定の始まりで）
function settleNational() {
  const me = S.me, n = me.national, I = S.off.intl;
  if (me.natDuty && me.natDuty.y <= S.year) me.natDuty = null;
  if (!n) return;
  me.national = null;
  if (!I || I.year !== n.y) return;
  const coach = n.role !== 'manager';
  const repGain = (NAT_REP[I.jp] || 0) * (coach ? NAT_REP_COACH : 1);
  const pay = NAT_PAY[coach ? 'coach' : 'manager'];
  const total = pay * (I.jp === '優勝' ? 2 : 1);
  me.rep = U.clamp(me.rep + repGain, 0, 100);
  earn(total, 'job');
  if (!me.natLog) me.natLog = [];
  me.natLog.push({ y: n.y, title: n.title, result: I.jp, pay: total });
  lifeEvent(`${NATIONAL_NAME}の${n.title}として国際大会 ${I.jp}（報酬 ${U.money(total)}）`, 'nat');
}

function careerReviewStart() {
  S.off.step = 'review';
  if (S.off.reviewed) return;
  S.off.reviewed = true;
  const wasDuty = !!S.me.natDuty;
  settleNational();
  staffTurnover();
  ownerTurnover();
  const me = S.me;
  me.verdict = null;
  if (me.job) {
    const j = me.job, t = S.teams[j.teamId];
    if (j.trust < fireLine(t)) {
      const name = `${t.short}の${j.title}`;
      leaveJob('解任');
      me.verdict = { kind: 'fired', text: `${t.owner.name}オーナーから解任を告げられました（${name}）。` };
    } else if (j.yearsLeft <= 0) {
      me.verdict = j.trust >= TRUST_RENEW && myAge() < RENEW_AGE ? { kind: 'renew', text: '契約が満了します。球団は続投を望んでいます。' }
        : { kind: 'expire', text: '契約が満了します。球団から更新の話はありません。' };
    } else {
      me.verdict = { kind: 'stay', text: `契約は残り${j.yearsLeft}年。来季も続投です。` };
    }
  } else if (me.phase === 'free' && !wasDuty) {
    me.jobless++;
    me.rep = U.clamp(me.rep + REP_JOBLESS, 0, 100);
  }
  if (me.lastLeft) me.lastLeft.y = S.year;
  me.offers = me.phase === 'player' ? [] : makeOffers();
  me.natOffer = makeNationalOffer();
  if (me.phase === 'free' && !me.offers.length && !me.natOffer && (me.jobless >= JOBLESS_END || myAge() >= AGE_END)) careerEnd(`${JOBLESS_END}年待っても、話は来ませんでした。`);
  if (myAge() >= AGE_END) careerEnd('長い野球人生に幕を下ろしました。');
}

function packagesOf(o) {
  return PACKAGES.map(pk => ({ ...pk, salary: Math.round(o.base * pk.pay / 10) * 10 }));
}

function acceptOffer(i, pkIdx) {
  const me = S.me, o = me.offers[i];
  if (!o) return;
  const pk = packagesOf(o)[pkIdx];
  me.natOffer = null; // 球団の話を受けると、代表の打診は流れる
  const same = me.job && me.job.teamId === o.teamId && me.job.role === o.role;
  const keepTrust = same ? me.job.trust : null, keepYears = same ? me.job.years : 0;
  if (me.job && !same) leaveJob('引き抜き');
  const t = S.teams[o.teamId];
  S.vacancies = S.vacancies.filter(v => !(v.teamId === o.teamId && v.role === o.role));
  S.staff[t.id][o.role] = { me: true, name: me.name };
  me.job = {
    role: o.role, title: o.title, teamId: o.teamId, salary: pk.salary, voice: pk.voice, lv: pk.lv, pkg: pk.name, yearsLeft: pk.years, years: keepYears,
    trust: keepTrust != null ? keepTrust : TRUST_START + Math.min(me.ties[t.short] || 0, 10), startYear: S.year + 1, exp: strengthRank(t), talk: 0, mission: null, moneyStart: t.money, popStart: t.pop,
  };
  me.job.mission = makeMission(me.job, t);
  me.phase = 'job'; me.offers = []; me.jobless = 0; me.lastLeft = null; me.verdict = null;
  S.myTeamId = t.id;
  addNews(`${me.name}が${t.name}の${o.title}に${same ? '留任' : '就任'}しました（${pk.years}年・年俸${U.money(pk.salary)}）。`, 'big');
  lifeEvent(`${t.short}の${o.title}に${same ? '留任' : '就任'}（${pk.years}年・年俸${U.money(pk.salary)}）`, 'job');
}

function careerEnd(why) {
  const me = S.me;
  if (me.ended) return;
  if (me.job) leaveJob('勇退');
  me.ended = true; me.endWhy = why; me.endAge = myAge(); me.offers = [];
  lifeEvent(`球界を去る。${why}`, 'end');
  if (!me.bot) me.scoreRank = saveScore();
}

// ---------- スコア（生涯収入）。セーブとは別に、このブラウザに上位を残す ----------
function loadScores() {
  try { const v = JSON.parse(localStorage.getItem(SCORE_KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function saveScore() {
  const me = S.me, list = loadScores();
  const titles = {};
  me.log.forEach(r => { titles[r.title] = (titles[r.title] || 0) + 1; });
  const row = { name: me.name, score: Math.round(me.earned), age: me.endAge, games: S.games, years: me.diary.length, jobs: Object.keys(titles).join('・'), jp: me.log.filter(r => r.jp).length, fired: me.fired, at: Date.now() };
  list.push(row);
  list.sort((a, b) => b.score - a.score);
  const rank = list.indexOf(row) + 1;
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(list.slice(0, SCORE_TOP))); } catch (e) { /* 残せなくても、経歴書は出る */ }
  return rank;
}

// ---------- 自動で進める ----------
function runSeasonAuto() {
  while (S.phase === 'season') if (!advanceDay()) break;
  let guard = 0;
  while (S.phase === 'post' && guard++ < 200) if (!advancePost()) break;
  (S.pbp || []).forEach(g => { g.seen = true; });
  S.popups = [];
  S.me.notices = S.me.notices || [];
}

function followMe() {
  const p = mePlayer();
  if (p && p.teamId != null && !S.me.job) S.myTeamId = p.teamId;
}

function offToReview() {
  if (S.off.step === 'awards' && intlYear() && !S.off.intl) offIntl();
  careerReviewStart();
}

function draftAutoAll() {
  const D = S.off.draft;
  let guard = 0;
  while (D.result.filter(r => r.round === 1).length < S.teams.length && guard++ < 40) draftBidRound(null);
  D.stage = 'waiver';
  draftRunAI();
}

// 球団に任せてキャンプの前まで進める（GM でないとき）
function autoOffToCamp() {
  offFAStart(); offFADeclare(); offFAResolve(); faCompSettle();
  offContract();
  offDraftStart();
  draftAutoAll();
  offCampStart();
  followMe();
  S.popups = [];
}

// 無職・現役のとき、次に人の判断が要るところまで進める
function lifeStep() {
  const me = S.me;
  if (me.ended || me.job) return me.ended ? 'end' : 'job';
  if (S.phase !== 'off') runSeasonAuto();
  if (S.phase !== 'off') return 'stuck';
  if (S.off.step === 'awards' && intlYear() && !S.off.intl) offIntl();
  if (S.off.step === 'intl' && me.national && !me.bot) return 'intl'; // 自分が代表にいる大会は、画面で見てもらう
  if (['awards', 'intl'].includes(S.off.step)) offToReview();
  if (me.ended) return 'end';
  if (me.offers.length || me.natOffer) return 'offers';
  if (S.off.step === 'review') autoOffToCamp();
  if (me.justRetired) {
    me.justRetired = false;
    me.offers = makeRetireOffers();
    me.verdict = { kind: 'retired', text: `${me.card.age}歳で現役を引退しました。おつかれさまでした。次の仕事の話が来ています。` };
    return 'retired';
  }
  if (S.off.step === 'camp') offNewSeason();
  return 'year';
}

// 査定の画面から先へ
function careerNext() {
  const me = S.me;
  if (me.job && me.job.yearsLeft <= 0) leaveJob('満了');
  me.offers = []; me.natOffer = null; me.verdict = null;
  if (!me.job) return lifeStep();
  if (hasControl('front')) offFAStart();
  else autoOffToCamp();
  return 'job';
}

function careerResign() {
  leaveJob('辞任');
  if (S.phase === 'off' && S.off.step === 'review') S.me.offers = makeOffers();
  S.me.offers = S.me.offers || [];
}

// ---------- 球団フロントの AI ----------
const FRONT_FAC = { win: ['train', 'gym', 'analysis'], grow: ['train', 'dorm', 'scout'], money: ['stadium'], pop: ['stadium', 'medical'] };
function aiFrontYear() {
  S.teams.forEach(t => {
    if (humanFront(t) || !t.owner) return;
    const keys = FRONT_FAC[t.owner.type].filter(k => facLv(t, k) < FAC_MAX);
    if (!keys.length) return;
    const k = U.pick(keys), cost = facilityCost(facLv(t, k), k);
    if (t.money < cost * 3) return;
    t.money -= cost; t.fin.invest += cost;
    t.fac[k] = facLv(t, k) + 1;
    if (t.id === S.myTeamId) addNews(`球団が${FACILITIES[k].name}をレベル${t.fac[k]}に改修しました。`);
  });
  aiTrades();
}

// 主力でない選手どうしで、人数の多い側から少ない側へ、釣り合う交換をする
function aiTrades() {
  const n = U.rint(1, 3);
  for (let i = 0; i < n; i++) {
    const [a, b] = U.shuffle(S.teams.slice());
    if (humanFront(a) || humanFront(b)) continue;
    const pa = teamPlayers(a).filter(p => p.isP).length, pb = teamPlayers(b).filter(p => p.isP).length;
    const giveP = pa > pb;
    const coreA = new Set(tradeCore(a)), coreB = new Set(tradeCore(b));
    const x = U.shuffle(teamPlayers(a).filter(p => p.isP === giveP && !coreA.has(p.id) && !p.foreign && !p.twoWay))[0];
    if (!x) continue;
    const v = tradeValue(x);
    const y = teamPlayers(b).filter(p => p.isP !== giveP && !coreB.has(p.id) && !p.foreign && !p.twoWay && Math.abs(tradeValue(p) - v) <= Math.max(2, v * 0.1))[0];
    if (!y) continue;
    removeFromTeam(x); removeFromTeam(y);
    signPlayer(b, x); signPlayer(a, y);
    careerMoved(x, a, b, 'トレード', y.name); careerMoved(y, b, a, 'トレード', x.name);
    if (a.id === S.myTeamId || b.id === S.myTeamId || isMe(x) || isMe(y)) addNews(`トレード：${x.name}（${a.short}→${b.short}）と${y.name}（${b.short}→${a.short}）`, isMe(x) || isMe(y) ? 'big' : '');
  }
}

// 自分の要望がフロントに通るか（発言力 × 信頼度）
function requestHeard() {
  const j = S.me && S.me.job;
  return !!j && !S.me.bot && !hasControl('front') && U.chance((j.voice / 100) * (j.trust / 100) * 2);
}
