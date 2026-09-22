// 제목 없는 카피 백필 대상과 스킵 규칙을 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  TARGETS,
  nextPatch,
  tagsAreEmpty,
} from "../scripts/backfill-copy-titles-tags.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = resolve(root, "scripts/backfill-copy-titles-tags.mjs");

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 제목 없는 카피에 본문 기준 제목과 태그를 채운다"
  );
});

test("대상 41건은 id가 겹치지 않고 태그는 2~3개다", () => {
  assert.equal(TARGETS.length, 41);
  const ids = TARGETS.map((item) => item.id);
  assert.equal(new Set(ids).size, 41);
  for (const item of TARGETS) {
    assert.equal(item.id.length, 36);
    assert.ok(item.title.trim().length > 0, item.id);
    assert.equal(item.title.endsWith(":"), false, item.title);
    assert.match(item.title, /[가-힣]/);
    assert.equal(/^\d+[./]/.test(item.title), false, item.title);
    assert.equal(item.title.startsWith("—"), false, item.title);
    assert.ok(item.tags.length >= 2 && item.tags.length <= 3, item.title);
    assert.ok(item.phrase.length > 4, item.id);
  }
});

test("태그가 이미 있으면 덮어쓰지 않는다", () => {
  const target = TARGETS[0];
  assert.equal(tagsAreEmpty("[]"), true);
  assert.equal(tagsAreEmpty("null"), true);
  assert.equal(tagsAreEmpty([]), true);
  assert.equal(tagsAreEmpty("[\"툴\"]"), false);
  assert.deepEqual(
    nextPatch(null, target),
    { action: "missing" }
  );
  assert.equal(
    nextPatch({ body: "다른 본문", tags: "[]" }, target).action,
    "mismatch"
  );
  assert.equal(
    nextPatch(
      { body: `앞 ${target.phrase} 뒤`, tags: "[\"툴\"]" },
      target
    ).action,
    "skip"
  );
  const update = nextPatch(
    { body: `앞 ${target.phrase} 뒤`, tags: "[]" },
    target
  );
  assert.equal(update.action, "update");
  assert.equal(update.title, target.title);
  assert.equal(update.tags, JSON.stringify(target.tags));
});

test("본문 첫 줄이 제목이던 신규 4건의 제목과 태그를 정한다", () => {
  const expected = {
    "a513f878-83bd-4152-bc52-64853748bfcb": {
      title: "비개발자용 사이트 중간 점검 체크리스트",
      tags: ["SEO", "설정"],
    },
    "ed6d8d3c-ab67-43da-83cd-fab88c9f5cc0": {
      title: "플러터 앱 출시 자동화 프롬프트 4개",
      tags: ["프롬프트", "자동화"],
    },
    "2079628e-74c3-4039-b0d9-0df50a9a7e1f": {
      title: "인형집 스킨케어 캐릭터 3D 웹앱 프롬프트",
      tags: ["프롬프트", "디자인"],
    },
    "03786b49-e66b-4b40-a22b-3cc44eaa38e8": {
      title: "항공권 최저가 잡는 ChatGPT 프롬프트 5개",
      tags: ["GPT", "프롬프트"],
    },
  };
  const found = TARGETS.filter((item) => item.id in expected);
  assert.equal(found.length, 4);
  for (const item of found) {
    assert.equal(item.title, expected[item.id].title);
    assert.deepEqual(item.tags, expected[item.id].tags);
  }
});

test("본문 첫 줄이 제목이던 신규 7건의 제목과 태그를 정한다", () => {
  const expected = {
    "6bf20b16-892b-416e-ab39-07fcd28ac5f6": {
      title: "검색 상위 블로그 만드는 ChatGPT 질문 7개",
      tags: ["블로그", "SEO", "GPT"],
    },
    "94b84130-2832-4246-93e0-4600c9db2c2e": {
      title: "코덱스 주간 한도를 맥 메뉴바에 띄우기",
      tags: ["코덱스", "아스트라"],
    },
    "fd8d9dd4-119d-4700-bc64-b0e699d33a14": {
      title: "종목 분석 ChatGPT 프롬프트 7개",
      tags: ["금융", "프롬프트"],
    },
    "589845c8-103f-42a5-bd64-920430947ffc": {
      title: "클로드 워크플로 사령탑 설정",
      tags: ["클로드", "설정"],
    },
    "2af6a590-0f85-43c1-bef1-3972a913fa58": {
      title: "영어 학습 서비스 만드는 프롬프트 4개",
      tags: ["프롬프트", "자동화"],
    },
    "6302b64b-cb3e-4f70-ac94-7930fb8a1cb9": {
      title: "여러 에이전트에 팀 표준을 맞추는 teamai-cli",
      tags: ["툴", "에이전트"],
    },
    "2c9725c2-b4cd-49cc-8ee0-2ca57fbf080d": {
      title: "슬래시 명령어 20개",
      tags: ["프롬프트", "설정"],
    },
  };
  const found = TARGETS.filter((item) => item.id in expected);
  assert.equal(found.length, 7);
  for (const item of found) {
    assert.equal(item.title, expected[item.id].title);
    assert.deepEqual(item.tags, expected[item.id].tags);
  }
});

test("본문 첫 줄이 제목이던 신규 2건의 제목과 태그를 정한다", () => {
  const expected = {
    "a76f91d8-bff2-4fc3-8b1c-a3fed3e0e1f2": {
      title: "클로드 디자인할 때 볼 레퍼런스 3곳",
      tags: ["클로드", "디자인", "레퍼런스"],
    },
    "02991010-ffb5-4326-92e7-019b4346a874": {
      title: "PRD부터 아스트라 구현까지 프롬프트 6개",
      tags: ["아스트라", "프롬프트"],
    },
  };
  const found = TARGETS.filter((item) => item.id in expected);
  assert.equal(found.length, 2);
  for (const item of found) {
    assert.equal(item.title, expected[item.id].title);
    assert.deepEqual(item.tags, expected[item.id].tags);
  }
});

