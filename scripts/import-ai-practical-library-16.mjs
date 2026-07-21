// AI 실무 PDF 16건의 전문과 복사용 지시문을 번호순으로 저장한다
import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { basename, dirname, resolve } from "path";
import { existsSync, readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const downloads = "/Users/gilwon/Downloads";
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^(\"|')|(\"|')$/g, "");
  }
}

const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const baseTime = Date.now();
const documentNames = [
  ["2-01", "AI 도입 ROI 계산 템플릿"],
  ["2-02", "AI 도구 연결(MCP) 시작 모음"],
  ["2-03", "프롬프트 체크리스트 · 같은 질문도 답이 달라지는 5원칙"],
  ["2-04", "자동화 우선순위 진단표"],
  ["2-05", "외주로 나가던 일 7가지, 클로드로 직접"],
  ["2-06", "외주 발주 전 체크리스트"],
  ["2-07", "업무별 AI 도구 추천표"],
  ["2-08", "업무별 실전 프롬프트 모음"],
  ["2-09", "비개발자 바이브코딩 입문 · 내부도구 아이디어"],
  ["2-10", "데이터 정리 프롬프트 모음"],
  ["2-11", "바이브코딩 입문 1권 · 바이브코딩이란"],
  ["2-12", "바이브코딩 입문 2권 · 도구와 환경"],
  ["2-13", "바이브코딩 입문 3권 · 제대로 시키는 법"],
  ["2-14", "바이브코딩 입문 4권 · 막힘 돌파와 완성"],
  ["2-15", "바이브코딩 입문 5권 · 진짜 실력"],
  ["2-16", "맥북으로 유튜브 영상 만들기 플레이북"],
];
const documents = documentNames.map(([number, name], index) => {
  const filename = readdirSync(downloads).find((entry) => entry.startsWith(`${number}.`) && entry.endsWith(".pdf"));
  if (!filename) throw new Error(`${number} PDF를 찾지 못했습니다.`);
  return {
    number,
    title: `${number}. ${name}`,
    path: resolve(downloads, filename),
    createdAt: new Date(baseTime - index * 1000).toISOString(),
  };
});

const extracted = new Map(documents.map((document) => [document.number, execFileSync("pdftotext", ["-layout", document.path, "-"], { encoding: "utf8" })]));
const textNode = (text) => ({ type: "text", text });
const paragraph = (text) => ({ type: "paragraph", content: text ? [textNode(text)] : undefined });

function pageContent(document) {
  const pdfPages = extracted.get(document.number).split("\f").map((page) => page.trim()).filter(Boolean);
  const content = [
    { type: "heading", attrs: { level: 1 }, content: [textNode(document.title)] },
    { type: "blockquote", content: [paragraph(`원본 PDF. ${basename(document.path).normalize("NFC")}`)] },
  ];
  for (const [index, pdfPage] of pdfPages.entries()) {
    content.push({ type: "heading", attrs: { level: 2 }, content: [textNode(`${index + 1}쪽`)] });
    for (const block of pdfPage.split(/\n\s*\n/)) {
      const text = block.split("\n").map((line) => line.trim()).filter(Boolean).join(" ").replace(/\s{2,}/g, " ");
      if (text) content.push(paragraph(text));
    }
    if (index < pdfPages.length - 1) content.push({ type: "horizontalRule" });
  }
  return JSON.stringify({ type: "doc", content });
}

