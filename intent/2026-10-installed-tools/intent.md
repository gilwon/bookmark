# Intent: 설치 현황 메뉴
Author: 길원 (MyMark 사용자). Status: draft.

## Problem
Claude, Codex, Grok, Gemini 에 각각 어떤 스킬과 플러그인이 깔려 있는지 한곳에서 볼 수 없다. 폴더를 하나씩 열어 확인해야 한다.

## Proposed outcome
사이드바에 설치 현황 메뉴가 생긴다. Claude·Codex·Grok·Gemini 를 모델 탭으로 나누고, 탭마다 스킬과 플러그인을 따로 보여 준다. 이름과 설명으로 검색한다.

## Affected users and systems
앱 사용자 본인. 로컬 머신의 `~/.claude`, `~/.codex`, `~/.grok`, `~/.gemini` 설치 상태.

## Constraints
기존 MyMark 목록과 같은 톤을 유지한다. 설치 상태는 이 머신에만 있으므로 스캔 스크립트가 만든 스냅샷을 쓴다. 파일 경로·토큰·인증 파일은 스냅샷에 넣지 않는다.

## Open questions
스냅샷 갱신 주기. 통합 검색·대시보드에 넣을지.
