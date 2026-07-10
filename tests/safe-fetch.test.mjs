// SSRF 가드 핵심 로직 단위 테스트 (node:test)
// 소스: src/lib/safe-fetch.ts 와 동일 규칙 — 런타임 의존 없이 검증
import assert from "node:assert/strict";
import net from "node:net";
import { describe, it } from "node:test";

function isPrivateOrReservedIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) {
    const parts = ip.split(".").map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe80")) return true;
    if (lower.startsWith("ff")) return true;
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice("::ffff:".length);
      if (net.isIPv4(mapped)) return isPrivateOrReservedIp(mapped);
    }
    return false;
  }
  return true;
}

function normalizeHttpUrl(raw) {
  let url = raw.trim();
  if (!url) throw new Error("empty");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("proto");
  }
  if (parsed.username || parsed.password) throw new Error("userinfo");
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) throw new Error("local");
  if (net.isIP(host) && isPrivateOrReservedIp(host)) throw new Error("private");
  return parsed.toString();
}

describe("isPrivateOrReservedIp", () => {
  it("blocks loopback and RFC1918", () => {
    assert.equal(isPrivateOrReservedIp("127.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("10.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("192.168.1.1"), true);
    assert.equal(isPrivateOrReservedIp("172.16.0.1"), true);
    assert.equal(isPrivateOrReservedIp("169.254.169.254"), true);
  });
  it("allows public IPs", () => {
    assert.equal(isPrivateOrReservedIp("8.8.8.8"), false);
    assert.equal(isPrivateOrReservedIp("1.1.1.1"), false);
  });
  it("blocks ::1", () => {
    assert.equal(isPrivateOrReservedIp("::1"), true);
  });
});

describe("normalizeHttpUrl", () => {
  it("adds https and accepts public host", () => {
    const u = normalizeHttpUrl("example.com/a");
    assert.equal(u.startsWith("https://example.com/"), true);
  });
  it("rejects localhost", () => {
    assert.throws(() => normalizeHttpUrl("http://localhost/admin"));
  });
  it("rejects private literal IP", () => {
    assert.throws(() => normalizeHttpUrl("http://127.0.0.1/"));
    assert.throws(() => normalizeHttpUrl("http://169.254.169.254/latest"));
  });
  it("rejects credentials in URL", () => {
    assert.throws(() => normalizeHttpUrl("https://user:pass@example.com/"));
  });
});
