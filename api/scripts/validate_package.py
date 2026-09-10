#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    lessons = json.loads((ROOT / "data" / "lessons.json").read_text(encoding="utf-8"))
    concepts = json.loads((ROOT / "data" / "concepts.json").read_text(encoding="utf-8"))
    schema = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="utf-8"))

    assert lessons["course_code"] == "COURSES113"
    assert lessons["lesson_count"] == 52
    assert lessons["entry_count"] == 555
    assert len(lessons["lessons"]) == 52
    assert len({item["lesson_id"] for item in lessons["lessons"]}) == 52
    assert len(concepts["concepts"]) == 27
    assert schema["openapi"] == "3.1.0"
    assert schema["servers"][0]["url"] == "https://eclass.nimalakasiotis.gr/gpt-api"
    assert "searchCourseIndex" == schema["paths"]["/search"]["get"]["operationId"]

    lesson24 = next(item for item in lessons["lessons"] if item["lesson_id"] == "024")
    expected = {
        360: "00:06:00",
        730: "00:12:10",
        990: "00:16:30",
        1215: "00:20:15",
        1230: "00:20:30",
        1320: "00:22:00",
    }
    actual = {entry["seconds"]: entry["timestamp"] for entry in lesson24["entries"]}
    for seconds, timestamp in expected.items():
        assert actual.get(seconds) == timestamp

    with (ROOT / "data" / "video_links.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 52
    assert next(row for row in rows if row["lesson_id"] == "024")["video_base_url"] == "https://youtu.be/pRGj6NqvOlY"

    required = [
        "index.php",
        "config.example.php",
        ".htaccess",
        "openapi.yaml",
        "GPT_INSTRUCTIONS.txt",
        "README_TECHNICIAN.md",
        "VIDEO_LINKS.md",
        "TESTS.md",
        "ΠΡΩΤΑ_ΒΗΜΑΤΑ.txt",
    ]
    for filename in required:
        assert (ROOT / filename).is_file(), filename

    print(json.dumps({
        "status": "ok",
        "lessons": lessons["lesson_count"],
        "timestamps": lessons["entry_count"],
        "concepts": len(concepts["concepts"]),
        "video_rows": len(rows),
        "video_urls_present": sum(bool(row["video_base_url"].strip()) for row in rows),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
