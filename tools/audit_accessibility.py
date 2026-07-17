#!/usr/bin/env python3
"""Static accessibility audit for generated public HTML documents.

This complements browser journeys: it verifies semantics that must never regress
regardless of viewport, data or runtime state, and requires no browser install.
"""
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable, Sequence

from build_site_pages import PAGE_DOCUMENTS

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
INTERACTIVE = {"a", "button", "input", "select", "textarea"}

@dataclass
class Node:
    tag: str
    attrs: dict[str, str]
    parent: "Node | None" = None
    children: list["Node"] = field(default_factory=list)
    text_parts: list[str] = field(default_factory=list)

    def text(self) -> str:
        parts = list(self.text_parts)
        for child in self.children:
            parts.append(child.text())
        return " ".join(" ".join(parts).split())

class TreeParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("document", {})
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag.lower(), {key.lower(): value or "" for key, value in attrs}, self.stack[-1])
        self.stack[-1].children.append(node)
        if node.tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if self.stack[-1].tag == tag.lower():
            self.stack.pop()

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.stack[-1].text_parts.append(data)

def walk(node: Node) -> Iterable[Node]:
    for child in node.children:
        yield child
        yield from walk(child)

def label_text(node: Node, ids: dict[str, Node]) -> str:
    labelledby = node.attrs.get("aria-labelledby", "").split()
    if labelledby:
        return " ".join(ids[item].text() for item in labelledby if item in ids).strip()
    return (node.attrs.get("aria-label") or node.text() or node.attrs.get("title") or "").strip()

def audit_file(path: Path) -> list[str]:
    parser = TreeParser()
    parser.feed(path.read_text(encoding="utf-8"))
    nodes = list(walk(parser.root))
    issues: list[str] = []
    ids: dict[str, Node] = {}
    for node in nodes:
        identifier = node.attrs.get("id")
        if identifier:
            if identifier in ids:
                issues.append(f"duplicate id #{identifier}")
            ids[identifier] = node

    html = next((node for node in nodes if node.tag == "html"), None)
    if not html or html.attrs.get("lang") != "he" or html.attrs.get("dir") != "rtl":
        issues.append("html must declare lang=he and dir=rtl")
    mains = [node for node in nodes if node.tag == "main"]
    if len(mains) != 1:
        issues.append("document must contain exactly one main landmark")
    if path.name != "404.html" and not any(node.tag == "a" and node.attrs.get("href") == "#main-content" for node in nodes):
        issues.append("missing skip link to #main-content")
    if path.name == "404.html" and not any(node.tag == "a" and node.attrs.get("href") == "#main-content" for node in nodes):
        issues.append("404 page missing skip link")

    labels_for = {node.attrs.get("for") for node in nodes if node.tag == "label" and node.attrs.get("for")}
    for node in nodes:
        attrs = node.attrs
        if attrs.get("tabindex", "").isdigit() and int(attrs["tabindex"]) > 0:
            issues.append(f"{node.tag} uses positive tabindex")
        if node.tag == "img" and "alt" not in attrs:
            issues.append(f"image missing alt: {attrs.get('src', '<no src>')}")
        if node.tag == "a" and attrs.get("target") == "_blank" and "noopener" not in attrs.get("rel", "").split():
            issues.append(f"target=_blank link missing rel=noopener: {attrs.get('href', '')}")
        if node.tag in {"button", "a"} and (node.tag != "a" or attrs.get("href")):
            if not label_text(node, ids):
                issues.append(f"{node.tag} missing accessible name: #{attrs.get('id', '')}")
        if node.tag in {"input", "select", "textarea"}:
            identifier = attrs.get("id")
            if not (attrs.get("aria-label") or attrs.get("aria-labelledby") or (identifier and identifier in labels_for)):
                issues.append(f"form control missing label: #{identifier or ''}")
        if attrs.get("role") == "dialog":
            if attrs.get("aria-modal") != "true":
                issues.append(f"dialog missing aria-modal=true: #{attrs.get('id', '')}")
            if not (attrs.get("aria-label") or attrs.get("aria-labelledby")):
                issues.append(f"dialog missing accessible name: #{attrs.get('id', '')}")
        if attrs.get("aria-hidden") == "true" and node.tag in INTERACTIVE and attrs.get("tabindex") != "-1":
            issues.append(f"interactive aria-hidden element must be removed from tab order: #{attrs.get('id', '')}")
        for reference_attr in ("aria-labelledby", "aria-describedby", "aria-controls"):
            for reference in attrs.get(reference_attr, "").split():
                if reference and reference not in ids:
                    issues.append(f"{reference_attr} references missing #{reference}")

    if path.name in {page.filename for page in PAGE_DOCUMENTS}:
        if not any(node.tag == "a" and node.attrs.get("href") == "accessibility.html" for node in nodes):
            issues.append("public page footer missing accessibility statement link")
    return issues

