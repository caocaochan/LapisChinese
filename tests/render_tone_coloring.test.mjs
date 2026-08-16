import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {chromium} from "playwright";


const css = readFileSync(new URL("../src/styling.css", import.meta.url), "utf8");
const backTemplate = readFileSync(new URL("../src/back.html", import.meta.url), "utf8");
const startMarker = "// <tone-coloring>";
const endMarker = "// </tone-coloring>";
const toneSource = backTemplate.slice(
    backTemplate.indexOf(startMarker) + startMarker.length,
    backTemplate.indexOf(endMarker),
);


async function renderCard(page, nightMode) {
    const mode = nightMode ? "card nightMode" : "card";
    await page.setContent(`
        <style>${css}</style>
            <div class="${mode}">
            <div id="lapis" lang="zh-Hans">
                <div class="vocab"><em>华</em>发！</div>
                <div class="reading">huáfà</div>
                <div class="sentence">鬓角出现了几分<b>华发</b>，这是<b class="unrelated">重点</b>。</div>
                <div class="sentence-alt">四周则全是<b>华发</b>。</div>
            </div>
        </div>
    `);
    const applied = await page.evaluate(source => eval(`${source}\napplyToneColors();`), toneSource);
    return page.evaluate(appliedResult => ({
        applied: appliedResult,
        colors: Array.from(document.querySelectorAll(".vocab [class^='tone-']"))
            .map(element => getComputedStyle(element).color),
        classes: Array.from(document.querySelectorAll(".vocab [class^='tone-']"))
            .map(element => element.className),
        readingToneSpans: document.querySelectorAll(".reading [class^='tone-']").length,
        sentenceToneSpans: document.querySelectorAll(".sentence [class^='tone-']").length,
        sentenceColors: Array.from(document.querySelectorAll(".sentence b:not(.unrelated) [class^='tone-']"))
            .map(element => getComputedStyle(element).color),
        alternateSentenceToneSpans: document.querySelectorAll(".sentence-alt [class^='tone-']").length,
        alternateSentenceColors: Array.from(document.querySelectorAll(".sentence-alt [class^='tone-']"))
            .map(element => getComputedStyle(element).color),
        unrelatedBoldToneSpans: document.querySelectorAll(".sentence b.unrelated [class^='tone-']").length,
        emphasizedText: document.querySelector(".vocab em")?.textContent,
        punctuationPreserved: document.querySelector(".vocab")?.textContent.endsWith("！"),
    }), applied);
}


async function renderPersistentCard(page, expression, reading) {
    await page.evaluate(({expression, reading, source}) => {
        const qa = document.getElementById("qa");
        const lapis = document.createElement("div");
        lapis.id = "lapis";
        lapis.lang = "zh-Hans";

        const vocab = document.createElement("div");
        vocab.className = "vocab";
        vocab.textContent = expression;

        const readingElement = document.createElement("div");
        readingElement.className = "reading";
        readingElement.textContent = reading;

        const sentence = document.createElement("div");
        sentence.className = "sentence";
        sentence.append("Example ");
        const target = document.createElement("b");
        target.textContent = expression;
        sentence.appendChild(target);

        lapis.append(vocab, readingElement, sentence);
        qa.replaceChildren(lapis);

        // Anki's reviewer replaces script elements after updating #qa, which
        // evaluates the same card-template source in the persistent page again.
        const script = document.createElement("script");
        script.textContent = `${source}\napplyToneColors();`;
        qa.appendChild(script);
    }, {expression, reading, source: toneSource});

    return page.evaluate(() => ({
        vocabText: document.querySelector(".vocab")?.textContent,
        vocabClasses: Array.from(document.querySelectorAll(".vocab [class^='tone-']"))
            .map(element => element.className),
        vocabColors: Array.from(document.querySelectorAll(".vocab [class^='tone-']"))
            .map(element => getComputedStyle(element).color),
        sentenceClasses: Array.from(document.querySelectorAll(".sentence b [class^='tone-']"))
            .map(element => element.className),
    }));
}


