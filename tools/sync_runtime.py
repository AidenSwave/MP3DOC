#!/usr/bin/env python3
"""Synchronize runtime fallbacks and the checked Twine export."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LOADER = ROOT / "OLD/JS.txt"
FALLBACK_CSS = ROOT / "OLD/live.css"
FALLBACK_TEXT = ROOT / "OLD/live.txt"

SCRIPT_FILES = [
    "JS/config.js",
    "JS/tools.js",
    "JS/static-effect.js",
    "JS/assets.js",
    "JS/screenplay-parser.js",
    "JS/screenplay-validation.js",
    "JS/audio.js",
    "JS/visuals.js",
    "JS/dialogue.js",
    "JS/story-flow.js",
    "JS/hotspots.js",
    "JS/startup.js",
]

STYLE_FILES = [
    "CSS/base.css",
    "CSS/shell.css",
    "CSS/status.css",
    "CSS/stage.css",
    "CSS/dialogue.css",
    "CSS/options.css",
    "CSS/static-effect.css",
    "CSS/hotspots.css",
    "CSS/orientation.css",
]


def runtime_files(relative_paths: list[str]) -> list[Path]:
    paths = [ROOT / relative_path for relative_path in relative_paths]
    missing = [path for path in paths if not path.is_file()]
    if missing:
        names = ", ".join(path.relative_to(ROOT).as_posix() for path in missing)
        raise RuntimeError(f"Missing runtime files: {names}")
    return paths


def relative_paths(paths: list[Path]) -> list[str]:
    return [path.relative_to(ROOT).as_posix() for path in paths]


def replace_embedded(html: str, element: str, element_id: str, content: str) -> str:
    pattern = re.compile(
        rf'(<{element}\b[^>]*\bid="{re.escape(element_id)}"[^>]*>)(.*?)(</{element}>)',
        re.DOTALL,
    )
    updated, count = pattern.subn(
        lambda match: match.group(1) + content + match.group(3), html, count=1
    )
    if count != 1:
        raise RuntimeError(f"Could not find exactly one #{element_id} element in the export")
    return updated


def synchronize() -> tuple[list[str], list[str]]:
    scripts = runtime_files(SCRIPT_FILES)
    styles = runtime_files(STYLE_FILES)

    css_bundle = "\n\n".join(path.read_text().rstrip() for path in styles) + "\n"
    FALLBACK_CSS.write_text(css_bundle)
    FALLBACK_TEXT.write_text(css_bundle)

    export = ROOT / "Project Who.html"
    html = export.read_text()
    html = replace_embedded(html, "style", "twine-user-stylesheet", css_bundle)
    html = replace_embedded(html, "script", "twine-user-script", LOADER.read_text())
    export.write_text(html)
    return relative_paths(scripts), relative_paths(styles)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--print-local-config",
        action="store_true",
        help="print a loader override for a local HTTP server after synchronizing",
    )
    parser.add_argument("--base-url", default="http://localhost:8000/")
    parser.add_argument(
        "--local-preview",
        type=Path,
        help="write a temporary export whose embedded loader uses the local file list",
    )
    parser.add_argument(
        "--preview-only",
        action="store_true",
        help="create the local preview without rewriting fallbacks or the checked export",
    )
    arguments = parser.parse_args()
    if arguments.preview_only:
        scripts = relative_paths(runtime_files(SCRIPT_FILES))
        styles = relative_paths(runtime_files(STYLE_FILES))
    else:
        scripts, styles = synchronize()
    if arguments.print_local_config:
        payload = {
            "baseUrl": arguments.base_url,
            "revision": "local",
            "files": {"scripts": scripts, "styles": styles},
        }
        print("window.ProjectWhoLoaderConfig = " + json.dumps(payload, indent=2) + ";")
    if arguments.local_preview:
        payload = {
            "baseUrl": arguments.base_url,
            "revision": "local",
            "files": {"scripts": scripts, "styles": styles},
        }
        configured_loader = (
            "window.ProjectWhoLoaderConfig = " + json.dumps(payload) + ";\n" +
            LOADER.read_text()
        )
        preview = replace_embedded(
            (ROOT / "Project Who.html").read_text(),
            "script",
            "twine-user-script",
            configured_loader,
        )
        arguments.local_preview.write_text(preview)


if __name__ == "__main__":
    main()
