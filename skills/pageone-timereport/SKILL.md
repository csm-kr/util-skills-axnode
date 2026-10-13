---
name: pageone-timereport
description: 삼일회계법인(Samil PwC) PageOne의 Time Report(타임시트/Timetable)에 근무시간을 Aside 브라우저로 등록한다. "타임시트", "time report", "timetable", "PD Hour", "근무시간 등록", "오늘 time 써줘" 같은 요청에 사용.
---

# PageOne Time Report 등록 (Aside)

같은 폴더의 `timereport.js`를 `aside repl`로 실행해 PageOne Time Report에 근무시간을 등록한다. 날짜 하나에 10~15초가 걸린다. Aside 에이전트(`aside exec`)에 맡기면 화면을 매번 새로 탐색해서 7분쯤 걸리므로, 에이전트는 스크립트가 실패했을 때만 쓴다(5절).

## 0. 준비

1. `aside --update`를 실행한다. 업데이트 확인 프롬프트가 입력을 기다리면 `"y" | aside update`로 실행한다. 그다음 `aside guide`를 읽는다 (aside-browser 스킬 규칙).
2. 스크립트는 **Bash 도구**로 실행한다. PowerShell 5.1은 네이티브 exe 인자의 큰따옴표를 깨뜨린다. stdin으로 넘기면 첫 줄만 실행된다.

## 1. 입력값 확정

| 항목 | 기본값 | 비고 |
|---|---|---|
| 날짜 | 오늘 | 여러 날짜면 날짜별로 등록 |
| 시간 | 8시간 00분 | 사용자가 "보통 8시간"이라고 함. 분은 0/15/30/45 |
| Project | Practice Development/PD Hour-이창훈 (00973-90-738) | 스크립트에 고정. Partner/Manager 이창훈(150542)이 코드에 묶여 있어 승인자 칸이 따로 없음 |
| Activity | 사용자에게 받음 | **최대 25자.** 넘으면 의미를 유지하며 줄이고, 줄인 문구를 사용자에게 알린다 |
| 야간근무 / Remarks | 미선택 / 빈칸 | 스크립트에 고정 |

Activity가 없거나 날짜가 모호하면 등록하기 전에 사용자에게 묻는다. 25자는 실행하기 전에 직접 센다. 스크립트도 넘으면 `ACTIVITY_TOO_LONG`으로 멈춘다.

## 2. 실행

```bash
cd ~/.claude/skills/pageone-timereport && timeout 115 aside repl "const ARGS = {dryRun: false, entries: [
  {date:'2026-10-12', hours:8, minutes:0, activity:'bpo flow 프로덕트화를 위한 개선'}
]};
$(cat timereport.js)" 2>&1 | grep -E '^\[|RESULT|Error'
```

- `entries`에 날짜를 여러 개 넣을 수 있다. REPL 한 번은 120초 제한이라 **한 번에 6개까지만** 넣고, 더 많으면 나눠 실행한다.
- `dryRun: true`면 입력과 검증까지만 하고 Cancel한다. 셀렉터를 고친 뒤 시험할 때 쓴다.
- Activity에 작은따옴표(`'`)가 있으면 `\'`로 이스케이프한다.
- Bash 도구 timeout은 200000으로 둔다.

스크립트가 하는 일: Time Report 탭이 열려 있으면 그 탭을 쓰고, 없으면 PageOne Quick Link로 연다 → `scheduler.setCurrentView()`로 해당 주로 이동 → 같은 날짜에 같은 프로젝트가 있으면 건너뜀 → [New] → 프로젝트 이름 검색 → 행 선택 → 시간/Activity 입력 → 값 검증 → Submit → 결재 상신 확인창 [확인] → 달력에 반영됐는지 확인.

## 3. 결과 해석 (`RESULT [...]`)

| status | 의미 / 할 일 |
|---|---|
| `SUBMITTED` | 등록과 상신 완료. `saved`에 실제 저장값(시간, Activity)이 있다 |
| `DUPLICATE` | 그 날짜에 이미 PD Hour가 있어 건너뜀. `existing`을 사용자에게 보여 준다 |
| `DRY_RUN_OK` | dryRun 성공. `form`에 입력됐던 값이 있다 |
| `NOT_FOUND_AFTER_SUBMIT` | 제출은 했지만 달력에서 확인이 안 됨. 재실행하지 말고 Time Report 화면을 확인한다(중복 위험) |
| `ERROR` | `step`(week-nav / open-dialog / project / fields / submit)과 `error`를 본다. `submit` 단계 오류면 재실행 전에 등록 여부부터 확인한다 |

