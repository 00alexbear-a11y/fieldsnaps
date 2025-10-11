# PhotoPWA - Professional Photo Management

A mobile-first Progressive Web App (PWA) for professional photo management with world-class annotation tools. Built to compete with CompanyCam, focusing on construction, inspection, and field documentation workflows.

## Features

✨ **Photo Management**
- Project-based organization
- Mobile camera capture support
- Touch-optimized photo grid
- Cloud storage ready (currently using blob URLs)

🎨 **Professional Annotation Tools**
- **Text Tool**: Inline editing with semi-transparent backgrounds
- **Arrow Tool**: Proportional arrowheads with 1.5x thick shafts
- **Line Tool**: Straight line annotations
- **Circle Tool**: Radius-based circular annotations
- **Pen Tool**: Freestyle freehand drawing with smooth path recording
- All tools use HTML5 Canvas API for consistent performance
- Full mobile touch support (touchstart/touchmove/touchend)
- Drag-to-move and resize handles with visual feedback
- Unified blue circular endpoints for all annotation types

💬 **Collaboration**
- Photo comments system
- @mention support with autocomplete
- Real-time updates via TanStack Query

📱 **Progressive Web App**
- Installable on mobile devices
- Offline support via service workers
- Mobile-first responsive design
- Touch-optimized controls

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Wouter (routing)
- TanStack Query (server state)
- Tailwind CSS + shadcn/ui
- Lucide React (icons)

**Backend:**
- Express.js + TypeScript
- Drizzle ORM
- PostgreSQL (Neon)
- RESTful API

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database (Neon recommended)

### Setup Instructions

1. **Copy this folder to your new Replit project**
   ```bash
   # In your new Replit, delete the default files and copy this entire folder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file (or use Replit Secrets):
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/database
   ```

4. **Initialize database**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Access the app**
   - Development: `http://localhost:5000`
   - Mobile testing: Use your Replit webview URL

## Project Structure

```
photo-app/
├── client/              # Frontend React app
│   ├── src/
│   │   ├── components/  # UI components
│   │   │   ├── ui/      # shadcn components
│   │   │   └── PhotoAnnotationEditor.tsx
│   │   ├── pages/       # Route pages
│   │   ├── lib/         # Utilities
│   │   └── hooks/       # React hooks
│   ├── index.html
│   └── src/main.tsx
├── server/              # Backend Express app
│   ├── index.ts         # Server entry
│   ├── routes.ts        # API routes
│   ├── storage.ts       # Data layer
│   └── db.ts            # Database connection
├── shared/
│   └── schema.ts        # Shared types & schemas
├── public/
│   ├── manifest.json    # PWA manifest
│   └── sw.js            # Service worker
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create new project

### Photos
- `GET /api/projects/:projectId/photos` - List project photos
- `POST /api/projects/:projectId/photos` - Upload photo
- `DELETE /api/photos/:id` - Delete photo

### Annotations
- `GET /api/photos/:photoId/annotations` - Get photo annotations
- `POST /api/photos/:photoId/annotations` - Create annotation
- `DELETE /api/annotations/:id` - Delete annotation

### Comments
- `GET /api/photos/:photoId/comments` - Get photo comments
- `POST /api/photos/:photoId/comments` - Create comment

## Mobile Testing

1. **Install as PWA on mobile:**
   - iOS: Safari → Share → Add to Home Screen
   - Android: Chrome → Menu → Add to Home Screen

2. **Test camera capture:**
   - The "Add Photo" button uses `capture="environment"` to open the camera directly on mobile

3. **Test touch annotations:**
   - All annotation tools support touch events
   - Drag annotations to move
   - Use endpoints to resize

## Database Schema

### Tables
- **projects**: Project organization
- **photos**: Photo storage (URLs)
- **photoAnnotations**: Canvas-based annotations
- **comments**: Photo comments with mentions

All tables use UUID primary keys and proper foreign key relationships with cascade delete.

## Next Steps / Roadmap

### High Priority
1. **Cloud Storage Integration**
   - Replace blob URLs with Replit Object Storage
   - Add Google Drive sync (optional)
   - Implement proper file upload with FormData

2. **PWA Enhancements**
   - Add offline photo queue
   - Implement background sync
   - Add push notifications

3. **Annotation Improvements**
   - Add undo/redo functionality
   - Implement annotation history
   - Add shape rotation

### Future Features
- Multi-user collaboration
- Photo comparison slider
- Time-lapse generation
- PDF report export
- Custom templates
- Team management

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Push database schema
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## Troubleshooting

**Database connection fails:**
- Check DATABASE_URL is set correctly
- Ensure your PostgreSQL database is accessible
- Run `npm run db:push` to sync schema

**Photos not uploading:**
- Current implementation uses blob URLs (temporary)
- Implement cloud storage for production use
- Check browser console for errors

**Touch controls not working:**
- Ensure you're testing on actual mobile device or using browser mobile emulation
- Check that touch events are not being blocked by parent elements

## Contributing

This is a standalone extraction from BuildFlow. Feel free to:
- Add new features
- Improve annotation tools
- Enhance mobile UX
- Add cloud storage integrations

## License

MIT - Built for construction and field documentation workflows
