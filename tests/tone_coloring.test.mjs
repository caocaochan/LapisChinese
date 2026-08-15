import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";


const backTemplate = readFileSync(new URL("../src/back.html", import.meta.url), "utf8");
const startMarker = "// <tone-coloring>";
const endMarker = "// </tone-coloring>";
const start = backTemplate.indexOf(startMarker);
const end = backTemplate.indexOf(endMarker);
assert.notEqual(start, -1, "tone-coloring start marker is missing");
assert.notEqual(end, -1, "tone-coloring end marker is missing");

const source = `${backTemplate.slice(start + startMarker.length, end)}
globalThis.__toneApi = {parsePinyinTones, toneSequenceForExpression};`;
const context = vm.createContext({});
new vm.Script(source, {filename: "tone-coloring.js"}).runInContext(context);
const {parsePinyinTones, toneSequenceForExpression} = context.__toneApi;
const plain = value => value === null ? null : Array.from(value);


test("parses diacritic Pinyin", () => {
    assert.deepEqual(plain(parsePinyinTones("zhōng guó")), [1, 2]);
    assert.deepEqual(plain(parsePinyinTones("nǚ ér")), [3, 2]);
    assert.deepEqual(plain(parsePinyinTones("xī'ān")), [1, 1]);
});

test("segments compact diacritic Pinyin from the expression length", () => {
    assert.deepEqual(plain(toneSequenceForExpression("华发", "huáfà")), [2, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("中国", "zhōngguó")), [1, 2]);
    assert.deepEqual(plain(toneSequenceForExpression("朋友", "péngyou")), [2, 5]);
});

test("parses spaced and compact numbered Pinyin", () => {
    assert.deepEqual(plain(parsePinyinTones("ni3 hao3")), [3, 3]);
    assert.deepEqual(plain(parsePinyinTones("ni3hao3")), [3, 3]);
    assert.deepEqual(plain(parsePinyinTones("zhong1guo2")), [1, 2]);
});

test("accepts common u-diaeresis spellings", () => {
    assert.deepEqual(plain(parsePinyinTones("lǜ sè")), [4, 4]);
    assert.deepEqual(plain(parsePinyinTones("lv4 se4")), [4, 4]);
    assert.deepEqual(plain(parsePinyinTones("lu:4 se4")), [4, 4]);
});

test("handles explicit and implicit neutral tones", () => {
    assert.deepEqual(plain(parsePinyinTones("peng2 you5")), [2, 5]);
    assert.deepEqual(plain(parsePinyinTones("peng2 you0")), [2, 5]);
    assert.deepEqual(plain(parsePinyinTones("mā ma")), [1, 5]);
    assert.deepEqual(plain(parsePinyinTones("peng2 you")), [2, 5]);
});

test("maps only Han characters and ignores punctuation or Latin content", () => {
    assert.deepEqual(plain(toneSequenceForExpression("你好！", "nǐ hǎo")), [3, 3]);
    assert.deepEqual(plain(toneSequenceForExpression("第1个", "di4 ge4")), [4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("𠮷野家", "jí yě jiā")), [2, 3, 1]);
});

test("fails closed for ambiguous or unsafe input", () => {
    assert.equal(parsePinyinTones("zhong guo"), null);
    assert.equal(parsePinyinTones("cháng / zhǎng"), null);
    assert.equal(parsePinyinTones("mā2"), null);
    assert.equal(toneSequenceForExpression("长安", "chángān"), null);
    assert.equal(toneSequenceForExpression("花儿", "huār"), null);
    assert.equal(toneSequenceForExpression("中国人", "zhōng guó"), null);
    assert.equal(toneSequenceForExpression("hello", "he2 llo5"), null);
});
