from __future__ import annotations

import unittest
from pathlib import Path

from scripts.release_policy import (
    HistoricalReleaseError,
    decide_release_tag,
    version_key,
)


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "release-main.yml"


class ReleasePolicyTest(unittest.TestCase):
    def decision(
        self,
        commit_sha: str,
        tag_commits: dict[str, str],
        ancestry: set[tuple[str, str]] | None = None,
    ):
        ancestry = ancestry or set()
        return decide_release_tag(
            commit_sha,
            tag_commits,
            tag_commits.__getitem__,
            lambda ancestor, descendant: (ancestor, descendant) in ancestry,
        )

    def test_patch_versions_follow_successful_commits(self) -> None:
        tag_commits = {"v1.0.0": "base", "1.7.0": "upstream"}
        first = self.decision("first", tag_commits)
        self.assertEqual((first.tag, first.existing), ("v1.0.1", False))

        tag_commits[first.tag] = "first"
        second = self.decision("second", tag_commits)
        self.assertEqual((second.tag, second.existing), ("v1.0.2", False))

    def test_existing_semantic_tag_is_reused(self) -> None:
        decision = self.decision(
            "released",
            {
                "v1.0.0": "base",
                "v1.0.1": "released",
                "v1.0.2": "released",
            },
        )
        self.assertEqual((decision.tag, decision.existing), ("v1.0.2", True))

    def test_untagged_historical_commit_is_rejected(self) -> None:
        with self.assertRaisesRegex(HistoricalReleaseError, "v1.0.2"):
            self.decision(
                "historical",
                {"v1.0.0": "base", "v1.0.2": "descendant"},
                {("historical", "descendant")},
            )

    def test_versions_sort_numerically(self) -> None:
        self.assertLess(version_key("v1.0.9"), version_key("v1.0.10"))

    def test_workflow_serializes_and_guards_latest_release(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("group: release-main", workflow)
        self.assertIn("queue: max", workflow)
        self.assertIn("fetch-depth: 0", workflow)
        self.assertIn('python scripts/release_policy.py "${GITHUB_SHA}"', workflow)
        self.assertIn("main:refs/remotes/origin/main", workflow)
        self.assertIn('latest_arg="--latest=false"', workflow)
        self.assertIn('edit_args+=(--latest)', workflow)
        self.assertNotIn("group: release-main-${{ github.sha }}", workflow)


if __name__ == "__main__":
    unittest.main()
