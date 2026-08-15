import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {readFileSync} from "node:fs";
import test from "node:test";
import {chromium} from "playwright";


const css = readFileSync(new URL("../src/styling.css", import.meta.url), "utf8");
const backTemplate = readFileSync(new URL("../src/back.html", import.meta.url), "utf8");
const openCCPath = fileURLToPath(
    new URL("../vendor/opencc-js-1.4.1/_lapis_opencc.js", import.meta.url),
);
const openCCSource = readFileSync(openCCPath, "utf8");
const instrumentedOpenCCSource = `
globalThis.__openCCBundleEvaluations = (globalThis.__openCCBundleEvaluations || 0) + 1;
${openCCSource}
{
    const originalConverter = globalThis.OpenCC.Converter;
    globalThis.OpenCC.Converter = function (...args) {
        globalThis.__openCCConverterConstructions =
            (globalThis.__openCCConverterConstructions || 0) + 1;
        return Reflect.apply(originalConverter, this, args);
    };
}
`;

function markedSource(startMarker, endMarker) {
    const start = backTemplate.indexOf(startMarker);
    const end = backTemplate.indexOf(endMarker);
    assert.notEqual(start, -1, `${startMarker} is missing`);
    assert.notEqual(end, -1, `${endMarker} is missing`);
    return backTemplate.slice(start + startMarker.length, end);
}

const variantSource = markedSource("// <script-variants>", "// </script-variants>");
const toneSource = markedSource("// <tone-coloring>", "// </tone-coloring>");


async function setPersistentPageContent(page) {
    await page.setContent(`
        <base href="https://lapis.test/">
        <style>${css}</style>
        <div class="card"><div id="qa"></div></div>
    `);
}


async function renderPersistentVariantCard(page, expression) {
    await page.evaluate(({expression, source}) => {
        const qa = document.getElementById("qa");
        const lapis = document.createElement("div");
        lapis.id = "lapis";
        lapis.lang = "zh-Hans";

        const vocab = document.createElement("div");
        vocab.className = "vocab";
        vocab.textContent = expression;

        const variants = document.createElement("div");
        variants.className = "script-variants";
        variants.hidden = true;

        lapis.append(vocab, variants);
        qa.replaceChildren(lapis);
        (globalThis.__variantRoots ||= []).push(lapis);
        eval(`${source}\nrenderExpressionVariantsWhenReady(lapis);`);
    }, {expression, source: variantSource});
}


async function renderCard(page, {
    expression,
    reading,
    nightMode = false,
    mobile = false,
    loadOpenCC = true,
}) {
    const mode = nightMode ? "card nightMode" : "card";
    const htmlClass = mobile ? "mobile" : "";
    await page.setContent(`
        <style>${css}</style>
        <div class="${mode}">
            <div id="lapis" lang="zh-Hans">
                <div class="vocab">${expression}</div>
                <div class="script-variants" aria-label="Chinese character variants" hidden></div>
                <div class="reading">${reading}</div>
                <div class="sentence">这是<b>${expression}</b>。</div>
                <div class="sentence-alt">这是<b>${expression}</b>。</div>
            </div>
        </div>
    `);
    await page.evaluate(value => document.documentElement.className = value, htmlClass);
    if (loadOpenCC) {
        await page.addScriptTag({path: openCCPath});
    } else {
        await page.evaluate(() => globalThis.OpenCC = undefined);
    }

    const applied = await page.evaluate(
        source => eval(`${source.variants}\n${source.tones}\n({
            variantApplied: renderExpressionVariants(
                document.getElementById("lapis"),
                source.loadOpenCC ? globalThis.OpenCC : {},
            ),
            toneApplied: applyToneColors(),
        });`),
        {variants: variantSource, tones: toneSource, loadOpenCC},
    );
    return page.evaluate(appliedResult => {
        const container = document.querySelector(".script-variants");
        const firstVariant = document.querySelector(".script-variant");
        const firstLabel = document.querySelector(".script-variant-label");
        const firstVariantText = document.querySelector(".script-variant-text");
        const vocab = document.querySelector(".vocab");
        const labelBox = firstLabel?.getBoundingClientRect();
        const variantTextBox = firstVariantText?.getBoundingClientRect();
        const labelFontSize = firstLabel
            ? Number.parseFloat(getComputedStyle(firstLabel).fontSize)
            : null;
        return {
            ...appliedResult,
            lapisLanguage: document.getElementById("lapis")?.lang,
            primaryLanguage: vocab?.lang,
            primaryFont: getComputedStyle(vocab).fontFamily,
            containerHidden: container?.hidden,
            labels: Array.from(document.querySelectorAll(".script-variant-label"))
                .map(element => element.textContent),
            variants: Array.from(document.querySelectorAll(".script-variant-text"))
                .map(element => element.textContent),
            variantLanguages: Array.from(document.querySelectorAll(".script-variant"))
                .map(element => element.lang),
            variantFont: firstVariant ? getComputedStyle(firstVariant).fontFamily : null,
            variantSize: container ? getComputedStyle(container).fontSize : null,
            variantColor: container ? getComputedStyle(container).color : null,
            variantOpticalOffsetRatio: labelBox && variantTextBox && labelFontSize
                ? (
                    (labelBox.top + labelBox.height / 2) -
                    (variantTextBox.top + variantTextBox.height / 2)
                ) / labelFontSize
                : null,
            primaryToneSpans: document.querySelectorAll(".vocab [class^='tone-']").length,
            variantToneSpans: document.querySelectorAll(".script-variants [class^='tone-']").length,
        };
    }, applied);
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


test("renders labeled variants, language-aware fonts, and graceful fallback", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();

        const simplified = await renderCard(page, {
            expression: "中国",
            reading: "zhōng guó",
        });
        assert.equal(simplified.variantApplied, true);
        assert.equal(simplified.toneApplied, true);
        assert.equal(simplified.lapisLanguage, "zh-Hans");
        assert.equal(simplified.primaryLanguage, "zh-Hans");
        assert.equal(simplified.containerHidden, false);
        assert.deepEqual(simplified.labels, ["繁"]);
        assert.deepEqual(simplified.variants, ["中國"]);
        assert.deepEqual(simplified.variantLanguages, ["zh-Hant"]);
        assert.match(simplified.variantFont, /Noto Serif CJK TC/);
        assert.equal(simplified.variantSize, "26px");
        assert.equal(simplified.variantColor, "rgba(0, 0, 0, 0.6)");
        assert.ok(Math.abs(simplified.variantOpticalOffsetRatio - 0.1) < 0.02);
        assert.equal(simplified.primaryToneSpans, 2);
        assert.equal(simplified.variantToneSpans, 0);

        const traditional = await renderCard(page, {
            expression: "中國",
            reading: "zhōng guó",
            nightMode: true,
            mobile: true,
        });
        assert.equal(traditional.variantApplied, true);
        assert.equal(traditional.lapisLanguage, "zh-Hant");
        assert.equal(traditional.primaryLanguage, "zh-Hant");
        assert.deepEqual(traditional.labels, ["简"]);
        assert.deepEqual(traditional.variants, ["中国"]);
        assert.deepEqual(traditional.variantLanguages, ["zh-Hans"]);
        assert.match(traditional.primaryFont, /Noto Serif CJK TC/);
        assert.equal(traditional.variantSize, "18px");
        assert.equal(traditional.variantColor, "rgba(255, 255, 255, 0.3)");
        assert.ok(Math.abs(traditional.variantOpticalOffsetRatio - 0.1) < 0.02);
        assert.equal(traditional.primaryToneSpans, 2);
        assert.equal(traditional.variantToneSpans, 0);

        const unavailable = await renderCard(page, {
            expression: "中国",
            reading: "zhōng guó",
            loadOpenCC: false,
        });
        assert.equal(unavailable.variantApplied, false);
        assert.equal(unavailable.toneApplied, true);
        assert.equal(unavailable.containerHidden, true);
        assert.deepEqual(unavailable.variants, []);
        assert.equal(unavailable.primaryToneSpans, 2);
    } finally {
        await browser.close();
    }
});


