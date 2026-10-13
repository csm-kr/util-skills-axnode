// PageOne Time Report(tms.samil.com) 근무시간 등록 스크립트 (aside repl용)
// 실행 전에 앞에 `const ARGS = {...};`를 붙인다. 형식은 SKILL.md 참고.
//   ARGS.entries: [{ date: 'YYYY-MM-DD', hours: 8, minutes: 0, activity: '...' }]
//   ARGS.dryRun : true면 입력까지만 하고 Cancel (제출 안 함)
// 출력: 마지막 줄 `RESULT {...}` JSON

const TR_PROJECT = { name: 'Practice Development/PD Hour-이창훈', code: '00973-90-738', query: 'PD Hour-이창훈' }; // 코드로는 검색이 안 된다
const TR_PAGEONE = 'https://pageone.pwc.kr/groupware/sportal/home.do?CLSYS=portal&CLMD=user&CLBIZ=Portal';
const trResults = [];
const trT0 = Date.now();
const trLog = (...a) => console.log('[' + ((Date.now() - trT0) / 1000).toFixed(1) + 's]', ...a);
const trVisible = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter(e => e.offsetWidth || e.offsetHeight).length, sel);
const trWaitFor = async (fn, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(250); } return false; };
// 이 페이지엔 숨은 중복 요소가 많아 locator가 엉뚱한 걸 잡는다. 보이는 요소를 골라 좌표로 실제 클릭한다.
// match: 요소 textContent(trim)와 정확히 같아야 하는 문자열, rowHas: 같은 tr 안에 있어야 하는 문자열
const trClickVisible = async (selector, match, rowHas) => {
  const locate = (scroll) => page.evaluate(({ selector, match, rowHas, scroll }) => {
    const el = [...document.querySelectorAll(selector)].find(e => (e.offsetWidth || e.offsetHeight)
      && (match == null || e.textContent.trim() === match)
      && (rowHas == null || (e.closest('tr')?.textContent || '').includes(rowHas)));
    if (!el) return null;
    if (scroll) el.scrollIntoView({ block: 'center' });
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }, { selector, match, rowHas, scroll });
  if (!(await locate(true))) throw new Error(`NOT_FOUND ${selector} ${match ?? ''}`);
  await sleep(400); // 스크롤이 끝난 뒤 좌표를 다시 읽는다
  const r = await locate(false);
  await page.mouse.click(r.x, r.y);
};

// 1. Time Report 탭 확보 (열린 탭 재사용, 없으면 PageOne Quick Link로 연다)
let trTab = (await listBrowserTabs()).find(t => t.url.includes('tms.samil.com'));
if (!trTab) {
  await openTab(TR_PAGEONE);
  const trLinkSel = 'a[onclick*="tms.samil.com"]'; // Quick Links의 Time Report
  if (!(await trWaitFor(async () => page.url().includes('pageone.pwc.kr') && (await trVisible(trLinkSel)) > 0, 15000)))
    throw new Error('LOGIN_REQUIRED ' + page.url());
  await trClickVisible(trLinkSel);
  await trWaitFor(async () => !!(await listBrowserTabs()).find(t => t.url.includes('tms.samil.com')), 20000);
  trTab = (await listBrowserTabs()).find(t => t.url.includes('tms.samil.com'));
  if (!trTab) throw new Error('TIME_REPORT_NOT_OPENED');
}
await attachBrowserTab(trTab.targetId);
// 오래 열려 있던 탭은 어제 상태로 남아 [New]가 동작하지 않는다(2026-10-13 실제 발생). 항상 새로고침한다.
await page.evaluate(() => location.reload());
await sleep(1500);
trLog('time report attached (reloaded)');
if (!(await trWaitFor(() => page.evaluate(() => typeof scheduler === 'object' && !!document.querySelector('.dhx_cal_date')), 20000)))
  throw new Error('LOGIN_REQUIRED_OR_NOT_LOADED ' + page.url());

