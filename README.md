# Lapis Chinese

Lapis Chinese is a Mandarin Chinese adaptation of the
[Lapis](https://github.com/donkuri/lapis) Anki note type. It preserves Lapis's card
layouts, dictionary navigation, audio, images, frequency display, mobile layout,
and optional card modes while replacing Japanese furigana and pitch-accent logic
with per-character Mandarin tone coloring.

The large vocabulary word on the back is colored from `ExpressionReading`:

| Tone | Pleco mapping | Light | Dark |
| --- | --- | --- | --- |
| 1 | red | `#e30000` | `#ff6666` |
| 2 | green | `#02b31c` | `#4ade80` |
| 3 | blue | `#1510f0` | `#6ea8ff` |
| 4 | purple | `#8900bf` | `#c084fc` |
| 5 / neutral | gray | `#777777` | `#a3a3a3` |

The back-side header and matching bold target words in the sentence are colored.
Pinyin, definitions, and unrelated bold text keep their normal styling.

The back also shows the other Chinese character form beneath the expression. A
Simplified expression gets a labeled Traditional form and vice versa. Conversion
uses the bundled `opencc-js` library locally and does not require another Anki
field, custom Yomitan Handlebars, or network access during review. Taiwan
Traditional orthography is used without regional vocabulary substitution; words
whose two forms are identical do not get a duplicate line.

## Install the APKG

Download `LapisChinese.apkg` from the
[latest GitHub release](https://github.com/caocaochan/LapisChinese/releases/latest),
then import it with **File → Import** in Anki. The package creates a new
`Lapis Chinese` note type and an example deck; it does not overwrite Japanese
Lapis notes.

After importing, select `Lapis Chinese` as the model in Yomitan's **Configure Anki
card format** screen.

## Yomitan field mapping

This is the complete model schema and recommended mapping:

| Field | Yomitan value |
| --- | --- |
| `Expression` | `{expression}` |
| `ExpressionReading` | `{reading}` |
| `ExpressionAudio` | `{audio}` |
| `SelectionText` | `{popup-selection-text}` |
| `MainDefinition` | Your preferred `{single-glossary-...}` dictionary marker |
| `DefinitionPicture` | Optional definition image |
| `Sentence` | `{cloze-prefix}<b>{cloze-body}</b>{cloze-suffix}` |
| `SentenceAudio` | Optional sentence audio |
| `Picture` | Optional sentence or source image |
| `Glossary` | `{glossary}` |
| `Hint` | Optional hint |
| `IsWordAndSentenceCard` | Blank, or `x` for this card mode |
| `IsClickCard` | Blank, or `x` for this card mode |
| `IsSentenceCard` | Blank, or `x` for this card mode |
| `IsAudioCard` | Blank, or `x` for this card mode |
| `Frequency` | `{frequencies}` |
| `FreqSort` | `{frequency-harmonic-rank}` |
| `MiscInfo` | `{document-title}` or other source metadata |

Set at most one `Is…Card` field. With all four blank, the note produces the normal
vocabulary card.

### Pinyin requirements

`ExpressionReading` must contain explicit tone information. The parser accepts:

- Diacritics: `zhōng guó`, compact `zhōngguó` or `huáfà`, `nǚ ér`, `xī'ān`
- Numbers: `zhong1 guo2`, `ni3 hao3`, or compact `ni3hao3`
- Neutral tone: `ma5`, `ma0`, or an unmarked syllable in an otherwise marked
  reading such as `mā ma` or compact `péngyou`
- Umlaut variants: `lǜ`, `lü4`, `lv4`, and `lu:4`

Compact readings are segmented against the expression's Han-character count and
valid Mandarin syllable spellings. If more than one segmentation is possible,
add an apostrophe or space at the intended boundary; otherwise the word remains
uncolored. Wholly untoned readings, multiple alternatives, invalid input, and
readings without exactly one syllable per Han character also remain uncolored.
This fail-closed behavior prevents incorrect tone cues. Colors reflect the
dictionary reading literally; the template does not calculate tone sandhi.

## Manual template installation

Copy these files into Anki's card editor:

- `src/front.html` → Front Template
- `src/back.html` → Back Template
- `src/styling.css` → Styling

Also copy `vendor/opencc-js-1.4.1/_lapis_opencc.js` into the active Anki
profile's `collection.media` directory. The filename must keep its leading
underscore. The APKG already installs this media file automatically.

The template sources live in `src/`, and the pinned conversion bundle and its
license files live in `vendor/opencc-js-1.4.1/`. The back detects the primary
expression's script and applies `lang="zh-Hans"` or `lang="zh-Hant"` to select the
appropriate CJK glyph forms.

## Build

Requirements: Python 3.10 or newer. The packaging dependency is pinned in
`requirements.txt`.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --requirement requirements.txt
python scripts\build_apkg.py
```

The generated package is written to the ignored `dist/LapisChinese.apkg` path.
Every commit pushed to `main` runs the complete test suite and publishes a unique
GitHub release tagged `main-<12-character commit SHA>` with this APKG attached.

## Tests

Parser tests use Node's built-in test runner. The browser-rendering tests use the
pinned Playwright development dependency.

```powershell
npm install
npm run test:all-js
python -m unittest tests.test_package
```

The suite covers diacritic and numbered Pinyin, compact numeric readings, neutral
tones, umlaut spellings, mismatch and ambiguity handling, Simplified/Traditional
conversion and rendering, graceful converter failure, template cleanup, stable
Anki model metadata, and packaged OpenCC media.

## Customization

Font sizes, fonts, light/dark tone colors, images, and layout options are CSS
variables at the top of `src/styling.css`. The behavioral layout variables are
documented in [`docs/user_settings.md`](docs/user_settings.md).

## License and attribution

This project is a derivative of Donkuri's Lapis v1.7.0, created by Ruri, kuri,
itokatsu, and contributors. Lapis Chinese retains the upstream GPL-3.0 license;
see [`LICENSE`](LICENSE). The Pleco tone-to-color mapping is documented in
[Pleco's official manual](https://android.pleco.com/manual/240/dict.html#tone-colors).
Simplified/Traditional conversion uses
[`opencc-js` 1.4.1](https://github.com/nk2028/opencc-js), distributed under its
MIT and third-party licenses in `vendor/opencc-js-1.4.1/`.
