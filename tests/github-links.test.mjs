// GitHub 링크 정적 데이터의 완전성과 URL 안전성을 검증한다
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataPath = new URL("../src/data/github-links.json", import.meta.url);

test("GitHub 링크 120개가 완전한 정적 데이터로 유지된다", async () => {
  const items = JSON.parse(await readFile(dataPath, "utf8"));
  const urls = items.map((item) => item.url);

  assert.equal(items.length, 120);
  assert.equal(new Set(urls).size, 120);

  const sourceCounts = { github: 0, huggingFace: 0, other: 0 };
  for (const item of items) {
    assert.deepEqual(Object.keys(item), [
      "title",
      "description",
      "category",
      "url",
    ]);
    assert.ok(item.title.trim());
    assert.ok(item.description.trim());
    assert.doesNotMatch(item.description, /★/);
    assert.ok(item.category.trim());
    assert.ok(item.url.trim());

    const url = new URL(item.url);
    assert.equal(url.protocol, "https:");
    assert.equal(url.search, "");
    assert.equal(url.hash, "");

    if (url.hostname === "github.com") sourceCounts.github++;
    else if (url.hostname === "huggingface.co") sourceCounts.huggingFace++;
    else sourceCounts.other++;
  }

  assert.deepEqual(sourceCounts, { github: 117, huggingFace: 1, other: 2 });
});