async function launchBrowser() {
    let lastError;
    for (const options of [
        {headless: true},
        {channel: "chrome", headless: true},
        {channel: "msedge", headless: true},
    ]) {
        try {
            return await chromium.launch(options);
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}


test("renders compact-diacritic header and matching sentence tones in light and night modes", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const light = await renderCard(page, false);
        assert.equal(light.applied, true);
        assert.deepEqual(light.classes, ["tone-2", "tone-4"]);
        assert.deepEqual(light.colors, ["rgb(2, 179, 28)", "rgb(137, 0, 191)"]);
        assert.equal(light.readingToneSpans, 0);
        assert.equal(light.sentenceToneSpans, 2);
        assert.deepEqual(light.sentenceColors, ["rgb(2, 179, 28)", "rgb(137, 0, 191)"]);
        assert.equal(light.alternateSentenceToneSpans, 2);
        assert.deepEqual(light.alternateSentenceColors, ["rgb(2, 179, 28)", "rgb(137, 0, 191)"]);
        assert.equal(light.unrelatedBoldToneSpans, 0);
        assert.equal(light.emphasizedText, "华");
        assert.equal(light.punctuationPreserved, true);

        const dark = await renderCard(page, true);
        assert.equal(dark.applied, true);
        assert.deepEqual(dark.classes, ["tone-2", "tone-4"]);
        assert.deepEqual(dark.colors, ["rgb(74, 222, 128)", "rgb(192, 132, 252)"]);
        assert.equal(dark.readingToneSpans, 0);
        assert.equal(dark.sentenceToneSpans, 2);
        assert.deepEqual(dark.sentenceColors, ["rgb(74, 222, 128)", "rgb(192, 132, 252)"]);
        assert.equal(dark.alternateSentenceToneSpans, 2);
        assert.deepEqual(dark.alternateSentenceColors, ["rgb(74, 222, 128)", "rgb(192, 132, 252)"]);
        assert.equal(dark.unrelatedBoldToneSpans, 0);
    } finally {
        await browser.close();
    }
});


test("renders compact Pinyin resolved by the apostrophe boundary rule", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        await page.setContent(`
            <style>${css}</style>
            <div class="card nightMode"><div id="qa"></div></div>
        `);

        const card = await renderPersistentCard(page, "盘根错节", "pángēncuòjié");
        assert.deepEqual(card.vocabClasses, ["tone-2", "tone-1", "tone-4", "tone-2"]);
        assert.deepEqual(card.sentenceClasses, ["tone-2", "tone-1", "tone-4", "tone-2"]);
    } finally {
        await browser.close();
    }
});


test("recolors cards after forward and backward navigation in a persistent preview page", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.setContent(`
            <style>${css}</style>
            <div class="card nightMode"><div id="qa"></div></div>
        `);

        const first = await renderPersistentCard(page, "华发", "huáfà");
        assert.deepEqual(first.vocabClasses, ["tone-2", "tone-4"]);
        assert.deepEqual(first.vocabColors, ["rgb(74, 222, 128)", "rgb(192, 132, 252)"]);
        assert.deepEqual(first.sentenceClasses, ["tone-2", "tone-4"]);

        const next = await renderPersistentCard(page, "牢牢", "láoláo");
        assert.deepEqual(next.vocabClasses, ["tone-2", "tone-2"]);
        assert.deepEqual(next.vocabColors, ["rgb(74, 222, 128)", "rgb(74, 222, 128)"]);
        assert.deepEqual(next.sentenceClasses, ["tone-2", "tone-2"]);

        const supplementary = await renderPersistentCard(page, "𠮷野家", "jí yě jiā");
        assert.equal(supplementary.vocabText, "𠮷野家");
        assert.deepEqual(supplementary.vocabClasses, ["tone-2", "tone-3", "tone-1"]);
        assert.deepEqual(supplementary.sentenceClasses, ["tone-2", "tone-3", "tone-1"]);

        const previous = await renderPersistentCard(page, "华发", "huáfà");
        assert.deepEqual(previous.vocabClasses, ["tone-2", "tone-4"]);
        assert.deepEqual(previous.vocabColors, ["rgb(74, 222, 128)", "rgb(192, 132, 252)"]);
        assert.deepEqual(previous.sentenceClasses, ["tone-2", "tone-4"]);
        assert.deepEqual(pageErrors, []);
    } finally {
        await browser.close();
    }
});