def _hex_luminance(value: str) -> float:
    raw = value.lstrip("#")
    if len(raw) == 3:
        raw = "".join(character * 2 for character in raw)
    if len(raw) != 6:
        raise ValueError(value)
    channels = [int(raw[index:index + 2], 16) / 255 for index in (0, 2, 4)]
    linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def _contrast_ratio(first: str, second: str) -> float:
    a, b = _hex_luminance(first), _hex_luminance(second)
    lighter, darker = max(a, b), min(a, b)
    return (lighter + 0.05) / (darker + 0.05)


def audit_css(path: Path) -> list[str]:
    css = path.read_text(encoding="utf-8")
    issues: list[str] = []
    variables = {
        name: value.lower()
        for name, value in re.findall(r"(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;", css)
    }
    contrast_pairs = (
        ("--brand", "#ffffff", 4.5, "primary button text"),
        ("--brand-dark", "#ffffff", 4.5, "dark brand button text"),
        ("--ink", "--surface-strong", 7.0, "primary text"),
        ("--muted", "--surface-strong", 4.5, "secondary text"),
        ("--state-error-ink", "--state-error-surface", 4.5, "error feedback"),
    )
    for foreground_key, background_key, minimum, label in contrast_pairs:
        foreground = variables.get(foreground_key, foreground_key if foreground_key.startswith("#") else "")
        background = variables.get(background_key, background_key if background_key.startswith("#") else "")
        if not foreground or not background:
            issues.append(f"missing color token for {label}: {foreground_key}/{background_key}")
            continue
        ratio = _contrast_ratio(foreground, background)
        if ratio < minimum:
            issues.append(f"insufficient contrast for {label}: {ratio:.2f}:1 (requires {minimum:.1f}:1)")

    required_patterns = {
        "visible focus system": r":focus-visible\s*\{[\s\S]*?(?:outline|box-shadow)",
        "forced-colors support": r"@media \(forced-colors: active\)",
        "reduced-motion support": r"@media \(prefers-reduced-motion: reduce\)",
        "minimum control height": r"--control-height:\s*(?:4[2-9]|[5-9][0-9])px",
        "semantic error state": r"\.ui-state\[data-state=\"error\"\]",
    }
    for label, pattern in required_patterns.items():
        if not re.search(pattern, css):
            issues.append(f"missing CSS accessibility guarantee: {label}")
    return issues


def audit_project(root: Path) -> dict[str, list[str]]:
    files = [root / page.filename for page in PAGE_DOCUMENTS] + [root / "404.html"]
    results = {path.name: audit_file(path) for path in files if path.is_file()}
    styles = root / "styles.css"
    if styles.is_file():
        results[styles.name] = audit_css(styles)
    return results

def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
    results = audit_project(root)
    failed = False
    for filename, issues in results.items():
        if issues:
            failed = True
            print(f"{filename}: {len(issues)} issue(s)")
            for issue in issues:
                print(f"  - {issue}")
        else:
            print(f"{filename}: PASS")
    if failed:
        print("Accessibility audit failed.")
        return 1
    print(f"Accessibility audit passed for {len(results)} public documents.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
