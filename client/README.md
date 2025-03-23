# React Client App

This is a React application built with Vite for a store project.

## Getting Started

These instructions will help you set up and run the project on your local machine.

### Prerequisites

- Node.js and npm (or bun) - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Environment Setup

1. Create a `.env.development` file in the root directory:
   ```
   # Copy from .env.example and update the server URL
   ```

2. Update the server URL in your `.env.development` file to point to your backend service.

### Installation and Running

```sh
# Step 1: Clone the repository
git clone <YOUR_REPOSITORY_URL>

# Step 2: Navigate to the client directory
cd <PROJECT_PATH>/client

# Step 3: Install dependencies
npm install
# or if using bun
bun install

# Step 4: Start the development server
npm run dev
# or with bun
bun run dev
```

## Project Structure

This client application follows a standard React/Vite project structure:

- `src/` - Contains all the source code
  - `components/` - Reusable UI components
  - `context/` - React contexts for state management
  - `data/` - Static data files
  - `hooks/` - Custom React hooks
  - `lib/` - Utility functions and libraries
  - `pages/` - Page components

## Technologies

This project is built with:

- [Vite](https://vitejs.dev/) - Fast development environment
- [React](https://reactjs.org/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - UI component library

## Initial project setup

The initial version was made in Lovable.

**URL**: https://lovable.dev/projects/40b38a3c-520a-40f3-b381-c7d2016b412a
