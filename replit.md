# Bailado Carioca - Dance School Management System

## Overview

This is a management system for a dance school (Bailado Carioca) built as a full-stack TypeScript application. The project uses a React frontend with shadcn/ui components, an Express.js backend, and PostgreSQL for data persistence via Drizzle ORM. The system handles student management, class scheduling, teacher registration, enrollment tracking, and financial operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state, with a centralized DataStore pattern using localStorage for offline-capable data
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Framework**: Express.js 5.x with TypeScript
- **API Design**: RESTful API with routes prefixed with `/api`
- **Server**: HTTP server created separately to support potential WebSocket upgrades
- **Static Serving**: Production serves built client assets from `dist/public`

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` - shared between client and server
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod`
- **Migrations**: Managed via `drizzle-kit push` command
- **Storage Interface**: Abstract `IStorage` interface in `server/storage.ts` allowing for different storage backends (currently in-memory, designed for PostgreSQL)

### Project Structure
```
├── client/           # Frontend React application
│   ├── src/          # React components, hooks, and pages
│   ├── index.html    # Entry HTML (also has legacy vanilla JS files)
│   └── *.js          # Legacy vanilla JS files (app.js, UI.js, style.css)
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data storage interface
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared code between client and server
│   └── schema.ts     # Drizzle database schema
└── migrations/       # Database migrations (generated)
```

### Development vs Production
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Client built to `dist/public`, server bundled with esbuild to `dist/index.cjs`

### Key Design Patterns
1. **Soft Delete**: Entities use `ativo`/`ativa` boolean or `status` field for soft deletion
2. **Shared Types**: Database schemas in `shared/` directory ensure type safety across stack
3. **Component Library**: Extensive shadcn/ui component library pre-configured with consistent styling

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **Drizzle ORM**: Database toolkit for TypeScript
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### UI Libraries
- **Radix UI**: Headless UI primitives (dialog, dropdown, tabs, etc.)
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant management
- **embla-carousel-react**: Carousel component
- **recharts**: Charting library
- **react-day-picker**: Date picker component
- **vaul**: Drawer component
- **cmdk**: Command palette component

### Form & Validation
- **react-hook-form**: Form state management
- **@hookform/resolvers**: Form validation resolvers
- **zod**: Schema validation

### Development Tools
- **Vite**: Build tool and dev server
- **esbuild**: Production bundler for server
- **TypeScript**: Type checking
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner