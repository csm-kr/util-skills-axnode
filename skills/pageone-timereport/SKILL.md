---
name: pageone-timereport
description: 삼일회계법인(Samil PwC) PageOne의 Time Report(타임시트/Timetable)에 근무시간을 Aside 브라우저로 등록한다. "타임시트", "time report", "timetable", "PD Hour", "근무시간 등록", "오늘 time 써줘" 같은 요청에 사용.
---

# PageOne Time Report 등록 (Aside)

Aside 에이전트(`aside exec` / `aside session resume`)에 위임해 PageOne Time Report에 근무시간 항목을 등록한다.

## 0. 준비

1. `aside --update`를 실행한다. 업데이트 확인 프롬프트가 입력을 기다리면 `"y" | aside update`로 실행한다. 그다음 `aside guide`를 읽는다 (aside-browser 스킬 규칙).
2. PowerShell에서는 한글이 깨지지 않도록 매 명령 앞에 다음을 붙인다:
   `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;`
3. 출력이 길기 때문에 `2>&1 | Select-Object -Last 30`으로 마지막 보고만 받는다. timeout은 600000으로 둔다.

## 1. 입력값 확정

| 항목 | 기본값 | 비고 |
|---|---|---|
| 날짜 | 오늘 | 여러 날짜면 날짜별로 등록 |
| 시간 | 8시간 00분 | 사용자가 "보통 8시간"이라고 함 |
| Project | Practice Development/PD Hour-이창훈 (00973-90-738) | Partner/Manager 이창훈(150542)이 코드에 묶여 있어 승인자 칸이 따로 없음 |
| Activity | 사용자에게 받음 | **최대 25자.** 넘으면 의미를 유지하며 줄이고, 줄인 문구를 사용자에게 알린다 |
| 야간근무 / Remarks | 미선택 / 빈칸 | |

Activity가 없거나 날짜가 모호하면 등록하기 전에 사용자에게 묻는다.

## 2. 화면 경로 (참고)

- 사용자는 Aside 브라우저에서 PageOne에 이미 로그인되어 있다. 로그인 단계는 없다고 보고 바로 진행한다. 세션이 만료돼 로그인 화면이 나오면 사용자에게 직접 로그인해 달라고 한다.
- PageOne: https://pageone.pwc.kr/groupware/sportal/home.do?CLSYS=portal&CLMD=user&CLBIZ=Portal
- 왼쪽 위 점 9개 메뉴 또는 Quick Links → **Time Report** → 새 창(`tms.samil.com`)이 열린다.
- 주간 달력에서 해당 날짜 칸 아래를 누르면 **[New]** 버튼이 나온다 → "근무시간 등록" 창.
- Project Select의 Project / Non Project / Favorite 탭에서 PD Hour-이창훈을 검색해 행을 클릭한다.
- Date는 달력에서만 고를 수 있다. Time은 시(0~24)와 분(00/15/30/45) 드롭다운이다.
- Submit을 누르면 "작성된 Time은 자동으로 결재로 상신됩니다" 확인창이 뜬다. 승인하면 **바로 결재로 상신된다.**

## 3. 실행

새 세션이면 `aside "<프롬프트>"`, 이전 세션이 있으면 `aside session resume <id> "<프롬프트>"`를 쓴다. 프롬프트 템플릿:

```
PageOne(https://pageone.pwc.kr/groupware/sportal/home.do?CLSYS=portal&CLMD=user&CLBIZ=Portal)에 접속해 Time Report(tms.samil.com)를 열어줘.
이미 로그인된 상태야. 열려 있는 PageOne/Time Report 탭이 있으면 그걸 쓰고, 로그인 과정은 건너뛰어.
혹시 로그인 화면이 나오면 아무것도 입력하지 말고 멈춰서 보고해.
주간 달력에서 {날짜}에 이미 PD Hour 항목이 있는지 확인하고, 있으면 중복 등록하지 말고 멈춰서 보고해.
없으면 해당 날짜 칸의 [New]로 '근무시간 등록' 창을 열고 다음을 입력해:
Project=Practice Development/PD Hour-이창훈(00973-90-738), Date={날짜}(달력 선택), Time={시간}시간 00분, 야간근무=미선택,
Activity='{Activity}' (최대 25자. 넘으면 의미를 유지하며 줄여), Remarks=빈칸.
입력값을 다시 확인한 뒤 Submit을 누르고, 결재 상신 확인창은 승인해.
제출 후 주간 달력에 반영됐는지 확인하고, 실제 들어간 값(특히 Activity 문구)을 한국어로 간결하게 표로 보고해줘.
```

여러 날짜는 한 프롬프트에 날짜별 값을 나열하고, 날짜마다 중복 확인과 등록을 반복하도록 지시한다.

## 4. 보고

사용자에게 다음을 짧게 알린다:
- 등록된 값(표)
- 결재로 상신됐다는 점
- Activity를 줄였다면 줄인 문구
- 중복이나 로그인 문제로 멈췄다면 그 사실

Aside가 저장한 스크린샷 경로가 있으면 함께 알려준다.
