# Lapis Chinese

Lapis Chinese is a Mandarin adaptation of the
[Lapis](https://github.com/donkuri/lapis) Anki note type. It brings the familiar
Lapis card design and features to Chinese vocabulary and sentence cards, with
support for Pinyin and Simplified and Traditional characters.

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
GitHub patch release with this APKG attached. Releases increment from `v1.0.0`
as `v1.0.1`, `v1.0.2`, and so on.

## Tests

Parser tests use Node's built-in test runner. The browser-rendering tests use the
pinned Playwright development dependency.

```powershell
npm install
npm run test:all-js
python -m unittest discover -s tests -p "test_*.py"
```

The suite covers diacritic and numbered Pinyin, compact numeric readings, neutral
tones, umlaut spellings, mismatch and ambiguity handling, Simplified/Traditional
conversion and persistent rendering, graceful converter failure, safe template
data handling, Click-card listener cleanup, release ordering, stable Anki model
metadata, and packaged OpenCC media.

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
