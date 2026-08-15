import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {chromium} from "playwright";


const frontTemplate = readFileSync(new URL("../src/front.html", import.meta.url), "utf8");
const backTemplate = readFileSync(new URL("../src/back.html", import.meta.url), "utf8");

function inlineScript(template) {
    const start = template.indexOf("<script>");
    const end = template.indexOf("</script>", start);
    assert.notEqual(start, -1, "inline script start is missing");
    assert.notEqual(end, -1, "inline script end is missing");
    return template.slice(start + "<script>".length, end);
}

const frontSource = inlineScript(frontTemplate);
const backSource = inlineScript(backTemplate);


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


async function renderClickCard(page, expression, sentenceHtml) {
    await page.evaluate(({expression, sentenceHtml, source}) => {
        const qa = document.getElementById("qa");
        const lapis = document.createElement("div");
        lapis.id = "lapis";

        const click = document.createElement("div");
        click.id = "click";
        const expressionElement = document.createElement("div");
        expressionElement.className = "front-vocab";
        expressionElement.textContent = expression;
        click.appendChild(expressionElement);

        const sentenceTemplate = document.createElement("template");
        sentenceTemplate.id = "click-sentence-template";
        const sentenceElement = document.createElement("div");
        sentenceElement.className = "front-sentence";
        sentenceElement.innerHTML = sentenceHtml;
        sentenceTemplate.content.appendChild(sentenceElement);

        lapis.append(click, sentenceTemplate);
        (globalThis.__frontRoots ||= []).push(lapis);
        qa.replaceChildren(lapis);

        const script = document.createElement("script");
        script.textContent = source;
        qa.appendChild(script);
    }, {expression, sentenceHtml, source: frontSource});
}


async function renderPlainFront(page, expression) {
    await page.evaluate(({expression, source}) => {
        const qa = document.getElementById("qa");
        const lapis = document.createElement("div");
        lapis.id = "lapis";
        const value = document.createElement("div");
        value.className = "front-vocab";
        value.textContent = expression;
        lapis.appendChild(value);
        qa.replaceChildren(lapis);

        const script = document.createElement("script");
        script.textContent = source;
        qa.appendChild(script);
    }, {expression, source: frontSource});
}


async function renderMinimalBack(page, audioText, tagText) {
    await page.evaluate(({audioText, tagText, source}) => {
        const qa = document.getElementById("qa");
        const lapis = document.createElement("div");
        lapis.id = "lapis";

        for (let index = 0; index < 3; index += 1) {
            const audio = document.createElement("div");
            audio.className = index === 0 ? "audio-buttons" : "audio-buttons-alt";
            lapis.appendChild(audio);
        }

        const tagsContainer = document.createElement("div");
        tagsContainer.className = "tags-container";
        const tagsSource = document.createElement("div");
        tagsSource.className = "tags";
        tagsSource.textContent = tagText;
        tagsContainer.appendChild(tagsSource);
        lapis.appendChild(tagsContainer);

        const defInfo = document.createElement("div");
        defInfo.className = "def-info";
        const mainDefinition = document.createElement("div");
        mainDefinition.className = "main-def";
        const definition = document.createElement("div");
        definition.className = "definition";
        mainDefinition.appendChild(definition);
        const modal = document.createElement("div");
        modal.className = "modal-bg";
        const popup = document.createElement("div");
        popup.className = "img-popup";
        modal.appendChild(popup);
        lapis.append(defInfo, mainDefinition, modal);

        const audioSource = document.createElement("div");
        audioSource.id = "audio-button-source";
        audioSource.hidden = true;
        const button = document.createElement("button");
        button.textContent = audioText;
        audioSource.appendChild(button);
        qa.replaceChildren(lapis, audioSource);

        const state = globalThis.__lapisChineseState;
        state.openCC = {Converter: () => value => value};

        const script = document.createElement("script");
        script.textContent = source;
        qa.appendChild(script);
    }, {audioText, tagText, source: backSource});
}


test("keeps Click-card content literal and replaces the persistent key listener", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.setContent('<div id="qa"></div>');

        const adversarialSentence = '甲`乙 ${literal} "quote" <em>保留</em>';
        await renderClickCard(page, "第一", adversarialSentence);
        await page.click("#click");
        assert.equal(
            await page.locator("#click").innerText(),
            '甲`乙 ${literal} "quote" 保留',
        );
        assert.equal(await page.locator("#click em").innerText(), "保留");
        await page.click("#click");
        assert.equal(await page.locator("#click").innerText(), "第一");
        await page.keyboard.press("c");

        await renderClickCard(page, "第二", "当前句子");
        await page.keyboard.press("Shift+C");
        assert.equal(await page.locator("#click").innerText(), "当前句子");
        assert.equal(
            await page.evaluate(() => globalThis.__frontRoots[0].querySelector("#click").innerText),
            '甲`乙 ${literal} "quote" 保留',
        );

        await page.keyboard.press("Control+C");
        assert.equal(await page.locator("#click").innerText(), "当前句子");

        await renderPlainFront(page, "普通卡片");
        await page.keyboard.press("c");
        assert.equal(await page.locator(".front-vocab").innerText(), "普通卡片");
        assert.equal(
            await page.evaluate(() => globalThis.__lapisChineseState.clickKeyHandler),
            null,
        );

        await renderClickCard(page, "第三", "背面前的句子");
        await page.keyboard.press("c");
        const detachedRootIndex = await page.evaluate(() => globalThis.__frontRoots.length - 1);
        await renderMinimalBack(
            page,
            'sound` ${literal} "quote"',
            'tag`one tag${literal} tag"three',
        );
        await page.keyboard.press("c");
        const backResult = await page.evaluate(index => ({
            detachedText: globalThis.__frontRoots[index].querySelector("#click").innerText,
            keyHandler: globalThis.__lapisChineseState.clickKeyHandler,
            audio: Array.from(document.querySelectorAll(".audio-buttons button, .audio-buttons-alt button"))
                .map(element => element.textContent),
            tags: Array.from(document.querySelectorAll(".tags-container > .tags"))
                .map(element => element.textContent),
        }), detachedRootIndex);
        assert.equal(backResult.detachedText, "背面前的句子");
        assert.equal(backResult.keyHandler, null);
        assert.deepEqual(backResult.audio, [
            'sound` ${literal} "quote"',
            'sound` ${literal} "quote"',
            'sound` ${literal} "quote"',
        ]);
        assert.deepEqual(backResult.tags, ["tag`one", "tag${literal}", 'tag"three']);
        assert.deepEqual(pageErrors, []);
    } finally {
        await browser.close();
    }
});
