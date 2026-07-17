
# Script to parse the weekly log text file and output structured JSON
import re
import json
from pathlib import Path


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
        weeks_data.append(week_obj)
    return weeks_data


# Run parser and write output JSON
if __name__ == '__main__':
    try:
        # Get the script's directory to find relative paths
        script_dir = Path(__file__).parent.absolute()
        log_path = script_dir / 'WeeklyLog.txt'
        output_path = script_dir / 'data' / 'weekly-history.json'
        compatibility_path = script_dir / 'data' / 'weekly-log.json'
        
        data = parse_weekly_log(log_path)
        payload = json.dumps(data, indent=2)
        output_path.write_text(payload, encoding='utf-8')
        compatibility_path.write_text(payload, encoding='utf-8')
        print(f"✅ Successfully parsed {len(data)} weeks to {output_path} and {compatibility_path}")
    except Exception as e:
        print(f"❌ Error: {e}")
