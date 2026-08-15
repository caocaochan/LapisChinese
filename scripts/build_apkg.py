from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import genanki


MODEL_ID = 1248989840
DECK_ID = 1976880658
MODEL_NAME = "Lapis Chinese"
TEMPLATE_NAME = "Mining"
OPENCC_VERSION = "1.4.1"
OPENCC_MEDIA_NAME = "_lapis_opencc.js"
OPENCC_SHA256 = "f04e8f700d3a36b01a32bb0f051e6e5aff4b29dd1cb19f0787bb0c959abe36a8"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = PROJECT_ROOT / "src"
OPENCC_SOURCE = (
    PROJECT_ROOT / "vendor" / f"opencc-js-{OPENCC_VERSION}" / OPENCC_MEDIA_NAME
)

FIELDS = [
    {"name": "Expression", "font": "Microsoft YaHei", "size": 50},
    {"name": "ExpressionReading", "font": "Microsoft YaHei"},
    {"name": "ExpressionAudio", "font": "Microsoft YaHei", "size": 10},
    {"name": "SelectionText", "font": "Microsoft YaHei"},
    {"name": "MainDefinition", "font": "Microsoft YaHei"},
    {"name": "DefinitionPicture", "font": "Microsoft YaHei", "size": 15},
    {"name": "Sentence", "font": "Microsoft YaHei", "size": 20},
    {"name": "SentenceAudio", "font": "Microsoft YaHei", "size": 10},
    {"name": "Picture", "font": "Microsoft YaHei"},
    {"name": "Glossary", "font": "Microsoft YaHei"},
    {"name": "Hint", "font": "Microsoft YaHei"},
    {"name": "IsWordAndSentenceCard", "font": "Microsoft YaHei"},
    {"name": "IsClickCard", "font": "Microsoft YaHei"},
    {"name": "IsSentenceCard", "font": "Microsoft YaHei"},
    {"name": "IsAudioCard", "font": "Microsoft YaHei"},
    {"name": "Frequency", "font": "Microsoft YaHei"},
    {"name": "FreqSort", "font": "Microsoft YaHei"},
    {"name": "MiscInfo", "font": "Microsoft YaHei", "size": 15},
]

EXAMPLE_NOTE = [
    "中国",
    "zhōng guó",
    "",
    "",
    (
        '<div class="yomitan-glossary" style="text-align:left"><ol>'
        '<li data-dictionary="CC-CEDICT"><i>(CC-CEDICT)</i> China; '
        "the Middle Kingdom</li></ol></div>"
    ),
    "",
    "我住在<b>中国</b>。",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "1",
    "Lapis Chinese example note",
]


class StableExpressionNote(genanki.Note):
    @property
    def guid(self) -> str:
        return genanki.guid_for(self.fields[0])


def read_sources() -> tuple[str, str, str]:
    return (
        (SOURCE_DIR / "front.html").read_text(encoding="utf-8"),
        (SOURCE_DIR / "back.html").read_text(encoding="utf-8"),
        (SOURCE_DIR / "styling.css").read_text(encoding="utf-8"),
    )


def validate_opencc_bundle() -> None:
    opencc_hash = hashlib.sha256(OPENCC_SOURCE.read_bytes()).hexdigest()
    if opencc_hash != OPENCC_SHA256:
        raise ValueError(
            f"Unexpected opencc-js {OPENCC_VERSION} bundle hash: {opencc_hash}"
        )


def build_package(output_file: Path) -> None:
    front, back, css = read_sources()
    validate_opencc_bundle()

    model = genanki.Model(
        MODEL_ID,
        MODEL_NAME,
        fields=FIELDS,
        templates=[
            {
                "name": TEMPLATE_NAME,
                "qfmt": front,
                "afmt": back,
            }
        ],
        css=css,
    )
    deck = genanki.Deck(DECK_ID, MODEL_NAME)
    deck.add_note(
        StableExpressionNote(
            model=model,
            fields=EXAMPLE_NOTE,
            tags=["lapis-chinese::example"],
        )
    )

    output_file.parent.mkdir(parents=True, exist_ok=True)
    genanki.Package(deck, media_files=[str(OPENCC_SOURCE)]).write_to_file(
        str(output_file)
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the Lapis Chinese APKG")
    parser.add_argument(
        "output_file",
        nargs="?",
        type=Path,
        default=PROJECT_ROOT / "dist" / "LapisChinese.apkg",
    )
    return parser.parse_args()


if __name__ == "__main__":
    build_package(parse_args().output_file.resolve())