test("loads OpenCC and constructs converters once across persistent card renders", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        let scriptRequests = 0;
        await page.route("https://lapis.test/_lapis_opencc.js", async route => {
            scriptRequests += 1;
            await new Promise(resolve => setTimeout(resolve, 100));
            await route.fulfill({
                body: instrumentedOpenCCSource,
                contentType: "text/javascript; charset=utf-8",
            });
        });
        await setPersistentPageContent(page);

        await renderPersistentVariantCard(page, "中国");
        await renderPersistentVariantCard(page, "软件");
        await page.waitForFunction(() => (
            document.querySelector(".script-variant-text")?.textContent === "軟件"
        ));

        await renderPersistentVariantCard(page, "中國");
        await page.waitForFunction(() => (
            document.querySelector(".script-variant-text")?.textContent === "中国"
        ));

        const result = await page.evaluate(() => ({
            bundleEvaluations: globalThis.__openCCBundleEvaluations,
            converterConstructions: globalThis.__openCCConverterConstructions,
            detachedFirstRootWasUntouched:
                globalThis.__variantRoots[0].querySelectorAll(".script-variant").length === 0,
            currentVariant: document.querySelector(".script-variant-text")?.textContent,
        }));
        assert.equal(scriptRequests, 1);
        assert.equal(result.bundleEvaluations, 1);
        assert.equal(result.converterConstructions, 2);
        assert.equal(result.detachedFirstRootWasUntouched, true);
        assert.equal(result.currentVariant, "中国");
    } finally {
        await browser.close();
    }
});


test("retries OpenCC after a load failure and leaves the failed card usable", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const warnings = [];
        page.on("console", message => {
            if (message.type() === "warning") warnings.push(message.text());
        });
        let scriptRequests = 0;
        await page.route("https://lapis.test/_lapis_opencc.js", async route => {
            scriptRequests += 1;
            if (scriptRequests === 1) {
                await route.abort("failed");
                return;
            }
            await route.fulfill({
                body: instrumentedOpenCCSource,
                contentType: "text/javascript; charset=utf-8",
            });
        });
        await setPersistentPageContent(page);

        await renderPersistentVariantCard(page, "中国");
        await page.waitForFunction(() => (
            globalThis.__lapisChineseState?.openCCPromise === null
        ));
        const failedCard = await page.evaluate(() => ({
            hidden: document.querySelector(".script-variants")?.hidden,
            variantCount: document.querySelectorAll(".script-variant").length,
        }));
        assert.equal(failedCard.hidden, true);
        assert.equal(failedCard.variantCount, 0);

        await renderPersistentVariantCard(page, "中国");
        await page.waitForFunction(() => (
            document.querySelector(".script-variant-text")?.textContent === "中國"
        ));
        assert.equal(scriptRequests, 2);
        assert.equal(await page.evaluate(() => globalThis.__openCCBundleEvaluations), 1);
        assert.equal(await page.evaluate(() => globalThis.__openCCConverterConstructions), 2);
        assert.equal(
            warnings.filter(message => message.includes("could not load character conversion data")).length,
            1,
        );
    } finally {
        await browser.close();
    }
});
