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

  it("영문 전용으로 남아 있던 신규 Star 15개의 정적 번역을 병기한다", () => {
    const cases = [
      ["addyosmani/web-quality-skills", "Agent Skills for optimizing web quality based on Lighthouse and Core Web Vitals."],
      ["aidankinzett/claude-git-pr-skill", "Professional GitHub PR review skill for Claude Code with pending reviews, code suggestions, and user approval workflow"],
      ["builderz-labs/mission-control", "Self-hosted control plane for AI agents: dispatch tasks, review runs, track spend, and operate OpenClaw, Claude Code, Codex, and other runtimes."],
      ["chuspeeism/dashi-ppt-skill", "An AI-agent skill that generates browser-editable presentations from multiple visual themes, exportable to HTML, PDF, and PPTX."],
      ["freestylefly/awesome-gpt-image-2", "Prompt as Code | GPT-Image2 工业级提示词引擎与模板库，470+ 个案例逆向工程，20+ 套工业级模板，并提炼出Skills，持续更新中"],
      ["hashicorp/agent-skills", "A collection of Agent skills and Claude Code plugins for HashiCorp products."],
      ["holaboss-ai/holaOS", "Open-source agentic workspace enterprises can make their own. Connect the systems you already run — 100+ integrations, MCP, chat tools, apps"],
      ["iamlukethedev/Hermes3D", "Hermes3D is an open source 3D engine built on Hermes Agents for creating games, simulations, and high-performance 3D applications."],
      ["levnikolaevich/claude-code-skills", "Standalone engineering skills for Claude Code and Codex: review, audit, optimization, testing, product discovery, architecture, and safe publishing."],
      ["MengTo/kage", "An interactive five-chapter night walk through a Kyoto mountain temple, rendered live in Three.js."],
      ["MengTo/threeui", "Open-source ThreeUI Community catalog with live interactive components and complete Community source."],
      ["miketromba/css.glass", "The Glassmorphism CSS Generator (css.glass)"],
      ["NanoNets/Graft", "Turbocharge Claude Code, Cursor, Codex, Gemini & every coding agent: faster, cheaper, with contextual understanding specific to your codebase."],
      ["OthmanAdi/planning-with-files", "Persistent file-based planning for AI coding agents and long-running tasks. Crash-proof markdown plans, session recovery after /clear and compaction, per-turn re-injection against context rot, deterministic completion gate. Manus-style. Install from npm, the Claude Code plugin marketplace, or npx skills. Codex, Cursor, OpenCode, 60+ agents."],
      ["public-apis/public-apis", "A collective list of free APIs"],
    ];
    assert.equal(cases.length, 15);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("GitHub 설명이 비어도 매핑 한국어를 채운다", () => {
    assert.equal(
      withKoreanTranslation("andrewyng/openworker", null, null),
      "데스크톱에서 돌아가는 오픈소스 AI 동료. 채팅이 아니라 문서, 슬랙 답장, 캘린더처럼 끝난 결과물을 만듭니다."
    );
    assert.equal(
      withKoreanTranslation(
        "andrewyng/openworker",
        null,
        "데스크톱에서 돌아가는 오픈소스 AI 동료. 채팅이 아니라 문서, 슬랙 답장, 캘린더처럼 끝난 결과물을 만듭니다."
      ),
      "데스크톱에서 돌아가는 오픈소스 AI 동료. 채팅이 아니라 문서, 슬랙 답장, 캘린더처럼 끝난 결과물을 만듭니다."
    );
    assert.equal(
      withKoreanTranslation("unknown/repo", null, "이미 있는 한글"),
      "이미 있는 한글"
    );
  });

  it("설명이 비어 있던 Star 21개의 저장소 설명을 한글로 채운다", () => {
    const repos = [
      "CloudAI-X/threejs-skills",
      "ExplainingDeveloper/ai-chat",
      "Julian-adv/OpenMMO",
      "LCNINE/almondyoung-server",
      "LeeYudok/doksam-ui",
      "Ranteck/graph-engineer",
      "Subhan-code/Amicro--Micro-transitions-",
      "TOKTOKHAN-DEV/agent-company",
      "amaancoderx/npxskillui",
      "andrewyng/openworker",
      "beyondworks/argo",
      "codefactory-co/kimoring-ai-skills",
      "dandacompany/dante-coffee",
      "dandacompany/dantelabs-agentic-school",
      "dbsxortime/design-studio-plugins",
      "eisenjimmy/autoTHREADS",
      "falcons-eyes/agent-fabric-dispatch",
      "serendipity1004/cc-feature-implementer",
      "sophiamyang/finger-frame-effect-ai",
      "vfxguyai/newvideogenerator",
      "withmarbleapp/os-taxonomy",
    ];
    assert.equal(repos.length, 21);
    for (const repo of repos) {
      const result = withKoreanTranslation(repo, null, null);
      assert.equal(hasKorean(result), true, repo);
    }
  });

  it("한글이 없던 신규 Star 10개의 정적 번역을 병기한다", () => {
    const cases = [
      ["anomalyco/opencode", "The open source coding agent."],
      ["openai/codex", "Lightweight coding agent that runs in your terminal"],
      ["Tencent/AI-Infra-Guard", "A full-stack AI Red Teaming platform securing AI ecosystems via Agent Scan, Skills Scan, MCP scan, AI Infra scan and LLM jailbreak evaluation."],
      ["calesthio/OpenMontage", "World's first open-source, agentic video production system. 12 production pipelines, 100+ tools, 700+ agent skill and production-knowledge files. Turn your AI coding assistant into a full video production studio."],
      ["Leonxlnx/unlazy", "Anti-laziness skill for AI agents. Core: the Depth Tree method, which splits a task N layers deep and gives every leaf the full time budget of the whole task, so effort multiplies with depth. Grounded in 2025-2026 research on model laziness, underthinking and premature completion."],
      ["chaitanyagiri/munder-difflin", "local multi-agent harness"],
      ["akitaonrails/ai-memory", "Solution for long term memory for agent coding CLIs and to facilitate handoff between different agent vendors"],
      ["volcengine/OpenViking", "Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills."],
      ["MacPaw/cleanmymac-cli", "Clean Xcode, Docker, Homebrew, and developer caches, remove project and AI artifacts, analyze storage, and reclaim disk space from the Terminal."],
      ["milind-soni/OpenMausBot", "Open Source Alternative to Grok Bot with a virtual machine that bots can use"],
    ];
    assert.equal(cases.length, 10);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("한글이 없던 신규 Star 12개의 정적 번역을 병기한다", () => {
    const cases = [
      ["AaronRoeF/claude-code-patterns", "Field-tested Claude Code patterns & anti-patterns for personal agents — an AI workflow that compounds: knowledge base, memory consolidation, hooks, subagents. Enterprise agent trust: agentrust-io.com. Updated monthly."],
      ["AgriciDaniel/claude-seo", "Universal SEO skill for Claude Code. 25 sub-skills + 18 sub-agents covering technical SEO, E-E-A-T, schema, GEO/AEO, backlinks, local SEO, maps intelligence, semantic clustering, e-commerce SEO, international SEO, Google APIs, and PDF/Excel reporting. Optional DataForSEO, Firecrawl, and Banana extensions."],
      ["agentplugins/agent-plugins-spec", "Agent Plugins Specification v1.0.0 — A minimal standard for packaging agent extensions into distributable plugins"],
      ["agentskills/agentskills", "Specification and documentation for Agent Skills"],
      ["b-nnett/grok-bot-0.18-reconstructed", "Unofficial source-oriented reconstruction and extension of Grok Bot 0.18.0 for macOS"],
      ["fivetaku/tikeytaka", "Central API key vault for Claude Code — encrypted cloud-synced vault, zero sign-up, auto-wire keys into projects"],
      ["liustack/modlens", "The first vision plugin for DeepSeek Harness, and the vision bridge for every text-only coding agent. Paste an image, get structured JSON evidence (OCR, layout, semantics). | 全网最强 DeepSeek Harness 外挂视觉插件，为 DeepSeek、GLM 等纯文本模型外挂视觉能力，粘贴图片即得结构化 JSON 证据（OCR、版面、语义）。"],
      ["marceloprates/prettymaps", "Draw pretty maps from OpenStreetMap data! Built with osmnx +matplotlib + shapely"],
      ["rampstackco/claude-skills", "Stack-agnostic Claude Skills covering the full website lifecycle: brand, design, content, SEO, dev, ops, growth, and research. Build, ship, audit, optimize."],
      ["videosdk-community/ai-telephony-demo", "Build an AI Telephony Agent for Inbound and Outbound Calls"],
      ["ZestfulPulse/ios-app-store-submit", "Claude Code skill for automating iOS App Store submission."],
      ["freestylefly/awesome-gpt-image-2", "Prompt as Code | GPT-Image2 工业级提示词引擎与模板库，530+ 个案例逆向工程，20+ 套工业级模板，并提炼出Skills，持续更新中"],
    ];
    assert.equal(cases.length, 12);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("한글이 없던 신규 Star 2개의 정적 번역을 병기한다", () => {
    const cases = [
      ["johnfkoo951/cmds-system-files", "Knowledge architecture for a 10,000-note Obsidian vault — 5 system files + 7 shared rules + 8 slash commands, shared openly with humans and AI agents. Live: https://system.cmdspace.work"],
      ["sammwyy/clay", "Compact coding-agent harness built for people who prefer to stay in the terminal"],
    ];
    assert.equal(cases.length, 2);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("About가 바뀌어 한글이 빠진 Star 2개의 정적 번역을 다시 병기한다", () => {
    const cases = [
      ["wilgon456/orca-agent-cleanup", "Safely audit and quarantine Orca-installed agent skills, hooks, and CLI residue on Windows, macOS, and Linux."],
      ["SteveTheKiller/KillerPDF", "Free and open-source PDF editor for Windows. View, annotate, OCR, merge, split, crop, rotate, compare, edit text, draw, sign, fill forms, print, flatten, and open password-protected PDFs without a subscription."],
    ];
    assert.equal(cases.length, 2);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("한글이 없던 신규 Star 7개의 정적 번역을 병기한다", () => {
    const cases = [
      ["GENEXIS-AI/gpt-image-skill", "Generate GPT images from Codex or Claude Code using a ChatGPT subscription, without the Images API."],
      ["LilMGenius/paperthin", "Low-level agentic design patterns. Turning old engineering wisdom into reflexes your agent reaches for on its own—on any agent."],
      ["RizRiyz/luvus", "Mission control for your AI agents"],
      ["github/gh-aw", "GitHub Agentic Workflows"],
      ["mcneel/RhinoAI", "AI features for Rhino"],
      ["microsoft/flint-chart", "Flint is a visualization language that lets AI agents reliably create expressive, good-looking charts from simple, human-editable chart specs."],
      ["vercel-labs/agent-skills", "Vercel's official collection of agent skills"],
    ];
    assert.equal(cases.length, 7);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("한글이 없던 신규 Star 9개의 정적 번역을 병기한다", () => {
    const cases = [
      ["AgriciDaniel/claude-obsidian", "Self-organizing AI second brain for Obsidian + Claude Code. Drop any source and Claude reads, links, and files it into one connected knowledge graph of plain Markdown you own."],
      ["beyondeth/my-blog-app-selfhost", "Aigory Self-host: an MIT-licensed blog, community, and MCP automation platform"],
      ["harry0703/MoneyPrinterTurbo", "利用 AI 大模型和自动化工作流，根据主题或关键词一键生成高清短视频。Generate HD short videos from a topic or keyword with an automated AI workflow."],
      ["pixlcore/xyops", "A complete workflow automation and server monitoring system."],
      ["Spielewoy/autoprompt-skill", "Autoprompt is a coding-agent skill that cuts failures by 45% on agentic coding tasks."],
      ["superset-sh/superset", "Superset is an agentic IDE to orchestrate 100+ coding agents in parallel. Run any agent with your own subscription."],
      ["trailhq/Graft", "Turbocharge Claude Code, Cursor, Codex, Gemini & every coding agent: faster, cheaper, with contextual understanding specific to your codebase."],
      ["tsingyuai/growth-lab", "An end-to-end growth tool that understands the product, fetch the data it needs, researches the market, executes campaigns, and reviews results to improve the next round of growth."],
      ["wilgon456/orca-agent-cleanup", "Safely audit and quarantine Orca-installed agent skills, hooks, and CLI residue on Windows."],
    ];
    assert.equal(cases.length, 9);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("한글이 없던 신규 Star 5개의 정적 번역을 병기한다", () => {
    const cases = [
      ["1weiho/open-slide", "A slide framework built for agents."],
      ["Tencent/BrowserSkill", "Let AI agents use your real, logged-in browser without interrupting your work. CLI + extension for browser automation across any shell-capable AI agent."],
      ["SenteLabsAI/OpenExecutive", "AI-powered virtual executive team — a single coherent executive persona backed by 8 specialist Claude agents (FastAPI + Next.js)."],
      ["vercel-labs/skills", "The open agent skills tool - npx skills"],
      ["can1357/oh-my-pi", "⌥ Coding agent with the IDE wired in"],
    ];
    assert.equal(cases.length, 5);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("한글이 없던 최신 Star 5개의 정적 번역을 병기한다", () => {
    const cases = [
      ["sirmalloc/ccstatusline", "🚀 Beautiful highly customizable statusline for Claude Code CLI with powerline support, themes, and more."],
      ["ezBuilder/chatgpt2codex", "macOS-first local MCP and Actions runtime that gives ChatGPT real coding hands over trusted projects"],
      ["remorses/playwriter", "Chrome extension & CLI to let agents control your browser. Runs Playwright snippets in a stateful sandbox. Available as CLI or MCP"],
      ["devbrother2024/skills", "Reusable Agent Skills for AI coding workflows"],
      ["anthropics/claude-plugins-community", "Community plugin marketplace for Claude Cowork and Claude Code. Read-only mirror — submit plugins at clau.de/plugin-directory-submission."],
    ];
    assert.equal(cases.length, 5);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("한글이 없던 신규 Star 6개의 정적 번역을 병기한다", () => {
    const cases = [
      ["heyman333/agent-notion-template-docs", "Make your AI agent write documents like Notion — Claude Code skill that locks document structure & Notion visual style"],
      ["omacom/omarchy", "Beautiful, Modern & Opinionated Linux"],
      ["HKUDS/DeepTutor", "DeepTutor: Lifelong Personalized Tutoring. https://deeptutor.info/."],
      ["thebuggeddev/football-stadium", "A 3D football stadium to visualize where you sit in the seat before you buy it"],
      ["ln-dev7/logos-apps", "🎨 A free, open collection of 15,000+ clean SVG logos for apps, tools & tech brands."],
      ["vorssaintapp/vorssaint-utils", "Free and open-source macOS menu bar toolkit."],
    ];
    assert.equal(cases.length, 6);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("한글이 없던 최신 Star 6개의 정적 번역을 병기한다", () => {
    const cases = [
      ["h4ckf0r0day/obscura", "The headless browser for AI agents and web scraping"],
      ["Junhan2/oh-my-fable", "Claude Fable 5.1 prompting guide as Claude Code skills (KO/EN/ZH). Output quality goes up on Opus 5 and Sonnet 5 too."],
      ["ddalcu/mlx-serve", "Native LLM inference server for Apple Silicon. OpenAI + Anthropic API compatible. No Python. Includes MLX Core macOS app with chat, agent mode, and tool calling."],
      ["MobAI-App/simslim", "Run more iOS simulators on one Mac by disabling background daemons a simulator doesn't need"],
      ["zenstory-ai/oh-story-claudecode", "网文/小说写作 skill 包，覆盖长篇与短篇网络小说的扫榜、拆文、写作、去AI味、封面图全流程 | An all-in-one skill pack for long- and short-form web fiction."],
      ["career-ops-hq/career-ops", "Open-source AI job search: scan job portals, evaluate listings into a structured A-H report with a global 1-5 score, tailor your CV, track applications — runs locally in your AI coding CLI (Claude Code, Codex, OpenCode, Antigravity…)"],
    ];
    assert.equal(cases.length, 6);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("미동기화 Star 4개의 정적 번역을 병기한다", () => {
    const cases = [
      ["anthropics/claude-cookbooks", "A collection of notebooks/recipes showcasing some fun and effective ways of using Claude."],
      ["MochiDiffusion/MochiDiffusion", "Run Stable Diffusion on Mac natively"],
      ["kelviq/tare", "Ask Claude Code where your usage went. Token audit, limit diagnosis and usage forensics — built from the session logs already on your machine, nothing leaves it."],
      ["CopilotKit/OpenTag", "OpenTag: The Channels SDK starter application, a self-hosted AI on-call triage bot for Slack and Microsoft Teams, built with AG-UI and LangGraph. Fork it and ship your own."],
    ];
    assert.equal(cases.length, 4);
    for (const [repo, description] of cases) {
      const result = withKoreanTranslation(repo, description, null);
      assert.equal(result.startsWith(description), true, repo);
      assert.equal(hasKorean(result), true, repo);
      assert.equal(result.includes("\n\n"), true, repo);
    }
  });

  it("GitHub About가 비어 있는 신규 Star는 한국어만 채운다", () => {
    assert.equal(
      withKoreanTranslation("revfactory/skills", null, null),
      "Robin이 만들어 쓰는 Claude Code 스킬 모음. Spring Boot 초기화, HWP, 이미지 생성, 에이전트 리서치, 워크로그, 크롤링 등을 포함합니다."
    );
    assert.equal(
      withKoreanTranslation("madwind0526/MeetingNote", null, null),
      "회의 기본 정보, 참석자, A/I List, Agenda를 관리하고 회의 오디오를 STT로 분석해 회의록 초안을 만드는 PC 앱입니다."
    );
  });
});
