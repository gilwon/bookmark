// GitHub Star 설명의 정적 한국어 병기 처리를 검증한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasKorean,
  splitStarDescription,
  withKoreanTranslation,
} from "../src/lib/star-translation.ts";

describe("Star 설명 번역", () => {
  it("기존 병기 설명에서 한국어 문단을 분리한다", () => {
    assert.deepEqual(
      splitStarDescription("English description\n\n한국어 설명"),
      { original: "English description", korean: "한국어 설명" }
    );
    assert.equal(splitStarDescription("English\n\nStill English").korean, null);
  });

  it("설명에 한글이 있으면 그대로 사용한다", () => {
    assert.equal(hasKorean("이미 한국어 설명"), true);
    assert.equal(
      withKoreanTranslation("unknown/repo", "이미 한국어 설명", null),
      "이미 한국어 설명"
    );
  });

  it("같은 영문 설명이면 저장된 번역을 재사용한다", () => {
    assert.equal(
      withKoreanTranslation(
        "unknown/repo",
        "English description",
        "English description\n\n저장된 번역"
      ),
      "English description\n\n저장된 번역"
    );
  });

  it("정적 번역 매핑이 있으면 한국어를 병기한다", () => {
    assert.equal(
      withKoreanTranslation(
        "addyosmani/agent-skills",
        "Production-grade engineering skills for AI coding agents.",
        null
      ),
      "Production-grade engineering skills for AI coding agents.\n\nAI 코딩 에이전트를 위한 프로덕션급 엔지니어링 스킬 모음."
    );
  });

  it("신규 Star의 정적 번역을 병기한다", () => {
    assert.equal(
      withKoreanTranslation(
        "DoHyun468/claw-hwp",
        "Read, create & edit Korean Hangul Word Processor (.hwp / .hwpx) documents in Claude — Agent Skill built on rhwp WASM, with built-in browser preview. Runs locally, no Hancom Office, no cloud.",
        null
      ),
      "Read, create & edit Korean Hangul Word Processor (.hwp / .hwpx) documents in Claude — Agent Skill built on rhwp WASM, with built-in browser preview. Runs locally, no Hancom Office, no cloud.\n\nClaude에서 한글 문서(.hwp, .hwpx)를 읽고 생성·편집하는 에이전트 스킬. rhwp WASM과 브라우저 미리 보기를 내장해 한컴오피스나 클라우드 없이 로컬에서 실행됩니다."
    );
  });

  it("새 정적 번역을 병기한다", () => {
    assert.equal(
      withKoreanTranslation(
        "abi/screenshot-to-code",
        "Drop in a screenshot and convert it to clean code (HTML/Tailwind/React/Vue)",
        null
      ),
      "Drop in a screenshot and convert it to clean code (HTML/Tailwind/React/Vue)\n\n스크린샷을 넣으면 깔끔한 코드(HTML, Tailwind, React, Vue)로 변환합니다."
    );
  });

  it("새 Star의 정적 번역을 대표 사례에 병기한다", () => {
    assert.equal(
      withKoreanTranslation(
        "ai-for-developers/awesome-ai-coding-tools",
        "A curated list of AI-powered coding tools",
        null
      ),
      "A curated list of AI-powered coding tools\n\nAI 기반 코딩 도구를 엄선한 목록."
    );
    assert.equal(
      withKoreanTranslation(
        "gmickel/flow-next",
        "Repeatable agentic engineering. The workflow layer that turns AI coding agents into a disciplined factory: durable specs, fresh-context workers, adversarial cross-model reviews, receipts. Everything in your repo, zero dependencies. Claude Code · Codex · Cursor · Droid.",
        null
      ),
      "Repeatable agentic engineering. The workflow layer that turns AI coding agents into a disciplined factory: durable specs, fresh-context workers, adversarial cross-model reviews, receipts. Everything in your repo, zero dependencies. Claude Code · Codex · Cursor · Droid.\n\n반복 가능한 에이전틱 엔지니어링. AI 코딩 에이전트를 규율 있는 공장으로 바꾸는 워크플로 레이어로, 내구성 있는 명세, 새로운 컨텍스트의 워커, 적대적 크로스 모델 리뷰, 작업 증빙을 제공합니다. 모든 것이 저장소 안에 있으며 의존성은 없습니다. Claude Code · Codex · Cursor · Droid."
    );
    assert.equal(
      withKoreanTranslation(
        "pranshuparmar/witr",
        "Why is this running? Trace any process, port, container, or file back to what started it - CLI + TUI.",
        null
      ),
      "Why is this running? Trace any process, port, container, or file back to what started it - CLI + TUI.\n\n왜 이 프로세스가 실행 중일까요? 프로세스, 포트, 컨테이너 또는 파일을 시작한 원인까지 추적합니다. CLI + TUI."
    );
    assert.equal(
      withKoreanTranslation(
        "elizaOS/eliza",
        "Open source agentic operating system",
        null
      ),
      "Open source agentic operating system\n\n오픈소스 에이전트 운영체제."
    );
    assert.equal(
      withKoreanTranslation(
        "gooseworks-ai/goose-skills",
        "Library of Growth & GTM skills + data APIs for Claude Code, Codex, Cursor to run ads, social, content, lead gen, seo and data scraping",
        null
      ),
      "Library of Growth & GTM skills + data APIs for Claude Code, Codex, Cursor to run ads, social, content, lead gen, seo and data scraping\n\n그로스 및 GTM 스킬과 데이터 API 라이브러리. Claude Code, Codex, Cursor가 광고, 소셜, 콘텐츠, 리드 생성, SEO와 데이터 스크래핑을 실행하도록 합니다."
    );
    assert.equal(
      withKoreanTranslation(
        "khoj-ai/khoj",
        "Your AI second brain. Self-hostable. Get answers from the web or your docs. Build custom agents, schedule automations, do deep research, turn any online or local LLM into your personal, autonomous AI (gpt, claude, gemini, llama, qwen, mistral). Get started - free.",
        null
      ),
      "Your AI second brain. Self-hostable. Get answers from the web or your docs. Build custom agents, schedule automations, do deep research, turn any online or local LLM into your personal, autonomous AI (gpt, claude, gemini, llama, qwen, mistral). Get started - free.\n\n나만의 AI 세컨드 브레인. 자체 호스팅할 수 있으며 웹이나 문서에서 답을 얻고, 커스텀 에이전트를 만들고, 자동화를 예약하고, 심층 리서치를 수행할 수 있습니다. 온라인 또는 로컬 LLM(gpt, claude, gemini, llama, qwen, mistral)을 개인용 자율 AI로 바꿔 줍니다. 무료로 시작하세요."
    );
    assert.equal(
      withKoreanTranslation(
        "nowork-studio/notfair-plugin",
        "Open-source SEO, GEO, and marketing skills for AI agents.",
        null
      ),
      "Open-source SEO, GEO, and marketing skills for AI agents.\n\nAI 에이전트를 위한 오픈소스 SEO, GEO 및 마케팅 스킬."
    );
    assert.equal(
      withKoreanTranslation(
        "NVIDIA/elements",
        "NVIDIA Design System and UI Agent Harness for AI/ML Factories, Robotics, and Autonomous Vehicles",
        null
      ),
      "NVIDIA Design System and UI Agent Harness for AI/ML Factories, Robotics, and Autonomous Vehicles\n\nAI/ML 팩토리, 로보틱스 및 자율주행 차량을 위한 NVIDIA 디자인 시스템 및 UI 에이전트 하니스."
    );
    assert.equal(
      withKoreanTranslation(
        "SmythOS/smythos-studio",
        "SmythOS Studio: Open-Source Visual AI Agent Builder and deployable runtime stack from SmythOS. Start with an intuitive drag-and-drop workspace, extend with custom code, and deploy your agents anywhere — local, cloud, or edge — with full governance and control.",
        null
      ),
      "SmythOS Studio: Open-Source Visual AI Agent Builder and deployable runtime stack from SmythOS. Start with an intuitive drag-and-drop workspace, extend with custom code, and deploy your agents anywhere — local, cloud, or edge — with full governance and control.\n\nSmythOS의 오픈소스 비주얼 AI 에이전트 빌더이자 배포 가능한 런타임 스택. 직관적인 드래그 앤 드롭 작업 공간에서 시작해 커스텀 코드로 확장하고, 완전한 거버넌스와 제어 기능을 바탕으로 로컬, 클라우드 또는 엣지 어디에나 에이전트를 배포하세요."
    );
    assert.equal(
      withKoreanTranslation(
        "vectorize-io/hindsight",
        "Hindsight: Agent Memory That Learns",
        null
      ),
      "Hindsight: Agent Memory That Learns\n\nHindsight: 학습하는 에이전트 메모리."
    );
  });

  it("영문 전용 신규 Star 29개의 정적 번역을 병기한다", () => {
    const cases = [
      ["anthropics/defending-code-reference-harness", "Skills for threat modeling, scanning, triage, patching, plus an autonomous scanning harness you can /customize"],
      ["anthropics/knowledge-work-plugins", "Open source repository of plugins primarily intended for knowledge workers to use in Claude Cowork"],
      ["arknow91/liquid-taffy", "Three liquid interactions you can grab, pull, and let snap back — anchored dropdown, morphing dropdown and speed dial on one goo engine."],
      ["ayghri/i-have-adhd", "A skill to stop your coding agent from burying the answer. ADHD-friendly output."],
      ["baidu/Unlimited-OCR", "Unlimited OCR Works: Welcome the Era of One-shot Long-horizon Parsing."],
      ["CodebuffAI/freebuff", "The free coding agent"],
      ["CopilotKit/OpenBot", "Open-source AI coworkers that each get a computer of their own: a browser, files and tools, with every action decided before it happens and recorded after. Bring any AG-UI agent."],
      ["deepseek-ai/deepseek-harness", "DeepSeek Harness: Everything is a Plugin."],
      ["drawdb-io/drawdb", "Free, simple, and intuitive online database diagram editor and SQL generator."],
      ["firecrawl/pdf-inspector", "Fast Rust library for PDF inspection, classification, and text extraction. Intelligently detects scanned vs text-based PDFs to enable smart routing decisions."],
      ["FoundationAgents/MetaGPT", "🌟 The Multi-Agent Framework: First AI Software Company, Towards Natural Language Programming"],
      ["getagentseal/codeburn", "Free, local tool to track AI coding token usage and cost across 37 tools and agents (Claude Code, Cursor, Codex, Gemini and more), by model, project, and task. npx codeburn"],
      ["holaboss-ai/holaOS", "Open-source All in One AI agent workspace. Run any agent — Claude Code, Codex — across your tools (100+ integrations + MCP), apps, browser, and files, with shared memory. Built-in models or BYOK."],
      ["ifixai-ai/iFixAi", "Independent Auditing of AI Agents. Run by human or the agent itself, to answer the most crucial question in the AI Agent Economy. Is the agent doing what is supposed to do? With iFixAi you can have this answer in less than 120 seconds."],
      ["lightningpixel/modly", "Desktop app to generate 3D models from images or prompt using local AI — runs entirely on your GPU"],
      ["MapleTechLabs/maple", "OpenTelemetry observability platform"],
      ["MarsZ42/OrbitOS", "An AI-powered personal productivity system where knowledge management and daily task planning are intelligently orchestrated by your AI assistant."],
      ["odysseus-dev/odysseus", "Self-hosted AI workspace. "],
      ["shadcn/improve", "Use your most capable model to audit your codebase and write plans for cheaper models to execute."],
      ["SteveTheKiller/KillerPDF", "Free and open-source PDF editor for Windows. View, annotate, OCR, merge, split, edit text, draw, sign, fill forms, print, flatten, and open password-protected PDFs without a subscription. Install or run portable. GPLv3"],
      ["TanStack/query", "🤖 Powerful asynchronous state management, server-state utilities and data fetching for the web. TS/JS, React Query, Solid Query, Svelte Query and Vue Query."],
      ["TanStack/router", "🤖 A client-first, server-capable, fully type-safe router and full-stack framework for the web (React and more)."],
      ["unclebob/swarm-forge", "A simple tool for coordinating several AI agents."],
      ["unslothai/unsloth", "Local UI to run and train LLMs and diffusion models, including Qwen3.8, Kimi K3, MiniMax-H3, Gemma 4, DeepSeek-V4, FLUX and more."],
      ["vercel-labs/agent-browser", "Browser automation CLI for AI agents"],
      ["wandb/openui", "OpenUI let's you describe UI using your imagination, then see it rendered live."],
      ["xai-org/x-algorithm", "Algorithm powering the For You feed on X"],
      ["zubair-trabzada/ai-marketing-claude", "AI Marketing Suite for Claude Code. 15 marketing skills with parallel subagents — audit any website, generate copy, email sequences, ad campaigns, content calendars, competitive intelligence, and client-ready PDF reports."],
      ["zulip/zulip", "Zulip server and web application. Open-source team chat that helps teams stay productive and focused."],
    ];
    assert.equal(cases.length, 29);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });
});
