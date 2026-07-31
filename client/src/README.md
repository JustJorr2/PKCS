# Frontend Project Structure

## 📁 Folder Organization

```
src/
├── pages/                    # Page components for different roles
│   ├── LoginPage.js         # Login and registration page
│   ├── SupervisorDashboard.js  # Supervisor dashboard
│   ├── AdminDashboard.js    # (Coming soon) Admin dashboard
│   └── WorkerDashboard.js   # (Coming soon) Worker dashboard
│
├── components/              # Reusable UI components
│   └── common/              # Common components used across the app
│       └── Header.js        # (Future) Navigation header
│
├── services/                # API calls and backend communication
│   └── api.js              # All API endpoints and services
│
├── styles/                  # CSS files
│   ├── App.css             # Global app styles
│   ├── Login.css           # Login page styles
│   └── SupervisorDashboard.css # Supervisor dashboard styles
│
├── config/                  # Configuration files
│   └── config.js           # App configuration and constants
│
├── utils/                   # Helper functions and utilities
│   └── helpers.js          # Rating helpers, formatting, etc.
│
└── index.js                 # App entry point
```

## 🔧 Key Features by Folder

### `/pages` - Page Components
- **LoginPage.js**: Handles user authentication (login/register)
- **SupervisorDashboard.js**: Displays worker overview and ratings analytics
- Future pages for Admin and Worker dashboards

### `/services` - API Integration
- Centralized API calls using axios
- Services organized by feature:
  - `authService` - Login and registration
  - `usersService` - User management
  - `managerService` - Supervisor-specific endpoints
  - `ratingsService` - Rating management

### `/styles` - Styling
- One CSS file per major component
- Responsive design patterns
- Color scheme: Purple gradient (#1a3a7f to #764ba2)

### `/utils` - Helper Functions
- `getRatingColor()` - Convert rating to color
- `getRatingStatus()` - Convert rating to status text
- `formatDate()` - Format dates
- `calculateAverage()` - Calculate average ratings

### `/config` - Configuration
- API base URL setup
- Environment variables
- App constants

## 🚀 Adding New Features

### Add a New Page
1. Create file in `/pages/` folder
2. Style it with a new CSS file in `/styles/`
3. Import in `App.js` and add routing logic

### Add a New Component
1. Create folder in `/components/` (e.g., `/components/workers/`)
2. Add component file and CSS file
3. Import and use in pages

### Add New API Endpoints
1. Update `/services/api.js` with new endpoint calls
2. Use existing service patterns (authService, managerService, etc.)

## 📦 Dependencies
- React 19.2.4
- Axios 1.13.6 (for API calls)
- React Router DOM 7.13.1 (for routing)

## 🎨 Styling Guidelines
- Use CSS variables for colors
- Follow mobile-first responsive design
- Use class names with kebab-case
- Keep styles scoped to component CSS files
