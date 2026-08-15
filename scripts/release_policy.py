from __future__ import annotations

import re
import subprocess
import sys
from collections.abc import Callable, Iterable
from dataclasses import dataclass


SEMVER_PATTERN = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")


class HistoricalReleaseError(RuntimeError):
    pass


@dataclass(frozen=True)
class ReleaseDecision:
    tag: str
    existing: bool


def version_key(tag: str) -> tuple[int, int, int]:
    match = SEMVER_PATTERN.fullmatch(tag)
    if not match:
        raise ValueError(f"Not a semantic release tag: {tag}")
    return tuple(int(part) for part in match.groups())


def decide_release_tag(
    commit_sha: str,
    tags: Iterable[str],
    resolve_commit: Callable[[str], str],
    is_ancestor: Callable[[str, str], bool],
) -> ReleaseDecision:
    semantic_tags = sorted(
        (tag for tag in tags if SEMVER_PATTERN.fullmatch(tag)),
        key=version_key,
    )
    tagged_commits = {tag: resolve_commit(tag) for tag in semantic_tags}

    existing_tags = [
        tag for tag, tagged_commit in tagged_commits.items()
        if tagged_commit == commit_sha
    ]
    if existing_tags:
        return ReleaseDecision(max(existing_tags, key=version_key), existing=True)

    descendant_tags = [
        tag for tag, tagged_commit in tagged_commits.items()
        if tagged_commit != commit_sha and is_ancestor(commit_sha, tagged_commit)
    ]
    if descendant_tags:
        first_descendant = min(descendant_tags, key=version_key)
        raise HistoricalReleaseError(
            f"Refusing to version historical commit {commit_sha}: "
            f"{first_descendant} already tags a descendant."
        )

    latest_tag = max(semantic_tags, key=version_key) if semantic_tags else "v1.0.0"
    major, minor, patch = version_key(latest_tag)
    return ReleaseDecision(f"v{major}.{minor}.{patch + 1}", existing=False)


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        check=check,
        capture_output=True,
        text=True,
    )


def decide_for_repository(commit_sha: str) -> ReleaseDecision:
    tags = git("tag", "--list").stdout.splitlines()

    def resolve_commit(tag: str) -> str:
        return git("rev-parse", f"{tag}^{{commit}}").stdout.strip()

    def is_ancestor(ancestor: str, descendant: str) -> bool:
        result = git("merge-base", "--is-ancestor", ancestor, descendant, check=False)
        if result.returncode not in (0, 1):
            raise subprocess.CalledProcessError(
                result.returncode,
                result.args,
                output=result.stdout,
                stderr=result.stderr,
            )
        return result.returncode == 0

    return decide_release_tag(commit_sha, tags, resolve_commit, is_ancestor)


def main() -> int:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} COMMIT_SHA", file=sys.stderr)
        return 2

    try:
        decision = decide_for_repository(sys.argv[1])
    except (HistoricalReleaseError, ValueError, subprocess.CalledProcessError) as error:
        print(error, file=sys.stderr)
        return 1

    status = "existing" if decision.existing else "new"
    print(status, decision.tag)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