function linesBetween(number, start, end, occurrence = 0) {
  const lines = extracted.get(number).split("\n").map((line) => line.replace(/\f/g, "").trim());
  const matches = lines.flatMap((line, index) => line.includes(start) ? [index] : []);
  const startIndex = matches[occurrence] ?? -1;
  const endIndex = lines.findIndex((line, index) => index > startIndex && line.includes(end));
  if (startIndex < 0 || endIndex < 0) throw new Error(`${number}에서 '${start}' 블록을 찾지 못했습니다.`);
  return lines.slice(startIndex, endIndex).filter(Boolean).join(" ")
    .replace(/\s+([·•]\s*)/g, "\n$1")
    .replace(/\s+(-\s+)/g, "\n- ")
    .replace(/\s+(\[[^\]]+\])/g, "\n\n$1")
    .replace(/\s+(#{1,3}\s+)/g, "\n\n$1")
    .replace(/\s+copy\b/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const promptSpecs = [
  ["2-02", "노션 회의록 요약", "노션에서 [회의록] 페이지를 읽고", "예상 결과"],
  ["2-02", "슬랙 대화 요약", "[#general] 채널에서 오늘 오전에 오간 대화를 읽고 요약해줘.", "예상 결과"],
  ["2-02", "구글 캘린더 빈 시간 찾기", "내 구글 캘린더에서 [다음 주] 평일 중에", "예상 결과"],
  ["2-02", "구글 드라이브 파일 찾기", "내 구글 드라이브에서 파일명에 [견적서]", "예상 결과"],
  ["2-02", "지메일 중요 메일 정리", "받은편지함에서 [어제부터 지금까지]", "예상 결과"],
  ["2-02", "연결 도구 기능 확인", "[연결한 도구 이름]에 연결돼 있지?", "예상 결과"],

  ["2-03", "SNS 홍보글 완성형 프롬프트", "[역할] 너는 소상공인 SNS 마케팅을 돕는 카피라이터야.", "이렇게 나옵니다"],
  ["2-03", "5원칙 범용 프롬프트 틀", "[역할] 너는 [[어떤 전문가", "이렇게 나옵니다"],
  ["2-03", "블로그 본문 초안 작성", "앞에서 정한 목차로 블로그 본문 초안을 써줘.", "기준 주고 검토 시키기"],
  ["2-03", "편집자 관점 초안 검토", "이제 너는 깐깐한 편집자야.", "검토 반영해 다시 쓰기"],
  ["2-03", "검토 반영 전체 재작성", "방금 짚은 것들을 반영해서 전체를 다시 써줘.", "이렇게 나옵니다"],

  ["2-04", "업무 자동화 우선순위 진단", "너는 업무 자동화 컨설턴트야.", "예상 결과"],
  ["2-04", "고객 문의 답변 초안", "너는 우리 쇼핑몰의 고객 응대 담당자야.", "예상 결과"],
  ["2-04", "엑셀 업무 도움", "너는 엑셀 함수 도우미야.", "예상 결과"],

  ["2-05", "첨부 파일 핵심 요약", "이 파일이 무슨 내용인지 한 문단으로 요약하고", "핵심"],
  ["2-05", "B2B 제안서 초안", "당신은 B2B 제안서를 10년간", "예상 결과"],
  ["2-05", "엑셀 데이터 정리", "당신은 비개발자도 따라 하게 가르치는 엑셀·데이터", "예상 결과"],
  ["2-05", "경쟁사 리서치", "당신은 사업 전략 리서치 애널리스트", "예상 결과"],
  ["2-05", "계약서 위험 조항 검토", "당신은 중소사업자를 돕는 계약 검토 도우미", "예상 결과"],
  ["2-05", "랜딩페이지 카피 작성", "당신은 전환율 높은 랜딩페이지", "예상 결과"],
  ["2-05", "연결 도구 업무 비서", "당신은 내 업무 비서입니다.", "예상 결과"],
  ["2-05", "회사 견적서 스킬 만들기", "우리 회사 견적서 양식을 스킬로", "예상 결과"],

  ["2-06", "외주 발주 전 기획 점검", "너는 비개발자 사장의 외주 발주를 돕는 IT 기획자다.", "예상 결과"],

  ["2-07", "자바스크립트 오류 수정", "아래는 우리 회사 예약 페이지의 자바스크립트 파일이야.", "결과가 갈리는 지점"],
  ["2-07", "신규 고객 환영 메일", "역할: 너는 우리 브랜드의 카피라이터다.", "결과가 갈리는 지점"],
  ["2-07", "최신 규정 근거 조사", "역할: 너는 신중한 조사 담당자다.", "결과가 갈리는 지점"],
  ["2-07", "고객 리뷰 분석", "역할: 너는 마케팅 분석가다.", "최신 트렌드 확인"],
  ["2-07", "업종 최신 트렌드 조사", "[우리 업종]에서 2026년 고객이 가장 중요하게", "홍보 문구 쓰기"],
  ["2-07", "근거 기반 홍보 문구", "역할: 너는 우리 브랜드 카피라이터다.", "이미지 만들기"],
  ["2-07", "카드뉴스 배경 이미지", "다음 홍보 문구에 어울리는 인스타 카드뉴스 배경 이미지를 만들어줘.", "이 흐름의 핵심"],

  ["2-08", "B2B 제안서 구조화", "당신은 B2B 제안서를 10년간 써온 전문 컨설턴트", "복사해 쓰는 프롬프트 B"],
  ["2-08", "투자·영업 발표 구성", "당신은 투자 피치와 영업 발표", "왜 먹히나"],
  ["2-08", "엑셀 데이터 정리 절차", "당신은 비개발자도 따라 하게 가르치는 엑셀·데이터", "복사해 쓰는 프롬프트 B"],
  ["2-08", "숫자에서 의사결정 포인트 찾기", "당신은 숫자에서 의사결정 포인트", "왜 먹히나"],
  ["2-08", "경쟁사 비교 리서치", "당신은 사업 전략 리서치 애널리스트", "복사해 쓰는 프롬프트 B"],
  ["2-08", "시장조사 보고서 작성", "당신은 시장조사 보고서를 쓰는 리서치 전문가", "왜 먹히나"],
  ["2-08", "계약서 위험 조항 점검", "당신은 중소사업자를 돕는 계약 검토 도우미", "복사해 쓰는 프롬프트 B"],
  ["2-08", "외주 견적 검토", "당신은 발주처 입장에서 외주 견적을 검토", "왜 먹히나"],
  ["2-08", "랜딩페이지 카피 초안", "당신은 전환율 높은 랜딩페이지", "복사해 쓰는 프롬프트 B"],
  ["2-08", "중소기업 웹사이트 기획", "당신은 중소기업 웹사이트를 기획", "왜 먹히나"],
  ["2-08", "고객 경험 개선", "당신은 고객 경험(CX) 전문가", "복사해 쓰는 프롬프트 B"],
  ["2-08", "고객 응대 효율화", "당신은 고객 응대를 효율화하는 운영 컨설턴트", "왜 먹히나"],
  ["2-08", "반복 업무 표준화", "당신은 업무를 표준화해 반복 가능", "복사해 쓰는 프롬프트 B"],
  ["2-08", "브랜드 보이스 정리", "당신은 브랜드 보이스를 정리", "왜 먹히나"],

  ["2-09", "내부 도구 1단계 화면 만들기", "너는 비개발자용 웹 도구를 만드는 프론트엔드 개발자다.", "나오는 것"],
  ["2-09", "내부 도구 2단계 계산 기능", "좋아. 이제 \"계산하기\"를 누르면 금액이 나오게 해줘.", "나오는 것"],
  ["2-09", "내부 도구 3단계 마무리", "잘 된다. 이제 마무리로 다음을 보완해줘.", "나오는 것"],
  ["2-09", "견적 계산기", "옵션과 수량을 고르면 금액이 자동 계산되는", "02      예약 관리 페이지"],
  ["2-09", "예약 관리 페이지", "날짜와 시간대를 고르면 예약이 등록되고", "03   재고 알림 도구"],
  ["2-09", "재고 알림 도구", "품목과 현재 수량을 입력하면", "04   문의 분류 도구"],
  ["2-09", "문의 분류 도구", "고객 문의 글을 붙여넣으면", "05   정산 점검표"],
  ["2-09", "정산 점검표", "주문 목록과 입금 목록을 각각", "06   고객 명단 정리"],
  ["2-09", "고객 명단 정리", "이름·연락처·메모를 입력하면", "07   매출 대시보드"],
  ["2-09", "매출 대시보드", "날짜와 매출액을 입력하면", "08   출퇴근 기록판"],
  ["2-09", "출퇴근 기록판", "직원이 이름을 고르고 출근·퇴근", "09   발주서 생성기"],
  ["2-09", "발주서 생성기", "거래처와 품목·수량을 고르면", "10   설문 수집 폼"],
  ["2-09", "설문 수집 폼", "질문 [___]개로 된 설문 폼", "11   배송 현황판"],
  ["2-09", "배송 현황판", "주문번호와 고객명을 입력하면", "12   쿠폰 발급 관리"],
  ["2-09", "쿠폰 발급 관리", "쿠폰 코드를 자동 생성해", "13   업무 체크리스트"],
  ["2-09", "업무 체크리스트", "매일 반복하는 오픈·마감 체크리스트", "14   리뷰 모아보기"],
  ["2-09", "리뷰 모아보기", "여러 채널의 고객 후기를 붙여넣으면", "15   비용 정리 도구"],
  ["2-09", "비용 정리 도구", "날짜·항목·금액·분류를 입력하면", "16   일정 공유판"],
  ["2-09", "일정 공유판", "담당자·일정·마감일을 입력하면", "5부 · 안전하게"],

  ["2-10", "월별 매출 집계", "너는 소상공인의 매출 데이터를 다루는 데이터 분석가야.", "예상 결과"],
  ["2-10", "고객 세그먼트 분석", "너는 고객 데이터를 분석하는 CRM 담당자야.", "예상 결과"],
  ["2-10", "고객 명단 중복 제거", "너는 데이터를 깔끔하게 정리하는 일을 맡은 사람이야.", "예상 결과"],
  ["2-10", "표 데이터 정제", "너는 지저분한 표를 표준 형식으로 다듬는 데이터 정제 담당자야.", "예상 결과"],
  ["2-10", "월별 매출 차트 생성", "너는 보고용 자료를 만드는 데이터 시각화 담당자야.", "예상 결과"],
  ["2-10", "매출 피벗 요약", "너는 엑셀 피벗테이블을 대신 만들어주는 분석가야.", "예상 결과"],
  ["2-10", "주문 데이터 이상값 점검", "너는 데이터 오류를 잡아내는 검수 담당자야.", "예상 결과"],

  ["2-16", "유튜브 제작 전체 흐름 안내", "나는 맥북(또는 PC)에 클로드 코드만 깔려 있는 비개발자야.", "이 작업에 필요한 공개 도구"],
  ["2-16", "유튜브 제작 도구 설치 점검", "이 작업에 필요한 공개 도구(전사 도구, ffmpeg", "앞으로 이 영상 프로젝트"],
  ["2-16", "영상 프로젝트 승인 원칙", "앞으로 이 영상 프로젝트는 네가 손으로 실행하고", "작업 폴더 구조를 간단하게"],
  ["2-16", "영상 프로젝트 폴더 구성", "작업 폴더 구조를 간단하게 잡아줘.", "진행 단계"],
  ["2-16", "클로드 코드 설치 오류 해결", "설치하다 에러 메시지가 떴을 때", "명령어가 먹히지 않을 때"],
  ["2-16", "클로드 명령어 미인식 해결", "명령어가 먹히지 않을 때", "설치 자체를 클로드한테"],
  ["2-16", "클로드 코드 초보 설치 안내", "설치 자체를 클로드한테 안내받고 싶을 때", "진행 단계"],
  ["2-16", "경쟁 채널 데이터 수집", "클로드 코드에게 데이터 수집을 시킬 때", "주제 빈칸을 찾을 때"],
  ["2-16", "경쟁 채널 주제 빈칸 찾기", "주제 빈칸을 찾을 때", "주제를 좁힐 때"],
  ["2-16", "유튜브 주제 후보 좁히기", "주제를 좁힐 때", "대본 초안을 받을 때"],
  ["2-16", "유튜브 대본 초안", "대본 초안을 받을 때", "진행 단계"],
  ["2-16", "녹음 전 환경 점검", "녹음 직전 준비를 시킬 때", "녹음 끝나고 파일을"],
  ["2-16", "녹음 파일 상태 확인", "녹음 끝나고 파일을 정리시킬 때", "여러 번 끊어 녹음했을 때"],
  ["2-16", "분할 녹음 이어붙이기", "여러 번 끊어 녹음했을 때 이어붙이기", "녹음 톤/속도가"],
  ["2-16", "녹음 문제 구간 표시", "녹음 톤/속도가 괜찮은지", "진행 단계"],
  ["2-16", "녹음 전사 만들기", "[전사 만들기]", "[발화ID 부여]"],
  ["2-16", "전사 발화 ID 부여", "[발화ID 부여]", "[버릴 목록 생성]"],
  ["2-16", "드라이컷 버릴 목록 생성", "[버릴 목록 생성]", "[눈 게이트 → 컷 실행]"],
  ["2-16", "승인된 발화 컷 실행", "[눈 게이트 → 컷 실행]", "[귀 게이트]"],
  ["2-16", "편집 오디오 귀 검수", "[귀 게이트]", "진행 단계"],
  ["2-16", "드라이컷 눈 게이트 후보 생성", "[눈 게이트 1단계", "[눈 게이트 2단계"],
  ["2-16", "드라이컷 눈 게이트 HTML", "[눈 게이트 2단계", "[실제 컷 + 음량 정리]"],
  ["2-16", "드라이컷과 음량 정리", "[실제 컷 + 음량 정리]", "[귀 게이트, 처음부터"],
  ["2-16", "오디오 전 구간 귀 검수", "[귀 게이트, 처음부터", "[표시한 부분 재처리]"],
  ["2-16", "검수 표시 구간 재처리", "[표시한 부분 재처리]", "진행 단계"],
  ["2-16", "Remotion 씬 설계", "이 컷본 오디오(audio/ 폴더 안)", "방금 짠 설계대로"],
  ["2-16", "Remotion 화면 코드 생성", "방금 짠 설계대로 Remotion 화면 코드를", "이제 자막을 영상 타이밍에"],
  ["2-16", "자막과 영상 타이밍 연결", "이제 자막을 영상 타이밍에 맞춰줘.", "반복해서 쓸 화면들"],
  ["2-16", "영상 화면 재사용 부품화", "반복해서 쓸 화면들", "진행 단계"],
  ["2-16", "하락 그래프 커스텀 모션", "[모션 1 · 숫자가 떨어지는 그래프]", "[모션 2"],
  ["2-16", "항목 누적 리스트 모션", "[모션 2 · 항목이 하나씩 쌓이는 리스트]", "[모션 3"],
  ["2-16", "사람에서 AI로 이동하는 모션", "[모션 3 · A에서 B로 흐름이 이동]", "[모션 4"],
  ["2-16", "숫자 카운터 강조 모션", "[모션 4 · 숫자 카운터가 올라가는 강조]", "[모션 5"],
  ["2-16", "핵심 문장 타이핑 모션", "[모션 5 · 한 줄 핵심 문장이 타이핑되며 강조]", "[재사용 모듈로 저장]"],
  ["2-16", "커스텀 모션 재사용 모듈", "[재사용 모듈로 저장]", "진행 단계"],
  ["2-16", "특정 프레임 스틸 추출", "전체 영상 말고 특정 순간만 이미지로", "장면 경계마다"],
  ["2-16", "씬 경계 스틸 일괄 추출", "장면 경계마다 한 장씩", "클로드한테 1차로"],
  ["2-16", "스틸 이미지 1차 검사", "클로드한테 1차로 눈 검사를", "수정은 딱 한 장면만"],
  ["2-16", "단일 씬 수정", "수정은 딱 한 장면만", "고친 그 장면만"],
  ["2-16", "수정 씬 재검증", "고친 그 장면만 다시", "오타·텍스트만"],
  ["2-16", "단일 오타 수정", "오타·텍스트만 콕 집어", "박스로 샌 씬"],
  ["2-16", "밋밋한 씬 모션 재설계", "박스로 샌 씬 살리기", "진행 단계"],
  ["2-16", "유튜브 최종 렌더", "[최종 렌더, 사람이 명시 요청할 때만]", "[썸네일 생성]"],
  ["2-16", "유튜브 썸네일 생성", "[썸네일 생성]", "[한글 깨짐 게이트]"],
  ["2-16", "썸네일 한글 깨짐 게이트", "[한글 깨짐 게이트]", "[메타 생성]"],
  ["2-16", "유튜브 메타 생성", "[메타 생성]", "[업로드, 비공개 고정]"],
  ["2-16", "유튜브 비공개 업로드", "[업로드, 비공개 고정]", "[예약 발행이 필요하면]"],
  ["2-16", "유튜브 예약 발행", "[예약 발행이 필요하면]", "진행 단계"],
  ["2-16", "그래픽 우선 씬 설계", "원고를 의미 덩어리(정의/비교/나열/숫자/논리)", "방금 정한 화면 설계대로"],
  ["2-16", "정적 Remotion 씬 제작", "방금 정한 화면 설계대로, Remotion", "각 씬을 PNG"],
  ["2-16", "정적 씬 PNG 검수", "각 씬을 PNG 이미지로", "(녹음 mp3를 주며)"],
  ["2-16", "즉흥 녹음 전사와 자막 정제", "(녹음 mp3를 주며)", "이제 화면 경계"],
  ["2-16", "화면 경계와 녹음 정합", "이제 화면 경계(씬이 바뀌는 지점)", "타이밍이 다 맞은 걸"],
  ["2-16", "씬 애니메이션 활성화", "타이밍이 다 맞은 걸 확인했으니", "이 등장 모션"],
  ["2-16", "등장 모션 재사용 모듈화", "이 등장 모션(예: 카드가 순서대로", "진행 단계"],
];

const prompts = promptSpecs.map(([number, name, start, end, occurrence = 0], index) => ({
  number,
  title: `${number}. ${name}`,
  category: `AI 실무 · ${number}`,
  summary: `${name} 작업에 사용하는 문서 원문의 복사형 지시문입니다.`,
  when: "해당 업무를 AI에 맡길 때 원문의 빈칸과 예시를 내 상황으로 바꿔 사용하세요.",
  body: linesBetween(number, start, end, occurrence),
  createdAt: new Date(baseTime - index * 1000).toISOString(),
}));
const pages = documents.map((document) => ({ ...document, content: pageContent(document) }));
if (pages.length !== 16 || prompts.length !== 125 || new Set(prompts.map((prompt) => prompt.title)).size !== prompts.length) {
  throw new Error("Page 또는 Prompt 개수와 중복 검증에 실패했습니다.");
}
const pageStats = pages.map((page) => ({ number: page.number, chars: extracted.get(page.number).replace(/\s/g, "").length }));
const invalidPages = pageStats.filter(({ chars }) => chars < 1_000);
const invalidPrompts = prompts.filter(({ body }) => body.length < 30).map(({ title, body }) => ({ title, chars: body.length }));
if (invalidPages.length || invalidPrompts.length) throw new Error(`PDF 전문 또는 Prompt 본문이 불완전합니다. ${JSON.stringify({ invalidPages, invalidPrompts })}`);
if (process.argv.includes("--check")) {
  console.log({ pages: pages.length, prompts: prompts.length, pageStats, promptsBySource: Object.fromEntries(documents.map(({ number }) => [number, prompts.filter((prompt) => prompt.number === number).length])) });
  process.exit(0);
}

function sections(prompt, pageId) {
  return JSON.stringify([
    { title: "프롬프트", body: prompt.body },
    { title: "관련 Page", body: `/pages/${pageId}` },
    { title: "원본 PDF", body: basename(documents.find((document) => document.number === prompt.number).path).normalize("NFC") },
  ]);
}

const db = new Database(resolve(root, "data/mymark.db"));
const findLocalPage = db.prepare("SELECT id, content FROM custom_pages WHERE user_id = ? AND title = ?");
const insertLocalPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
const updateLocalPage = db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?");
const findLocalPrompt = db.prepare("SELECT id, summary, when_to_use, sections FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
const insertLocalPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
const updateLocalPrompt = db.prepare("UPDATE prompts SET summary = ?, when_to_use = ?, sections = ?, updated_at = ? WHERE id = ? AND user_id = ?");
const localPageIds = new Map();
let localPages = 0;
let localPageUpdates = 0;
let localPrompts = 0;
let localPromptUpdates = 0;
db.transaction(() => {
  for (const page of pages) {
    const existing = findLocalPage.get(LOCAL_USER, page.title);
    const id = existing?.id ?? randomUUID();
    localPageIds.set(page.number, id);
    if (!existing) {
      insertLocalPage.run(id, LOCAL_USER, page.title, page.content, page.createdAt, page.createdAt);
      localPages += 1;
    } else if (existing.content !== page.content) {
      updateLocalPage.run(page.content, new Date().toISOString(), id, LOCAL_USER);
      localPageUpdates += 1;
    }
  }
  for (const prompt of prompts) {
    const promptSections = sections(prompt, localPageIds.get(prompt.number));
    const existing = findLocalPrompt.get(LOCAL_USER, prompt.title, prompt.category);
    if (!existing) {
      insertLocalPrompt.run(randomUUID(), LOCAL_USER, prompt.title, prompt.category, prompt.summary, prompt.when, promptSections, prompt.createdAt, prompt.createdAt);
      localPrompts += 1;
    } else if (existing.summary !== prompt.summary || existing.when_to_use !== prompt.when || existing.sections !== promptSections) {
      updateLocalPrompt.run(prompt.summary, prompt.when, promptSections, new Date().toISOString(), existing.id, LOCAL_USER);
      localPromptUpdates += 1;
    }
  }
})();
db.close();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase 운영 환경변수가 없습니다.");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: existingProdPages, error: prodPageLookupError } = await supabase.from("custom_pages").select("id, title, content").eq("user_id", PROD_USER).in("title", pages.map((page) => page.title));
if (prodPageLookupError) throw prodPageLookupError;
const prodPageMap = new Map((existingProdPages ?? []).map((page) => [page.title, page]));
const prodPageIds = new Map();
const newProdPages = [];
const changedProdPages = [];
for (const page of pages) {
  const existing = prodPageMap.get(page.title);
  const id = existing?.id ?? randomUUID();
  prodPageIds.set(page.number, id);
  if (!existing) newProdPages.push({ id, user_id: PROD_USER, title: page.title, content: page.content, created_at: page.createdAt, updated_at: page.createdAt });
  else if (existing.content !== page.content) changedProdPages.push({ id, content: page.content });
}
if (newProdPages.length) {
  const { error } = await supabase.from("custom_pages").insert(newProdPages);
  if (error) throw error;
}
for (const page of changedProdPages) {
  const { error } = await supabase.from("custom_pages").update({ content: page.content, updated_at: new Date().toISOString() }).eq("id", page.id).eq("user_id", PROD_USER);
  if (error) throw error;
}

const { data: existingProdPrompts, error: prodPromptLookupError } = await supabase.from("prompts").select("id, title, category, summary, when_to_use, sections").eq("user_id", PROD_USER).in("title", prompts.map((prompt) => prompt.title));
if (prodPromptLookupError) throw prodPromptLookupError;
const prodPromptMap = new Map((existingProdPrompts ?? []).map((prompt) => [`${prompt.category}\n${prompt.title}`, prompt]));
const newProdPrompts = [];
const changedProdPrompts = [];
for (const prompt of prompts) {
  const promptSections = sections(prompt, prodPageIds.get(prompt.number));
  const existing = prodPromptMap.get(`${prompt.category}\n${prompt.title}`);
  const row = { summary: prompt.summary, when_to_use: prompt.when, sections: promptSections };
  if (!existing) newProdPrompts.push({ id: randomUUID(), user_id: PROD_USER, title: prompt.title, category: prompt.category, ...row, is_favorite: 0, created_at: prompt.createdAt, updated_at: prompt.createdAt });
  else if (existing.summary !== row.summary || existing.when_to_use !== row.when_to_use || existing.sections !== row.sections) changedProdPrompts.push({ id: existing.id, ...row });
}
if (newProdPrompts.length) {
  const { error } = await supabase.from("prompts").insert(newProdPrompts);
  if (error) throw error;
}
for (const prompt of changedProdPrompts) {
  const { id, ...row } = prompt;
  const { error } = await supabase.from("prompts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", PROD_USER);
  if (error) throw error;
}

console.log({ parsedPages: pages.length, parsedPrompts: prompts.length, localPages, localPageUpdates, localPrompts, localPromptUpdates, prodPages: newProdPages.length, prodPageUpdates: changedProdPages.length, prodPrompts: newProdPrompts.length, prodPromptUpdates: changedProdPrompts.length });
