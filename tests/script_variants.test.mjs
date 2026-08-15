import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";


const require = createRequire(import.meta.url);
const OpenCC = require("../vendor/opencc-js-1.4.1/_lapis_opencc.js");
const backTemplate = readFileSync(new URL("../src/back.html", import.meta.url), "utf8");
const startMarker = "// <script-variants>";
const endMarker = "// </script-variants>";
const start = backTemplate.indexOf(startMarker);
const end = backTemplate.indexOf(endMarker);
assert.notEqual(start, -1, "script-variants start marker is missing");
assert.notEqual(end, -1, "script-variants end marker is missing");

const source = `${backTemplate.slice(start + startMarker.length, end)}
globalThis.__variantApi = {expressionVariantDisplay};`;
const context = vm.createContext({OpenCC, console: {warn() {}}});
new vm.Script(source, {filename: "script-variants.js"}).runInContext(context);
const {expressionVariantDisplay} = context.__variantApi;
const plain = value => value === null ? null : JSON.parse(JSON.stringify(value));


test("derives the opposite form and primary language", () => {
    assert.deepEqual(plain(expressionVariantDisplay("中国")), {
        primaryLanguage: "zh-Hans",
        variants: [{label: "繁", text: "中國", language: "zh-Hant"}],
    });
    assert.deepEqual(plain(expressionVariantDisplay("中國")), {
        primaryLanguage: "zh-Hant",
        variants: [{label: "简", text: "中国", language: "zh-Hans"}],
    });
});

test("uses phrase-aware character conversion without regional vocabulary substitution", () => {
    assert.equal(expressionVariantDisplay("头发").variants[0].text, "頭髮");
    assert.equal(expressionVariantDisplay("软件").variants[0].text, "軟件");
});

test("hides identical forms", () => {
    assert.deepEqual(plain(expressionVariantDisplay("中文")), {
        primaryLanguage: "zh-Hans",
        variants: [],
    });
});

test("normalizes mixed-script input into labeled simplified and traditional forms", () => {
    assert.deepEqual(plain(expressionVariantDisplay("中国與臺灣")), {
        primaryLanguage: "zh",
        variants: [
            {label: "简", text: "中国与台湾", language: "zh-Hans"},
            {label: "繁", text: "中國與臺灣", language: "zh-Hant"},
        ],
    });
});

test("fails closed when the converter is unavailable", () => {
    assert.equal(expressionVariantDisplay("中国", {}), null);
});
