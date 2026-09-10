#!/usr/bin/env python3
"""Build the COURSES113 search index from TIMESTAMPS.md and the concept DOCX."""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


HEADING_RE = re.compile(r"^##\s+Μάθημα\s+(.+?)\s+—\s+(.+?)\s*$")
ENTRY_RE = re.compile(r"^-\s+\*\*(\d{1,2}:\d{2}(?::\d{2})?)\*\*\s+—\s+(.+?)\s*$")
LESSON_REF_RE = re.compile(r"(?:Μάθημα|Μαθήματα|μάθημα|μαθήματα)\s+([^.:]+)")
DIRECT_TIME_RE = re.compile(r"(?<!\d)(\d{1,2}:\d{2})(?:\s*min)?", re.IGNORECASE)


def canonical_lesson(raw: str) -> str:
    value = raw.strip().replace(" ", "")
    match = re.fullmatch(r"(\d+)([A-Za-zΑ-Ωα-ω]?)", value)
    if not match:
        return value
    number = int(match.group(1))
    suffix = match.group(2).lower().replace("a", "α").replace("b", "β")
    return f"{number:03d}{suffix}"


def time_to_seconds(value: str) -> int:
    parts = [int(part) for part in value.split(":")]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return parts[0] * 3600 + parts[1] * 60 + parts[2]


def display_time(value: str) -> str:
    seconds = time_to_seconds(value)
    return f"{seconds // 3600:02d}:{(seconds % 3600) // 60:02d}:{seconds % 60:02d}"


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFD", value.lower().replace("ς", "σ"))
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = re.sub(r"[^\w=<>+\-/\.]+", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip()


def keywords(description: str) -> list[str]:
    candidates = [description]
    for piece in re.split(r"[|;—–]", description):
        piece = piece.strip()
        if len(piece) >= 4:
            candidates.append(piece)
    normalized = []
    seen = set()
    for candidate in candidates:
        key = normalize(candidate)
        if key and key not in seen:
            seen.add(key)
            normalized.append(candidate)
    return normalized[:8]


def parse_timestamps(path: Path) -> list[dict]:
    lessons: list[dict] = []
    current: dict | None = None
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        heading = HEADING_RE.match(raw_line)
        if heading:
            lesson_id = canonical_lesson(heading.group(1))
            current = {
                "lesson_id": lesson_id,
                "lesson": f"Μάθημα {lesson_id}",
                "lesson_number": int(re.match(r"\d+", lesson_id).group(0)),
                "title": heading.group(2).strip(),
                "entries": [],
            }
            lessons.append(current)
            continue
        entry = ENTRY_RE.match(raw_line)
        if entry and current is not None:
            timestamp, description = entry.groups()
            current["entries"].append(
                {
                    "timestamp": display_time(timestamp),
                    "seconds": time_to_seconds(timestamp),
                    "topic": description.split("—", 1)[0].strip(),
                    "description": description.strip(),
                    "keywords": keywords(description),
                }
            )
    return lessons


def docx_paragraphs(path: Path) -> list[str]:
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with zipfile.ZipFile(path) as archive:
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)
    paragraphs = []
    for paragraph in root.findall(".//w:p", namespace):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace)).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def lesson_refs(text: str, known_ids: set[str]) -> list[str]:
    refs: list[str] = []
    for group in LESSON_REF_RE.findall(text):
        for number, suffix in re.findall(r"(\d+)([A-Za-zΑ-Ωα-ω]?)", group):
            candidate = canonical_lesson(number + suffix)
            if candidate in known_ids and candidate not in refs:
                refs.append(candidate)
    return refs


def parse_concepts(path: Path, known_ids: set[str]) -> list[dict]:
    concepts = []
    for paragraph in docx_paragraphs(path):
        if normalize(paragraph) == normalize("ΕΥΡΕΤΗΡΙΟ ΕΝΝΟΙΩΝ"):
            continue
        refs = lesson_refs(paragraph, known_ids)
        if not refs:
            continue
        direct_times = [display_time(item) for item in DIRECT_TIME_RE.findall(paragraph)]
        concept = paragraph.split(":", 1)[0].strip()
        concepts.append(
            {
                "concept": concept,
                "description": paragraph,
                "lesson_ids": refs,
                "timestamps": direct_times,
                "keywords": keywords(concept),
            }
        )
    return concepts


def existing_video_links(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    mapping = {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            lesson_id = canonical_lesson(row.get("lesson_id", ""))
            url = row.get("video_base_url", "").strip()
            if lesson_id and url:
                mapping[lesson_id] = url.split("?t=", 1)[0].split("&t=", 1)[0]
    return mapping


def write_video_template(path: Path, lessons: list[dict], mapping: dict[str, str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["lesson_id", "lesson_title", "video_base_url"])
        writer.writeheader()
        for lesson in lessons:
            writer.writerow(
                {
                    "lesson_id": lesson["lesson_id"],
                    "lesson_title": lesson["title"],
                    "video_base_url": mapping.get(lesson["lesson_id"], ""),
                }
            )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timestamps", type=Path, required=True)
    parser.add_argument("--concepts", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    videos_path = args.output_dir / "video_links.csv"
    mapping = existing_video_links(videos_path)
    mapping.setdefault("024", "https://youtu.be/pRGj6NqvOlY")

    lessons = parse_timestamps(args.timestamps)
    for lesson in lessons:
        lesson["video_base_url"] = mapping.get(lesson["lesson_id"], "")
    known_ids = {lesson["lesson_id"] for lesson in lessons}
    concepts = parse_concepts(args.concepts, known_ids)

    payload = {
        "course_code": "COURSES113",
        "course_title": "ΦΥΣΙΚΗ Γ΄ ΛΥΚΕΙΟΥ 2026–2027",
        "lesson_count": len(lessons),
        "entry_count": sum(len(lesson["entries"]) for lesson in lessons),
        "lessons": lessons,
    }
    (args.output_dir / "lessons.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (args.output_dir / "concepts.json").write_text(
        json.dumps({"course_code": "COURSES113", "concepts": concepts}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_video_template(videos_path, lessons, mapping)

    print(json.dumps({
        "lessons": len(lessons),
        "timestamp_entries": payload["entry_count"],
        "concepts": len(concepts),
        "video_links": len([value for value in mapping.values() if value]),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
