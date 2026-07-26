import json
import tempfile
import unittest
from pathlib import Path

import parse_log


LEGACY_LOG = """# Weekly log

---

## Week of Aug 31 – Sep 6

### "L’été → launch ✨"

**Highlights**

* Legacy highlight

**Shipped**

* Legacy shipment

---

## Week of Sep 7 – Sep 13

### "Second legacy week"

**Next**

* Keep building
"""


def generated_entry(week_start, title):
    return {
        "weekStart": week_start,
        "weekEnd": week_start,
        "source": "github-weekly-automation",
        "dateRange": "Generated week",
        "title": title,
        "highlights": [],
        "shipped": [],
        "engineering": [],
        "fixes": [],
        "metrics": [],
        "next": []
    }


class RegenerateWeeklyLogTests(unittest.TestCase):
    def test_rebuilds_legacy_entries_and_preserves_generated_alias_entries(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            log_path = root / "WeeklyLog.txt"
            data_directory = root / "data"
            history_path = data_directory / "weekly-history.json"
            compatibility_path = data_directory / "weekly-log.json"
            data_directory.mkdir()
            log_path.write_text(LEGACY_LOG, encoding="utf-8")

            july_fifth = generated_entry("2026-07-05", "Generated ✨ first")
            july_twelfth = generated_entry("2026-07-12", "Generated second")
            july_nineteenth = generated_entry("2026-07-19", "Generated alias-only")
            history_path.write_text(
                json.dumps([{"dateRange": "stale legacy"}, july_twelfth, july_fifth]),
                encoding="utf-8"
            )
            compatibility_path.write_text(
                json.dumps([july_fifth, july_twelfth, july_nineteenth]),
                encoding="utf-8"
            )

            entries = parse_log.regenerate_weekly_log(log_path, history_path, compatibility_path)
            history_text = history_path.read_text(encoding="utf-8")
            compatibility_text = compatibility_path.read_text(encoding="utf-8")
            output = json.loads(history_text)

            self.assertEqual(history_text, compatibility_text)
            self.assertTrue(history_text.endswith("\n"))
            self.assertIn("L’été → launch ✨", history_text)
            self.assertNotIn("\\u", history_text)
            self.assertEqual(entries[0]["highlights"], ["Legacy highlight"])
            self.assertNotIn({"dateRange": "stale legacy"}, output)
            self.assertEqual(
                [entry.get("weekStart") for entry in output if entry.get("weekStart")],
                ["2026-07-05", "2026-07-12", "2026-07-19"]
            )
            self.assertEqual(output[-3:], [july_fifth, july_twelfth, july_nineteenth])


if __name__ == "__main__":
    unittest.main()
