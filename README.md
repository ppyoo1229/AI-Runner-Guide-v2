# Project Build Guide

## Tech Stack

This project is built using the following technologies:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Prerequisites

Make sure your system has Node.js and npm installed.

We recommend using nvm to install Node.js: [nvm Installation Guide](https://github.com/nvm-sh/nvm#installing-and-updating)

## Install Dependencies

```sh
npm install
```

## Development Server

Start the development server with hot reload and instant preview:

```sh
npm run dev
```

## Build Project

Build for production:

```sh
npm run build
```

## Preview Build

Preview the built project:

```sh
npm run preview
```

## Deploy

이 프로젝트는 Git을 통해 자동으로 빌드하고 배포할 수 있습니다.

### 빠른 배포 (Vercel 추천)

1. [Vercel](https://vercel.com)에 가입/로그인
2. GitHub 저장소 연결
3. 자동으로 배포 설정이 감지됩니다
4. `main` 브랜치에 푸시하면 자동 배포됩니다

자세한 배포 방법은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

## Project Structure

```
src/
├── components/     # UI Components
├── pages/         # Page Components
├── hooks/         # Custom Hooks
├── lib/           # Utility Library
└── main.tsx       # Application Entry Point
```