for (const ent of ARGS.entries) {
  const res = { date: ent.date, status: '' };
  trResults.push(res);
  try {
    const [y, m, d] = ent.date.split('-').map(Number);
    const dot = `${y}.${m}.${d}`; // 날짜 칸 aria-label은 0을 채우지 않는다 (2026.10.1)
    if ([...ent.activity].length > 25) throw new Error('ACTIVITY_TOO_LONG');

    // 이전 실행에서 남은 등록 창이 있으면 닫는다
    if ((await trVisible('#workSubmitDueDate')) > 0) {
      await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel' && (b.offsetWidth || b.offsetHeight))?.click());
      await trWaitFor(async () => (await trVisible('#workSubmitDueDate')) === 0);
    }

    // 2. 해당 주로 이동. 주간 prev/next 버튼은 숨겨져 있고(보이는 Next는 미니 달력 월 이동),
    //    그 버튼이 내부에서 부르는 scheduler.setCurrentView를 직접 호출한다. 해당 주 데이터도 함께 불러온다.
    res.step = 'week-nav'; trLog(ent.date, 'week-nav');
    const colSel = `#scheduler_here .dhx_scale_holder[aria-label="${dot}"], #scheduler_here .dhx_scale_holder_now[aria-label="${dot}"]`;
    if (!(await trVisible(colSel))) {
      await page.evaluate(({ y, m, d }) => scheduler.setCurrentView(new Date(y, m - 1, d), 'week'), { y, m, d });
      if (!(await trWaitFor(async () => (await trVisible(colSel)) > 0))) throw new Error('WEEK_NAV_FAILED');
      await sleep(2000); // 이벤트 데이터 로딩 대기
    }

    // 3. 중복 확인 (같은 날짜에 같은 프로젝트가 있으면 건너뜀)
    trLog(ent.date, 'dup-check');
    const dup = await page.evaluate(({ y, m, d, code }) => {
      const [c1, c2, c3] = code.split('-');
      return scheduler.getEvents(new Date(y, m - 1, d), new Date(y, m - 1, d + 1))
        .filter(e => e.PRJTCD1 === c1 && e.PRJTCD2 === c2 && e.PRJTCD3 === c3)
        .map(e => ({ hours: e.USE_TIME, activity: e.ACTIVITYTITLE }));
    }, { y, m, d, code: TR_PROJECT.code });
    if (dup.length) { res.status = 'DUPLICATE'; res.existing = dup; delete res.step; continue; }

    // 4. 날짜 칸의 [New] (opacity 0인 button.fake) → 근무시간 등록 창
    res.step = 'open-dialog'; trLog(ent.date, 'open-dialog');
    const hb = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      el.scrollIntoView({ block: 'nearest' });
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width };
    }, colSel);
    if (!hb) throw new Error('DAY_COLUMN_NOT_FOUND');
    await page.mouse.move(hb.x + hb.width / 2, hb.y + 60);
    await sleep(400);
    await page.mouse.click(hb.x + hb.width / 2, hb.y + 7);
    if (!(await trWaitFor(async () => (await trVisible('#workSubmitDueDate')) > 0))) throw new Error('DIALOG_NOT_OPENED');

    // 5. 프로젝트: 이름으로 검색 후 프로젝트명 셀 클릭 (첫 칸 별표는 즐겨찾기 토글이라 누르지 않는다)
    res.step = 'project'; trLog(ent.date, 'project');
    await trClickVisible('input[placeholder="프로젝트 명 또는 코드"]');
    await page.keyboard.press('Control+A');
    await page.keyboard.type(TR_PROJECT.query);
    await trClickVisible('button.btnSearch', '검색');
    await trWaitFor(() => page.evaluate((c) => [...document.querySelectorAll('tr')].some(t => (t.offsetWidth || t.offsetHeight) && t.textContent.includes(c)), TR_PROJECT.code));
    await sleep(300);
    await trClickVisible('td', TR_PROJECT.name, TR_PROJECT.code);
    await sleep(500);
    res.step = 'fields'; trLog(ent.date, 'fields');

    // 6. 날짜/시간/야간/Activity/Remarks
    // (Aside REPL엔 inputValue/selectOption이 없어 DOM으로 직접 설정한다. 드롭다운은 옵션 텍스트로 고른다)
    const setErr = await page.evaluate(({ date, h, mi }) => {
      if (document.getElementById('workSubmitDueDate').value !== date) return 'DATE_MISMATCH ' + document.getElementById('workSubmitDueDate').value;
      const pick = (id, text) => {
        const s = document.getElementById(id);
        const i = [...s.options].findIndex(o => o.text.trim() === text);
        if (i < 0) return `NO_OPTION ${id} ${text}`;
        s.selectedIndex = i;
        s.dispatchEvent(new Event('change', { bubbles: true }));
        return null;
      };
      const r = document.getElementById('radActivity01');
      if (!r.checked) r.click();
      return pick('useSubmitHour', String(h)) || pick('useSubmitMin', String(mi).padStart(2, '0')) || pick('lnSubmitStartWork', '미선택');
    }, { date: ent.date, h: ent.hours ?? 8, mi: ent.minutes ?? 0 });
    if (setErr) throw new Error(setErr);
    await page.fill('#TXTAREA_ACTIVITYTITLE', ent.activity);
    await page.fill('#TXTAREA_REMARKS', '');

    // 7. 입력값 검증
    const form = await page.evaluate((code) => {
      const txt = (id) => { const s = document.getElementById(id); return s.options[s.selectedIndex].text; };
      return {
        // 선택되면 창 상단 .resultBox가 "작성 <프로젝트명> <코드>"로 바뀐다
        project: [...document.querySelectorAll('.resultBox')].some(b => b.offsetWidth && b.textContent.includes(code)),
        date: document.getElementById('workSubmitDueDate').value,
        time: txt('useSubmitHour') + ':' + txt('useSubmitMin'),
        night: txt('lnSubmitStartWork'),
        activity: document.getElementById('TXTAREA_ACTIVITYTITLE').value,
        remarks: document.getElementById('TXTAREA_REMARKS').value,
      };
    }, TR_PROJECT.code);
    res.form = form;
    if (!form.project) throw new Error('PROJECT_NOT_SELECTED');
    if (form.activity !== ent.activity) throw new Error('ACTIVITY_MISMATCH');

    if (ARGS.dryRun) {
      await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel' && (b.offsetWidth || b.offsetHeight)).click());
      res.status = 'DRY_RUN_OK';
      delete res.step;
      continue;
    }

    // 8. Submit → "결재로 상신됩니다" 확인창 [확인]
    res.step = 'submit'; trLog(ent.date, 'submit');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Submit' && (b.offsetWidth || b.offsetHeight)).click());
    if (!(await trWaitFor(async () => (await trVisible('.alertBox')) > 0))) throw new Error('CONFIRM_NOT_SHOWN');
    const msg = await page.evaluate(() => [...document.querySelectorAll('.alertBox')].find(b => b.offsetWidth || b.offsetHeight).textContent.trim().replace(/\s+/g, ' '));
    if (!msg.includes('상신')) throw new Error('UNEXPECTED_ALERT ' + msg);
    await page.evaluate(() => [...document.querySelectorAll('.alertBox')].find(b => b.offsetWidth || b.offsetHeight).querySelector('.btConfirm').click());
    await trWaitFor(async () => (await trVisible('#workSubmitDueDate')) === 0, 15000);
    await sleep(1500);

    // 9. 반영 확인
    const saved = await page.evaluate(({ y, m, d, code }) => {
      const [c1, c2, c3] = code.split('-');
      return scheduler.getEvents(new Date(y, m - 1, d), new Date(y, m - 1, d + 1))
        .filter(e => e.PRJTCD1 === c1 && e.PRJTCD2 === c2 && e.PRJTCD3 === c3)
        .map(e => ({ hours: e.USE_TIME, activity: e.ACTIVITYTITLE, status: e.TIMESTATUS }));
    }, { y, m, d, code: TR_PROJECT.code });
    const alerts = await page.evaluate(() => [...document.querySelectorAll('.alertBox')].filter(b => b.offsetWidth || b.offsetHeight).map(b => b.textContent.trim().replace(/\s+/g, ' ')));
    res.saved = saved;
    res.status = saved.length ? 'SUBMITTED' : 'NOT_FOUND_AFTER_SUBMIT';
    if (alerts.length) res.alerts = alerts;
    delete res.step;
  } catch (err) {
    res.status = 'ERROR';
    res.error = String(err.message || err);
  }
}

console.log('RESULT ' + JSON.stringify(trResults));
