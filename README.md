# Attendance System

A React + Vite + Convex app for student attendance, teacher class management, BLE room beacons, and schedule/activity tracking.

## Overview

This repo includes:

- A student flow for onboarding and room check-in
- A teacher dashboard for attendance, classes, students, rooms, and movement
- Convex backend functions and schema for attendance, classes, schedules, locations, and settings
- BLE-based room beacon setup and student check-in support
- Groq-powered schedule/roster parsing helpers

## Tech Stack

- React 18
- Vite
- TypeScript
- Convex
- React Router
- Tailwind CSS

## Routes

- `#/` home page
- `#/student` student portal
- `#/onboarding` student onboarding
- `#/teacher` teacher dashboard
- `#/teacher/settings` teacher settings

The app uses `HashRouter`, so local URLs look like `http://localhost:5173/#/teacher`.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

Create `.env.local` from `.env.example` and make sure it includes:

```env
VITE_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOYMENT=your-deployment-name
VITE_CONVEX_SITE_URL=https://your-project.convex.site
```

Important:

- `VITE_CONVEX_URL` is required by the frontend
- `CONVEX_DEPLOYMENT` is used by local Convex commands
- `GROQ_API_KEY` should live in Convex env vars, not in the browser env file

Set the Groq key in Convex with:

```bash
npx convex env set GROQ_API_KEY=gsk_...
```


### 3. Start Convex

For local/dev deployment sync:

```bash
npx convex dev
```

For a one-time push to the configured dev deployment:

```bash
npx convex dev --once --env-file .env.local
```

### 4. Start the frontend

```bash
npm run dev
```

Then open:

- [http://localhost:5173/#/teacher](http://localhost:5173/#/teacher)
- [http://localhost:5173/#/student](http://localhost:5173/#/student)

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run convex:dev
npm run convex:deploy
```

## Build

To verify the frontend:

```bash
npm run build
```

## Deployment Notes

- `npx convex deploy` targets prod by default
- `npx convex dev --once --env-file .env.local` is the safer choice when you want to push backend changes to the configured dev deployment
- Make sure your frontend `VITE_CONVEX_URL` matches the deployment you expect to use

## Repo Structure

```text
src/
  components/
  hooks/
  pages/
convex/
  _generated/
  attendance.ts
  groq.ts
  locations.ts
  scheduleRotation.ts
  scheduledActivities.ts
  schedules.ts
  schema.ts
  students.ts
  teacherClasses.ts
  teachers.ts
```

## Notes

- Teacher login in this app is custom and stored in Convex
- Existing dev deployments may contain older documents, so schema changes should be made carefully
- BLE/Web Bluetooth support depends on browser support and permissions
