# open-higgsfield Analysis for FramePilot

## Repository Overview

**Repository**: wide-trace/open-higgsfield (https://github.com/wide-trace/open-higgsfield)
**License**: No explicit LICENSE file found in repository. The README mentions "MIT licensed" in fork descriptions but the main repo lacks a license file.
**Tech Stack**: Next.js 16 App Router, React 19, TypeScript, Zustand, plain CSS, pnpm, Vercel Blob

## Architecture Summary

### Core Concepts
1. **Single-page studio** - Full viewport app at `src/app/page.tsx` with `openhiggsfield-app.tsx` as main component
2. **Model catalog as source of truth** - `src/generation/catalog/` defines all models declaratively
3. **Server actions only** - Browser never talks to generation API directly (`src/generation/actions.ts`)
4. **Zustand stores** - 5 small shared stores (active, prompt, settings, media, browser-storage)
5. **Vercel Blob uploads** - Client-direct uploads via `/api/blob` route with scoped tokens
6. **Polling-based async** - 4s interval, 10-minute deadline, batched status requests

### Key Files & Patterns

| File | Purpose |
|------|---------|
| `src/generation/catalog/types.ts` | Core types: ModelEntry, Surface, MediaRole, SettingField, GenerationPlane |
| `src/generation/catalog/index.ts` | Model registry with 38 models, getModel() lookup |
| `src/generation/to-platform.ts` | Maps GenerationPlane → platform-specific request bodies |
| `src/generation/platform.ts` | Platform client: submit(), status(), error handling |
| `src/generation/actions.ts` | Server actions: submitGeneration(), getGenerationStatuses() |
| `src/generation/poll.ts` | Client-side polling manager with deduplication |
| `src/generation/credentials.ts` | API key storage in httpOnly cookie (id:secret format) |
| `src/openhiggsfield/composer.tsx` | Central creation UI: prompt, media, settings, generate |
| `src/openhiggsfield/gallery.tsx` | Masonry grid with virtualization, selection, actions |
| `src/openhiggsfield/model-picker.tsx` | Searchable model selector with descriptions |
| `src/openhiggsfield/settings.tsx` | Dynamic settings UI from catalog (enum/range/boolean) |
| `src/openhiggsfield/data.ts` | Shared constants, helpers, model descriptions |

### Model Catalog System
Each model declares:
- `id`, `surface` (image/video), `label`
- `roles`: Partial<Record<MediaRole, number>> (e.g., `{start: 1, reference: 4}`)
- `settings`: Record<string, SettingField> (enum/range/boolean)
- `paths?`: PlatformPaths for generic mapping

Settings are rendered dynamically - no hardcoded per-model UI.

### Generation Flow
```
User submits → assemblePlane() → toPlatform() → submitGeneration() (server action)
  → Platform API → requestId → runningRows() in gallery
  → watchRequest() polls every 4s via getGenerationStatuses()
  → terminal status → terminalRows() → save to IndexedDB history
```

### Security Model
- API key stored in httpOnly cookie (never exposed to browser)
- Server actions are only callers of platform API
- Vercel Blob uploads use scoped tokens
- No multi-user auth (single-device IndexedDB persistence)

## Reusability Assessment

### ✅ Can Adapt (MIT-style patterns, architecture)
- Model catalog schema & dynamic settings rendering
- GenerationPlane → platform mapping pattern
- Polling manager with deduplication
- Composer/gallery/component architecture
- Virtualized masonry grid
- Asset picker with history integration
- Settings popover system (enum/range/boolean)
- Model picker with search & descriptions

### ⚠️ Must Rewrite for FramePilot
- **No user authentication** - Single device, IndexedDB only
- **No database** - All history in browser IndexedDB (60 record cap)
- **No project/brand/template system**
- **No cost estimation/tracking**
- **No secure storage** - Uses platform CDN URLs directly
- **No server-side persistence** - No Supabase/PostgreSQL
- **Cookie-based auth only** - No Supabase Auth
- **Vercel Blob specific** - Need abstraction for Supabase Storage

### ❌ Cannot Directly Copy (Architecture mismatch)
- Entire persistence layer (IndexedDB → PostgreSQL)
- Auth system (cookie → Supabase Auth)
- File storage (Vercel Blob → Supabase Storage)
- Single-user → Multi-user data isolation
- Client-only polling → Server-side webhooks + client polling

## Legal Note
The repository lacks an explicit LICENSE file. While forks claim MIT, the main repo has no license. **Do not directly copy source code**. Instead, reimplement patterns and architecture inspired by the functionality.