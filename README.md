# Karrot 🥕

Interactive quiz platform built with Next.js and WebRTC P2P - no backend required!

## Features

✨ **Real-time Interaction** - Participants see questions and submit answers instantly  
🔒 **No Backend** - Uses WebRTC peer-to-peer connections  
📱 **Responsive Design** - Works on desktop, tablet, and mobile  
🎨 **Minimalist UI** - Inspired by Mentimeter  
📊 **Live Results** - See responses as they come in  
💾 **JSON-based** - Easy quiz creation and portability  
⬇️ **Export Results** - Download session data as JSON  

## Question Types

- **Multiple Choice** - Traditional quiz questions with options
- **Word Cloud** - Collect single-word responses
- **Open Ended** - Free-form text responses

## Getting Started

### Installation

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

### For Presenters (Hosts)

1. Click **"Create Quiz"** on the home page
2. Upload a JSON quiz file or download the template
3. Click **"Start Quiz Session"**
4. Share the generated **6-digit room code** with participants
5. Control quiz flow with Next/Previous buttons
6. View real-time responses and statistics
7. Download results when finished

### For Participants

1. Enter the **room code** on the home page
2. Enter your name
3. Wait for the host to start
4. Answer questions as they appear
5. See confirmation when your answer is submitted

## Quiz JSON Format

Create a JSON file with the following structure:

```json
{
  "title": "My Quiz",
  "description": "Optional description",
  "questions": [
    {
      "id": "unique-id",
      "type": "multiple-choice",
      "question": "Your question here?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": 0,
      "timeLimit": 30
    },
    {
      "id": "unique-id-2",
      "type": "word-cloud",
      "question": "Describe in one word",
      "timeLimit": 20
    },
    {
      "id": "unique-id-3",
      "type": "open-ended",
      "question": "What do you think?",
      "timeLimit": 45
    }
  ]
}
```

### Field Descriptions

- `title` (required): Quiz title
- `description` (optional): Brief description
- `questions` (required): Array of question objects
  - `id` (required): Unique identifier
  - `type` (required): `"multiple-choice"`, `"word-cloud"`, or `"open-ended"`
  - `question` (required): The question text
  - `options` (required for multiple-choice): Array of answer options
  - `correctAnswer` (optional): Index of correct answer (for multiple-choice)
  - `timeLimit` (optional): Time limit in seconds

## Example Quiz

See [example-quiz.json](./example-quiz.json) for a complete example.

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **PeerJS** - WebRTC abstraction for P2P connections
- **Biome** - Linting and formatting

## Architecture

Karrot uses WebRTC peer-to-peer connections:

1. **Host** creates a PeerJS instance with the room code as ID
2. **Participants** connect directly to the host's peer ID
3. **No central server** needed for data transmission
4. All quiz data and answers flow directly between peers

### Limitations

- Works best with **10-15 participants** (WebRTC P2P limitation)
- Host must keep their browser open during the session
- Participants need modern browsers with WebRTC support

## Deployment

Deploy to Netlify, Vercel, or any static hosting platform:

```bash
npm run build
```

The app is fully client-side and requires no server configuration.

## Future Enhancements

- [ ] Timer display for participants
- [ ] Leaderboard for competitive quizzes
- [ ] More question types (ranking, rating scales)
- [ ] Quiz templates library
- [ ] Session recording/replay
- [ ] Mobile app

## License

MIT

---

Built with ❤️ using Next.js and WebRTC
