#!/usr/bin/env node
/* ═══ 📋 scripts/todo-merge.js — PR 이 main 에 머지되면 본문 «할 일: <id>» 를 완료로 ═══
   .github/workflows/todo-merge.yml 이 부른다. PR 본문에서 id 를 뽑고, 머지 커밋의 package.json 버전으로
   «다음 버전» 을 셈해 Cloud Function todoMergeDone 에 보낸다(쓰기 · 검사는 함수 쪽 functions/todo-merge.js).
   어떤 경우에도 0 으로 끝난다 — 할 일 갱신이 머지 흐름을 빨갛게 만들지 않게. 실패는 로그에만 남긴다.

   환경 변수: PR_BODY · PR_NUMBER · TODO_MERGE_URL · TODO_MERGE_TOKEN (· VERSION_FILE 기본 package.json) */
'use strict';
const fs = require('fs');

// 규칙 adminTodos/$id 와 같다. 함수도 같은 모양 · 같은 개수만 받는다.
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const IDS_MAX = 10;
const LINE_RE = /^\s*[-*]?\s*할\s*일\s*[:：]\s*(.*)$/;

/** PR 본문 → 할 일 id 목록. «할 일:» 줄(여러 줄이어도)에서 쉼표 · 공백으로 나눈다. 주석 · 자리표시는 뺀다. */
function parseTodoIds(body){
  // 템플릿 주석(<!-- … 예: tmv1… -->)의 예시 id 를 집지 않게 주석부터 걷는다.
  const text = String(body || '').replace(/<!--[\s\S]*?-->/g, '');
  const ids = [];
  for (const raw of text.split(/\r?\n/)){
    const m = LINE_RE.exec(raw);
    if (!m) continue;
    for (let tok of m[1].split(/[\s,，、]+/)){
      tok = tok.replace(/^[`'"([]+|[`'")\].]+$/g, '');
      // «-» · «없음» 같은 자리표시는 id 모양이 아니거나 글자 · 숫자가 없다.
      if (ID_RE.test(tok) && /[A-Za-z0-9]/.test(tok) && !ids.includes(tok)) ids.push(tok);
    }
  }
  return ids.slice(0, IDS_MAX);
}

/** main 의 지금 버전 → 이 머지가 실려 나갈 버전. 0.11.2 → 0.11.3 · 0.12.0-beta.1 → 0.12.0(베타가 정식이 될 때 함께). */
function nextRelease(version){
  const m = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/.exec(String(version || '').trim());
  if (!m) return null;
  if (m[4]) return `${m[1]}.${m[2]}.${m[3]}`;
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

/** 보낼 것 — 없으면 { skip: 이유 }. */
function plan(env, version){
  const ids = parseTodoIds(env.PR_BODY);
  if (!ids.length) return { skip: 'PR 본문에 «할 일:» id 가 없음' };
  const pr = Number(env.PR_NUMBER);
  if (!Number.isInteger(pr) || pr < 1) return { skip: 'PR 번호를 모름' };
  const release = nextRelease(version);
  if (!release) return { skip: `package.json 버전을 못 읽음: ${version}` };
  if (!env.TODO_MERGE_URL || !env.TODO_MERGE_TOKEN) return { skip: 'TODO_MERGE_URL 변수 · TODO_MERGE_TOKEN 비밀이 설정 전' };
  return { body: { ids, pr, release } };
}

async function main(env = process.env){
  let version = null;
  try { version = JSON.parse(fs.readFileSync(env.VERSION_FILE || 'package.json', 'utf8')).version; } catch (_){ /* 아래 plan 이 건너뛴다 */ }
  const p = plan(env, version);
  if (p.skip){ console.log('할 일 갱신 건너뜀 — ' + p.skip); return; }
  console.log(`할 일 ${p.body.ids.join(', ')} → 완료 · 릴리스 ${p.body.release} · PR #${p.body.pr}`);
  try {
    const res = await fetch(env.TODO_MERGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.TODO_MERGE_TOKEN },
      body: JSON.stringify(p.body),
      signal: AbortSignal.timeout(30000),
    });
    const text = (await res.text()).slice(0, 2000);
    if (!res.ok){ console.log(`::warning::할 일 갱신 실패 (${res.status}) ${text}`); return; }
    let results = [];
    try { results = JSON.parse(text).results || []; } catch (_){ /* 모양이 틀리면 그대로 찍는다 */ }
    if (!results.length) console.log(text);
    for (const r of results) console.log(`  ${r.id}: ${r.result}${r.release ? ' · ' + r.release : ''}`);
  } catch (e){
    console.log('::warning::할 일 갱신 함수에 닿지 못함 — ' + (e && e.message));
  }
}

if (require.main === module) main().catch((e) => console.log('::warning::' + (e && e.message)));

module.exports = { ID_RE, IDS_MAX, parseTodoIds, nextRelease, plan, main };
