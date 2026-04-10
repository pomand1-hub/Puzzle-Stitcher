# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### 퍼즐 게임 (`artifacts/puzzle-game`)
- **Type**: React + Vite web app
- **Preview path**: `/`
- **Description**: 이미지 업로드 기반 퍼즐 게임
- **Features**:
  - 이미지 업로드 (드래그&드롭 또는 클릭)
  - 4/6/9/12/16/20/25/30 조각 선택
  - 자동으로 퍼즐 그리드 계산 (16:9 비율 최적화)
  - 퍼즐 조각 드래그&드롭
  - 스냅 기능 — 조각이 정확한 위치에 가까우면 자동 맞춤
  - 맞춤 시 스티칭 점선 + 보라색 글로우 애니메이션
  - 상단 목표 이미지 표시
  - 진행 상황 표시 (완성된 조각 수 / 전체)
  - 완성 시 축하 팝업
- **Key files**:
  - `src/pages/PuzzleGame.tsx` — 메인 게임 화면
  - `src/components/PuzzleBoard.tsx` — 보드 + 드래그 로직
  - `src/components/PuzzlePieceCanvas.tsx` — 개별 퍼즐 조각 (Canvas API)
  - `src/lib/puzzleUtils.ts` — 퍼즐 생성 유틸리티, 탭 경로 계산, 스냅 판정