스크립트 전체가 `LOGIN_REQUIRED...`로 끝나면 PageOne 세션이 만료된 것이다. 사용자에게 Aside 브라우저에서 직접 로그인해 달라고 한다.

## 4. 보고

사용자에게 다음을 짧게 알린다:
- 등록된 값(표)
- 결재로 상신됐다는 점
- Activity를 줄였다면 줄인 문구
- 중복이나 로그인 문제로 멈췄다면 그 사실

## 5. 대안: Aside 에이전트 (스크립트가 실패할 때)

스크립트가 같은 단계에서 반복해 실패하면 먼저 화면 구조가 바뀌었는지 의심한다. `dryRun`으로 원인을 찾아 `timereport.js`를 고친다. 급하면 Aside 에이전트에 맡긴다. 로그는 길기 때문에 `2>&1 | Select-Object -Last 30`으로 받고 timeout은 600000으로 둔다:

```
PageOne(https://pageone.pwc.kr/groupware/sportal/home.do?CLSYS=portal&CLMD=user&CLBIZ=Portal)에 접속해 Time Report(tms.samil.com)를 열어줘.
이미 로그인된 상태야. 열려 있는 PageOne/Time Report 탭이 있으면 그걸 쓰고, 로그인 과정은 건너뛰어.
혹시 로그인 화면이 나오면 아무것도 입력하지 말고 멈춰서 보고해.
주간 달력에서 {날짜}에 이미 PD Hour 항목이 있는지 확인하고, 있으면 중복 등록하지 말고 멈춰서 보고해.
없으면 해당 날짜 칸의 [New]로 '근무시간 등록' 창을 열고 다음을 입력해:
Project=Practice Development/PD Hour-이창훈(00973-90-738), Date={날짜}(달력 선택), Time={시간}시간 00분, 야간근무=미선택,
Activity='{Activity}' (최대 25자. 넘으면 의미를 유지하며 줄여), Remarks=빈칸.
프로젝트 행 첫 칸의 별표는 즐겨찾기 토글이니 누르지 말고 프로젝트명 셀을 클릭해.
입력값을 다시 확인한 뒤 Submit을 누르고, 결재 상신 확인창은 승인해.
제출 후 주간 달력에 반영됐는지 확인하고, 실제 들어간 값(특히 Activity 문구)을 한국어로 간결하게 표로 보고해줘.
```

## 화면 구조 메모 (스크립트를 고칠 때)

- Aside REPL의 Playwright 호환성: `getByRole`/`getByPlaceholder`/`inputValue`/`selectOption`/`:visible`은 없다. `page.evaluate`, `page.fill`, `page.mouse`, `page.keyboard`는 된다. REPL에서 `openTab`으로 연 탭은 실행이 끝나면 닫힌다.
- 전날부터 열려 있던 Time Report 탭은 '오늘' 칸이 어제에 머물고 [New]를 눌러도 등록 창이 안 열린다(`DIALOG_NOT_OPENED`). 그래서 스크립트는 시작할 때 탭을 항상 새로고침한다.
- 페이지에 숨은 중복 요소(Cancel/Submit/검색 버튼, 검색창)가 많다. `offsetWidth`로 보이는 것을 골라야 한다.
- 주간 달력은 dhtmlx scheduler다. 주간 prev/next 버튼은 숨겨져 있고, 화면에 보이는 Next는 왼쪽 미니 달력의 월 이동 버튼이다. 날짜 칸은 `.dhx_scale_holder[aria-label="2026.10.1"]` 형식이다(0을 채우지 않음). 등록된 항목은 `scheduler.getEvents()`에 `PRJTCD1/2/3`, `ACTIVITYTITLE`, `USE_TIME`으로 들어 있다.
- [New]는 날짜 칸 맨 위에 있는 투명한 `button.fake`다. 칸에 마우스를 올린 뒤 칸 상단 +7px을 클릭한다.
- 프로젝트 검색은 코드(`00973-90-738`)로는 결과가 없다. 이름(`PD Hour-이창훈`)으로 검색한다. 행을 선택하면 창 상단 `.resultBox`에 프로젝트명과 코드가 표시된다.
- 입력란: `#workSubmitDueDate`(날짜, readonly, [New]를 누른 칸의 날짜로 채워짐), `#useSubmitHour`, `#useSubmitMin`, `#lnSubmitStartWork`(야간, '미선택'), `#radActivity01`(직접 입력), `#TXTAREA_ACTIVITYTITLE`(maxlength 25), `#TXTAREA_REMARKS`(maxlength 50).
- Submit을 누르면 `.alertBox`에 "작성된 Time은 자동으로 결재로 상신됩니다. 등록 하시겠습니까?"가 뜬다. `a.btConfirm`이 [확인]이다.
