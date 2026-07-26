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


def weekly_log_paths(root):
    log_path = root / "WeeklyLog.txt"
    data_directory = root / "data"
    history_path = data_directory / "weekly-history.json"
    compatibility_path = data_directory / "weekly-log.json"
    data_directory.mkdir()
    log_path.write_text(LEGACY_LOG, encoding="utf-8")
    return log_path, history_path, compatibility_path


class RegenerateWeeklyLogTests(unittest.TestCase):
    def assert_invalid_week_start_aborts_without_writes(self, invalid_week_start):
        with tempfile.TemporaryDirectory() as temporary_directory:
            log_path, history_path, compatibility_path = weekly_log_paths(
                Path(temporary_directory)
            )
            history_before = json.dumps([
                generated_entry(invalid_week_start, "Invalid generated week")
            ])
            compatibility_before = json.dumps([
                generated_entry("2026-07-12", "Valid sibling")
            ])
            history_path.write_text(history_before, encoding="utf-8")
            compatibility_path.write_text(compatibility_before, encoding="utf-8")

            with self.assertRaisesRegex(
                ValueError, "Invalid generated weekStart.*expected YYYY-MM-DD"
            ) as raised:
                parse_log.regenerate_weekly_log(
                    log_path, history_path, compatibility_path
                )

            self.assertIn(str(history_path), str(raised.exception))
            self.assertIn(repr(invalid_week_start), str(raised.exception))
            self.assertEqual(history_path.read_text(encoding="utf-8"), history_before)
            self.assertEqual(
                compatibility_path.read_text(encoding="utf-8"), compatibility_before
            )

    def test_rebuilds_legacy_entries_and_preserves_generated_alias_entries(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            log_path, history_path, compatibility_path = weekly_log_paths(root)

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

    def test_preserves_valid_sibling_when_history_alias_is_malformed(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            log_path, history_path, compatibility_path = weekly_log_paths(
                Path(temporary_directory)
            )
            history_path.write_text('{"unfinished":', encoding="utf-8")
            compatibility_path.write_text(
                json.dumps([generated_entry("2026-07-05", "Sibling survives")]),
                encoding="utf-8"
            )

            parse_log.regenerate_weekly_log(log_path, history_path, compatibility_path)

            history_output = json.loads(history_path.read_text(encoding="utf-8"))
            self.assertEqual(
                [entry["weekStart"] for entry in history_output if "weekStart" in entry],
                ["2026-07-05"]
            )
            self.assertEqual(
                history_path.read_text(encoding="utf-8"),
                compatibility_path.read_text(encoding="utf-8")
            )

    def test_preserves_valid_sibling_when_history_alias_is_not_a_list(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            log_path, history_path, compatibility_path = weekly_log_paths(
                Path(temporary_directory)
            )
            history_path.write_text(
                json.dumps({"unexpected": "object"}), encoding="utf-8"
            )
            compatibility_path.write_text(
                json.dumps([generated_entry("2026-07-12", "List survives")]),
                encoding="utf-8"
            )

            parse_log.regenerate_weekly_log(log_path, history_path, compatibility_path)

            history_output = json.loads(history_path.read_text(encoding="utf-8"))
            self.assertEqual(
                [entry["weekStart"] for entry in history_output if "weekStart" in entry],
                ["2026-07-12"]
            )
            self.assertEqual(
                history_path.read_text(encoding="utf-8"),
                compatibility_path.read_text(encoding="utf-8")
            )

    def test_all_unusable_aliases_fail_without_writing_either_output(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            log_path, history_path, compatibility_path = weekly_log_paths(
                Path(temporary_directory)
            )
            history_before = '{"unfinished":'
            compatibility_before = json.dumps({"unexpected": "object"})
            history_path.write_text(history_before, encoding="utf-8")
            compatibility_path.write_text(compatibility_before, encoding="utf-8")

            with self.assertRaisesRegex(
                ValueError, "No usable weekly-entry list found"
            ) as raised:
                parse_log.regenerate_weekly_log(
                    log_path, history_path, compatibility_path
                )

            self.assertIn(str(history_path), str(raised.exception))
            self.assertIn(str(compatibility_path), str(raised.exception))
            self.assertEqual(history_path.read_text(encoding="utf-8"), history_before)
            self.assertEqual(
                compatibility_path.read_text(encoding="utf-8"), compatibility_before
            )

    def test_invalid_format_week_start_aborts_without_writing_aliases(self):
        self.assert_invalid_week_start_aborts_without_writes("2026-7-19")

    def test_invalid_calendar_week_start_aborts_without_writing_aliases(self):
        self.assert_invalid_week_start_aborts_without_writes("2026-02-30")

    def test_numeric_week_start_aborts_without_writing_aliases(self):
        self.assert_invalid_week_start_aborts_without_writes(20260719)

    def test_normalizes_and_deduplicates_whitespace_conflicting_week_keys(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            log_path, history_path, compatibility_path = weekly_log_paths(
                Path(temporary_directory)
            )
            history_path.write_text(
                json.dumps([
                    generated_entry(" 2026-07-05 ", "History wins")
                ]),
                encoding="utf-8"
            )
            compatibility_path.write_text(
                json.dumps([
                    generated_entry("2026-07-05", "Alias loses"),
                    generated_entry("2026-07-12", "Unique alias week")
                ]),
                encoding="utf-8"
            )

            parse_log.regenerate_weekly_log(log_path, history_path, compatibility_path)

            output = json.loads(history_path.read_text(encoding="utf-8"))
            generated_entries = [entry for entry in output if "weekStart" in entry]
            self.assertEqual(
                [entry["weekStart"] for entry in generated_entries],
                ["2026-07-05", "2026-07-12"]
            )
            self.assertEqual(generated_entries[0]["title"], "History wins")
            self.assertEqual(
                history_path.read_text(encoding="utf-8"),
                compatibility_path.read_text(encoding="utf-8")
            )


if __name__ == "__main__":
    unittest.main()
