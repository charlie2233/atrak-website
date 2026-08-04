
# Script to parse the weekly log text file and output structured JSON
import re
import json
from datetime import date
from pathlib import Path


DATE_KEY_PATTERN = re.compile(r'[0-9]{4}-[0-9]{2}-[0-9]{2}')


def parse_weekly_log(file_path):
    """
    Parses a weekly log text file and returns a list of week data as dicts.
    Each week is separated by '---'.
    Sections are parsed into lists, and the title/theme is extracted.
    
    Args:
        file_path: Path to the weekly log file (str or Path object)
    
    Returns:
        list: List of dictionaries containing weekly data
    """
    # Convert to Path object if string is provided
    if not isinstance(file_path, Path):
        file_path = Path(file_path)
    content = file_path.read_text(encoding='utf-8')
    
    # Split the log into weeks using '---' as a separator
    raw_weeks = re.split(r'\n---\n', content)
    weeks_data = []
    
    for raw in raw_weeks:
        if not raw.strip():
            continue  # Skip empty sections
        
        # Parse the week title/date (e.g., '## Week of ...')
        title_match = re.search(r'## Week of (.+)', raw)
        if not title_match:
            continue  # Skip if no week header found
        date_range = title_match.group(1).strip()
        week_start_match = re.search(
            r'<!--\s*week-start:\s*([^\s]+)\s*-->', raw, re.IGNORECASE
        )
        week_start = (
            normalize_week_start(week_start_match.group(1))
            if week_start_match
            else None
        )
        
        # Parse the theme from the markdown heading line (e.g., '### 🎬 "..."')
        theme = "Weekly Update"
        theme_line_match = re.search(r'^###\s+(.+)$', raw, re.MULTILINE)
        if theme_line_match:
            theme_line = theme_line_match.group(1).strip()
            quoted_theme_match = re.search(r'[“"](.+?)[”"]', theme_line)
            theme = quoted_theme_match.group(1).strip() if quoted_theme_match else theme_line
        
        # Parse sections (e.g., **highlights**, **shipped**, etc.)
        sections = {}
        current_section = None
        for line in raw.split('\n'):
            line = line.strip()
            # Section header (e.g., '**highlights**')
            if line.startswith('**') and line.endswith('**'):
                current_section = line.strip('*').lower()
                sections[current_section] = []
            # Section item (e.g., '* Did something')
            elif line.startswith('* ') and current_section:
                item = line[2:].strip()
                sections[current_section].append(item)
        
        # Construct the week object for JSON
        week_obj = {
            "dateRange": date_range,
            "title": theme,
            "highlights": sections.get('highlights', []),
            "shipped": sections.get('shipped', []),
            "engineering": sections.get('engineering', []),
            "fixes": sections.get('fixes', []),
            "metrics": sections.get('metrics', []),
            "next": sections.get('next', [])
        }
        if week_start is not None:
            week_obj["weekStart"] = week_start
        weeks_data.append(week_obj)
    return weeks_data


def normalize_week_start(week_start):
    """Return a canonical ISO date key or reject an invalid nonempty key."""
    if week_start is None:
        return None

    if not isinstance(week_start, str):
        raise ValueError(
            f'Invalid generated weekStart {week_start!r}; expected YYYY-MM-DD'
        )

    normalized_week_start = week_start.strip()
    if not normalized_week_start:
        return None

    if not DATE_KEY_PATTERN.fullmatch(normalized_week_start):
        raise ValueError(
            f'Invalid generated weekStart {week_start!r}; expected YYYY-MM-DD'
        )

    try:
        date.fromisoformat(normalized_week_start)
    except ValueError as error:
        raise ValueError(
            f'Invalid generated weekStart {week_start!r}; expected YYYY-MM-DD'
        ) from error

    return normalized_week_start


def load_generated_entries(file_paths):
    """Load canonical generated entries while tolerating a broken sibling alias."""
    entries_by_week_start = {}
    unusable_aliases = []
    found_existing_alias = False
    found_usable_alias = False

    for file_path in file_paths:
        file_path = Path(file_path)
        if not file_path.exists():
            continue

        found_existing_alias = True
        try:
            existing_entries = json.loads(file_path.read_text(encoding='utf-8'))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            unusable_aliases.append(f'{file_path}: malformed JSON')
            continue

        if not isinstance(existing_entries, list):
            unusable_aliases.append(f'{file_path}: expected a JSON list')
            continue

        found_usable_alias = True

        for entry in existing_entries:
            if not isinstance(entry, dict):
                continue
            try:
                week_start = normalize_week_start(entry.get('weekStart'))
            except ValueError as error:
                raise ValueError(f'{file_path}: {error}') from error

            if week_start is None:
                continue

            # Prefer the primary history file when aliases disagree, while
            # retaining unique generated weeks present only in an alias.
            normalized_entry = entry.copy()
            normalized_entry['weekStart'] = week_start
            entries_by_week_start.setdefault(week_start, normalized_entry)

    if found_existing_alias and not found_usable_alias:
        details = '; '.join(unusable_aliases)
        raise ValueError(
            'No usable weekly-entry list found in existing aliases: '
            f'{details}'
        )

    # Generated editions use ISO date keys, so lexical ordering is chronological.
    return [entries_by_week_start[week_start] for week_start in sorted(entries_by_week_start)]


def regenerate_weekly_log(log_path, output_path, compatibility_path):
    """Rebuild legacy entries and retain generated weekly editions."""
    legacy_entries = parse_weekly_log(log_path)
    generated_entries = load_generated_entries((output_path, compatibility_path))
    generated_week_starts = {
        entry['weekStart'] for entry in generated_entries if entry.get('weekStart')
    }
    entries = [
        entry for entry in legacy_entries
        if entry.get('weekStart') not in generated_week_starts
    ] + generated_entries
    payload = json.dumps(entries, indent=2, ensure_ascii=False) + '\n'

    Path(output_path).write_text(payload, encoding='utf-8')
    Path(compatibility_path).write_text(payload, encoding='utf-8')
    return entries


# Run parser and write output JSON
if __name__ == '__main__':
    try:
        # Get the script's directory to find relative paths
        script_dir = Path(__file__).parent.absolute()
        log_path = script_dir / 'WeeklyLog.txt'
        output_path = script_dir / 'data' / 'weekly-history.json'
        compatibility_path = script_dir / 'data' / 'weekly-log.json'
        
        data = regenerate_weekly_log(log_path, output_path, compatibility_path)
        print(f"✅ Successfully parsed {len(data)} weeks to {output_path} and {compatibility_path}")
    except Exception as e:
        print(f"❌ Error: {e}")
        raise SystemExit(1)
