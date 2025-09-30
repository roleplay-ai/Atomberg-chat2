## Company Assistant - Next.js Full-Stack Application

A complete company assistant built with Next.js 14, TypeScript, and OpenAI's Assistants API. This is a full-stack application that automatically loads company information and acts as a knowledgeable company representative - no separate backend server needed!

## Features

- 🤖 **Modern UI**: Built with Next.js 14 and TypeScript
- 💬 **Real-time Chat**: Interactive chat interface with typing indicators
- 📄 **Automatic Knowledge Loading**: Automatically loads company information on startup
- 🎨 **Beautiful Design**: Gradient backgrounds and smooth animations
- 📱 **Responsive**: Works perfectly on desktop and mobile
- ⚡ **Fast**: Server-side rendering with Next.js
- 🔧 **Full-Stack**: Integrated API routes - no separate backend needed!

## Prerequisites

- Node.js (v18 or higher)
- OpenAI API Key

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
node setup-env.js
```

This will create a `.env.local` file. Edit it and add your OpenAI API key:

```bash
OPENAI_API_KEY=your_actual_api_key_here
```

### 3. Add Company Information

Place your company information PDF file named `Knowledge Base.pdf` in the `public/` directory. This file will be automatically loaded when the application starts.

### 4. Start the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## API Routes

The application includes the following API routes:
- `GET /api/init` - Initialize the system and automatically load company information
- `POST /api/chat` - Send chat messages with company information search
- `GET /api/health` - Check system status

## Project Structure

```
nextjs-frontend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── init/route.ts        # Initialize system and load company info
│   │   │   ├── chat/route.ts        # Chat endpoint
│   │   │   └── health/route.ts      # Health check
│   │   ├── globals.css              # Global styles
│   │   ├── layout.tsx               # Root layout
│   │   └── page.tsx                 # Main chat page
│   └── lib/
│       └── vectorStore.ts           # Shared state management
├── public/
│   └── Knowledge Base.pdf           # Your company information file
├── next.config.js                   # Next.js configuration
├── package.json                     # Dependencies
├── setup-env.js                     # Environment setup script
└── tsconfig.json                   # TypeScript configuration
```

## Features

### Chat Interface
- Real-time messaging with smooth animations
- Typing indicators and loading states
- Message timestamps
- Auto-scroll to latest messages

### Knowledge Base Integration
- One-click knowledge base loading
- Semantic search through uploaded documents
- Error handling and user feedback

### Modern UI/UX
- Gradient design with glassmorphism effects
- Responsive layout for all devices
- Smooth animations and transitions
- Professional chat bubble design

## API Integration

The frontend communicates with the backend through the following API calls:

- **Initialize**: `GET /api/init`
- **Upload**: `POST /api/upload`
- **Chat**: `POST /api/chat`

The `next.config.js` file includes a rewrite rule to proxy API calls to the backend server.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Customization

You can customize the chatbot by modifying:

- **Styles**: Edit `src/app/globals.css`
- **Components**: Modify `src/app/page.tsx`
- **API Endpoints**: Update `next.config.js`

## Deployment

To deploy the Next.js application:

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm run start
   ```

Or deploy to platforms like Vercel, Netlify, or any hosting service that supports Next.js.

## Troubleshooting

### Common Issues

1. **Cannot connect to backend**: Make sure the backend server is running on port 5000
2. **API errors**: Check that the OpenAI API key is configured in the backend
3. **Build errors**: Ensure all dependencies are installed with `npm install`

### Development Tips

- The app uses TypeScript for better development experience
- All API calls are proxied through Next.js to avoid CORS issues
- The chat interface automatically handles loading states and errors
- Messages are stored in React state and persist during the session

## License

MIT License - feel free to use this project for your own purposes.