test("본문 첫 줄이 제목이던 신규 6건의 제목과 태그를 정한다", () => {
  const expected = {
    "4fb88054-562c-40bd-83f5-70d71d449187": {
      title: "아스트라 콘티와 Gemini Omni로 영상 만들기",
      tags: ["아스트라", "프롬프트"],
    },
    "3dc11988-4a90-4861-89c7-26211a62f929": {
      title: "Appllama MCP로 칼로리 추적 앱 만들기",
      tags: ["MCP", "디자인", "프롬프트"],
    },
    "096ca6b0-a2f7-432b-8b9a-114bc208cf99": {
      title: "바이브코딩 앱 UI 참고 사이트 4곳",
      tags: ["디자인", "레퍼런스"],
    },
    "7a563e6c-26fd-40f3-83b9-09ed5194a988": {
      title: "코딩 에이전트에 6단계를 심는 agent-skills",
      tags: ["스킬", "에이전트"],
    },
    "068143ac-747d-4941-9fbe-93b2cb6c7649": {
      title: "면접 준비 회사 분석 프롬프트 6개",
      tags: ["프롬프트", "학습"],
    },
    "37ce3e8f-5fcf-4d79-9d29-b84f14a0eb7a": {
      title: "웹사이트 배포 전 확인 체크리스트",
      tags: ["SEO", "설정"],
    },
  };
  const found = TARGETS.filter((item) => item.id in expected);
  assert.equal(found.length, 6);
  for (const item of found) {
    assert.equal(item.title, expected[item.id].title);
    assert.deepEqual(item.tags, expected[item.id].tags);
  }
});

test("본문 첫 줄이 제목이던 신규 1건의 제목과 태그를 정한다", () => {
  const expected = {
    "eeb94cc1-5567-4c45-b937-ecf135514c28": {
      title: "그록봇으로 돈 버는 프롬프트 30개",
      tags: ["그록", "프롬프트"],
    },
  };
  const found = TARGETS.filter((item) => item.id in expected);
  assert.equal(found.length, 1);
  for (const item of found) {
    assert.equal(item.title, expected[item.id].title);
    assert.deepEqual(item.tags, expected[item.id].tags);
  }
});

test("그록봇 팁 목록 1건의 제목과 태그를 정한다", () => {
  const expected = {
    "0c8bacb8-69b2-48dc-9c1e-67d3c9dd641e": {
      title: "그록봇을 제대로 쓰는 팁 20개",
      tags: ["그록", "설정"],
    },
  };
  const found = TARGETS.filter((item) => item.id in expected);
  assert.equal(found.length, 1);
  for (const item of found) {
    assert.equal(item.title, expected[item.id].title);
    assert.deepEqual(item.tags, expected[item.id].tags);
  }
});

test("본문 첫 줄이 제목이던 신규 3건의 제목과 태그를 정한다", () => {
  const expected = {
    "d6a587a3-064a-4437-8aef-44b55f6d55fe": {
      title: "코드를 제대로 뽑는 지시 3가지",
      tags: ["프롬프트", "설정"],
    },
    "d4f1ccd0-64c4-4a07-930c-067a8f1e56f1": {
      title: "Jev와 그록봇을 7분에 붙이는 셋업",
      tags: ["그록", "에이전트"],
    },
    "8f56a901-ce0b-423e-ba13-6ad7e4db369f": {
      title: "앱 배포 전 보안 체크리스트",
      tags: ["보안", "설정"],
    },
  };
  const found = TARGETS.filter((item) => item.id in expected);
  assert.equal(found.length, 3);
  for (const item of found) {
    assert.equal(item.title, expected[item.id].title);
    assert.deepEqual(item.tags, expected[item.id].tags);
  }
});

test("본문 첫 줄이 제목이던 json-render 1건의 제목과 태그를 정한다", () => {
  const expected = {
    "76b9e0da-c327-4a68-9e1f-bdb95766a073": {
      title: "바이브 코더가 json-render에 열광하는 이유 4가지",
      tags: ["디자인", "툴"],
    },
  };
  const found = TARGETS.filter((item) => item.id in expected);
  assert.equal(found.length, 1);
  for (const item of found) {
    assert.equal(item.title, expected[item.id].title);
    assert.deepEqual(item.tags, expected[item.id].tags);
    assert.equal(item.title.endsWith(":"), false);
    assert.notEqual(
      item.title,
      "바이브 코더들이 json-render에 열광하는 4가지 이유:"
    );
  }
});

test("포폴 특징과 pdfcn 2건의 제목과 태그를 정한다", () => {
  const expected = {
    "9fd6c617-d172-4c53-b4fc-d5610a9aa76b": {
      title: "올해 본 네카라쿠배 합격 포트폴리오 특징 10가지",
      tags: ["디자인", "학습"],
    },
    "35077dec-bdb4-4654-9213-93a6a90bc808": {
      title: "shadcn pdfcn이 PDF 생성을 바꾼 이유 5가지",
      tags: ["디자인", "툴"],
    },
  };
  const found = TARGETS.filter((item) => item.id in expected);
  assert.equal(found.length, 2);
  for (const item of found) {
    assert.equal(item.title, expected[item.id].title);
    assert.deepEqual(item.tags, expected[item.id].tags);
    assert.equal(item.title.endsWith(":"), false);
  }
});
