# Hoops Clips - Web Version

Basketball video editor for capturing, reviewing, styling, and exporting game clips with optional AI highlight detection.

## Features

- **Video Player**: Load and play basketball game videos
- **Manual Clip Marking**: Mark in/out points to create clips manually
- **Optional AI Highlight Detection**: Send an explicitly entered public video URL to the configured backend, with a simulated demo fallback
- **Review System**: Tag clips as Keep/Discard with team assignments (Team A/B)
- **Clip Styles**: Apply visual styles to clips (Classic, Vibrant, Neon, Highlight)
- **Export Formats**: Export clip metadata as JSON, CSV, or EDL (Edit Decision List)
- **Local Browser Storage**: Clip metadata and settings persist in the browser's localStorage

## Tech Stack

- **Pure HTML5, CSS3, JavaScript**: No external dependencies
- **LocalStorage API**: Client-side data persistence
- **HTML5 Video API**: Video playback and control
- **Dark Theme**: Purple accent (#7C5CFF) on dark background

## Usage

1. **Load Video**: Click "Load Video" in the Player tab and select a basketball game video
2. **Mark Clips**: 
   - Play video and click "Mark In" at the start of a play
   - Click "Mark Out" at the end
   - Click "Add Clip" to save
3. **AI Detection**: Enter a public video URL and click "AI Detect" to use the configured backend. Without a public URL or available backend, the page uses a simulated demo result.
4. **Review**: Switch to Review tab to tag clips as Keep/Discard and assign teams
5. **Export**: Go to Export tab and download clips metadata in your preferred format

## Settings

- **AI Worker**: Managed by the site's public configuration
- **Clip Padding**: Set extra seconds before/after clips
- **Dark Mode**: Toggle dark/light theme
- **Clear Storage**: Reset all data

## File Structure

```
apps/hoopsclips/
├── index.html          # Main browser demo
├── privacy.html        # HoopClips product privacy policy
├── terms.html          # HoopClips terms of use
├── support.html        # HoopClips support page
├── css/
│   ├── styles.css      # Browser demo styles
│   └── legal.css       # Product policy and support refinements
├── js/
│   ├── app.js          # Main app and tab navigation
│   ├── store.js        # State management with localStorage
│   ├── player.js       # Video player and clip marking
│   ├── review.js       # Review and tagging
│   └── export.js       # Export functionality
└── README.md           # This file
```

## Optional AI Worker

The public site configuration can provide an AI backend. Browser-selected files stay local for playback and manual clip work. The AI action sends only a public video URL that the user explicitly enters. If no public URL or backend is available, the page uses a clearly limited simulated result.

## Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- Requires HTML5 video support

## Data Storage

Clip metadata and settings are stored in the browser's localStorage. A locally selected video file is represented by a temporary browser object URL and is not uploaded by the current demo. A public video URL is sent to the configured backend only when the user starts AI detection. See [Privacy](privacy.html), [Terms](terms.html), and [Support](support.html).

## Known Limitations

- No actual video clip export (only metadata) - use EDL in professional video editing software
- AI detection requires a user-provided public video URL and an available configured backend; otherwise it uses a simulated demo result
- Video files must be browser-compatible formats (MP4, WebM)
- No cloud sync - data is local to browser

## Future Enhancements

- Real video clip extraction
- Cloud storage integration
- Collaborative review features
- Advanced AI models
- Mobile-optimized interface

---

**Built by Atrak Team**
