from __future__ import annotations

import json
import re
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

import genanki


ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = ROOT / "scripts" / "build_apkg.py"
OPENCC_MEDIA_NAME = "_lapis_opencc.js"
OPENCC_VENDOR = ROOT / "vendor" / "opencc-js-1.4.1" / OPENCC_MEDIA_NAME
EXPECTED_FIELDS = [
    "Expression",
    "ExpressionReading",
    "ExpressionAudio",
    "SelectionText",
    "MainDefinition",
    "DefinitionPicture",
    "Sentence",
    "SentenceAudio",
    "Picture",
    "Glossary",
    "Hint",
    "IsWordAndSentenceCard",
    "IsClickCard",
    "IsSentenceCard",
    "IsAudioCard",
    "Frequency",
    "FreqSort",
    "MiscInfo",
]
BANNED_TEMPLATE_TEXT = [
    'lang="ja"',
    "ExpressionFurigana",
    "SentenceFurigana",
    "PitchPosition",
    "PitchCategories",
    "handlePitches",
    "constructPitch",
    "pitch-item",
    "pitch-line",
    "heiban",
    "atamadaka",
    "nakadaka",
    "odaka",
    "kifuku",
]


class PackageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.apkg = Path(cls.temp_dir.name) / "LapisChinese.apkg"
        subprocess.run(
            [sys.executable, str(BUILD_SCRIPT), str(cls.apkg)],
            cwd=ROOT,
            check=True,
        )

        with zipfile.ZipFile(cls.apkg) as package:
            package.extract("collection.anki2", cls.temp_dir.name)

        cls.connection = sqlite3.connect(Path(cls.temp_dir.name) / "collection.anki2")
        models_json, decks_json = cls.connection.execute(
            "SELECT models, decks FROM col"
        ).fetchone()
        cls.models = json.loads(models_json)
        cls.decks = json.loads(decks_json)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.connection.close()
        cls.temp_dir.cleanup()

    def test_model_and_deck_ids_are_stable(self) -> None:
        self.assertIn("1248989840", self.models)
        self.assertEqual(self.models["1248989840"]["name"], "Lapis Chinese")
        self.assertIn("1976880658", self.decks)
        self.assertEqual(self.decks["1976880658"]["name"], "Lapis Chinese")

    def test_field_schema_and_single_template(self) -> None:
        model = self.models["1248989840"]
        self.assertEqual([field["name"] for field in model["flds"]], EXPECTED_FIELDS)
        self.assertEqual(len(model["tmpls"]), 1)
        self.assertEqual(model["tmpls"][0]["name"], "Mining")

    def test_packaged_templates_match_source(self) -> None:
        model = self.models["1248989840"]
        self.assertEqual(
            (ROOT / "src" / "front.html").read_text(encoding="utf-8"),
            model["tmpls"][0]["qfmt"],
        )
        self.assertEqual(
            (ROOT / "src" / "back.html").read_text(encoding="utf-8"),
            model["tmpls"][0]["afmt"],
        )
        self.assertEqual(
            (ROOT / "src" / "styling.css").read_text(encoding="utf-8"),
            model["css"],
        )

    def test_opencc_bundle_is_packaged_as_media(self) -> None:
        with zipfile.ZipFile(self.apkg) as package:
            media = json.loads(package.read("media"))
            matching_indexes = [
                index
                for index, filename in media.items()
                if filename == OPENCC_MEDIA_NAME
            ]
            self.assertEqual(len(matching_indexes), 1)
            self.assertEqual(
                package.read(matching_indexes[0]),
                OPENCC_VENDOR.read_bytes(),
            )

    def test_templates_contain_no_japanese_pitch_artifacts(self) -> None:
        template_text = "\n".join(
            path.read_text(encoding="utf-8")
            for path in [
                ROOT / "src" / "front.html",
                ROOT / "src" / "back.html",
                ROOT / "src" / "styling.css",
            ]
        )
        for banned in BANNED_TEMPLATE_TEXT:
            with self.subTest(banned=banned):
                self.assertNotIn(banned, template_text)
        self.assertIn('lang="zh-Hans"', template_text)
        self.assertIn('lang="zh-Hant"', template_text)
        self.assertNotIn('<script src="_lapis_opencc.js"></script>', template_text)
        self.assertIn('script.src = "_lapis_opencc.js"', template_text)

    def test_inline_scripts_do_not_interpolate_fields(self) -> None:
        for template_name in ["front.html", "back.html"]:
            template = (ROOT / "src" / template_name).read_text(encoding="utf-8")
            inline_scripts = re.findall(
                r"<script(?:\s[^>]*)?>(.*?)</script>",
                template,
                flags=re.DOTALL,
            )
            self.assertGreater(len(inline_scripts), 0, template_name)
            for script in inline_scripts:
                with self.subTest(template=template_name):
                    self.assertNotIn("{{", script)

    def test_sample_note_and_card(self) -> None:
        guid, model_id, fields, tags = self.connection.execute(
            "SELECT guid, mid, flds, tags FROM notes"
        ).fetchone()
        self.assertEqual(model_id, 1248989840)
        self.assertEqual(fields.split("\x1f")[0:2], ["中国", "zhōng guó"])
        self.assertEqual(guid, genanki.guid_for("中国"))
        self.assertIn("lapis-chinese::example", tags)
        self.assertEqual(
            self.connection.execute("SELECT COUNT(*) FROM cards").fetchone()[0],
            1,
        )

    def test_pleco_palette_is_packaged(self) -> None:
        css = self.models["1248989840"]["css"]
        for value in [
            "#e30000",
            "#02b31c",
            "#1510f0",
            "#8900bf",
            "#777777",
            "#ff6666",
            "#4ade80",
            "#6ea8ff",
            "#c084fc",
            "#a3a3a3",
        ]:
            with self.subTest(value=value):
                self.assertIn(value, css)


if __name__ == "__main__":
    unittest.main()
