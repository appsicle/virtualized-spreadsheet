# Claude AI Assistant Guidelines for Spreadsheet Project

## Quick Reference

This document provides guidelines for AI assistants (like Claude) working on this spreadsheet application. Always reference `agents.md` for detailed architecture information.

## Critical Rules

### 1. Import Paths - ALWAYS Use @ Alias for Cross-Module

**✅ CORRECT:**
```typescript
import { useSheetState } from '@/state/hooks'
import { SheetProvider } from '@/state/store'
import Grid from '@/components/Grid'
import { indexToCol } from '@/state/utils/refs'
```

**❌ WRONG:**
```typescript
import { useSheetState } from '../../state/hooks'
import Grid from './components/Grid/Grid'
```

**Exception:** Use relative imports ONLY within the same module:
```typescript
// Within state/utils/ files
import { addressToA1 } from './refs'  // ✅ OK
import type { AST } from '../types'   // ✅ OK
```

### 2. File Organization

- **state/** - Keep formula engine utilities together, use relative imports
  - `store.tsx` - **ONLY exports SheetProvider component** (React Fast Refresh)
  - `hooks.ts` - **ONLY exports hooks** (useSheetState, useSheetActions)
  - `context.ts` - **ONLY exports contexts** and related types
  - `types.ts` - Domain types (A1, Cells, Value, etc.)
- **components/** - Each component in its own folder with barrel export (index.ts)

**React Fast Refresh Rule**: Files that export components should ONLY export components. Mixing component exports with hooks/utilities breaks Fast Refresh.

### 3. Barrel Exports

Always import from barrel exports when available:
```typescript
import Grid from '@/components/Grid'           // ✅ Uses index.ts
import { Cell } from '@/components/Grid/Cell'  // ✅ Uses index.ts
```

### 4. Type Safety

- All types are in `@/state/types.ts`
- Import types with `import type { ... }` when possible
- Never use `any` - use proper types

## Common Tasks

### Adding a New Component

1. Create directory: `src/components/NewComponent/`
2. Create component: `NewComponent.tsx`
3. Create barrel export: `index.ts`
   ```typescript
   export { default } from './NewComponent'
   ```
4. Import using: `import NewComponent from '@/components/NewComponent'`

### Adding a New Hook

1. Place in appropriate component's `hooks/` directory
2. Name with `use` prefix: `useFeatureName.ts`
3. Export as named export:
   ```typescript
   export function useFeatureName() { ... }
   ```
4. Import using @ alias:
   ```typescript
   import { useFeatureName } from '@/components/Grid/Cell/hooks/useFeatureName'
   ```

### Adding New State/Utils Function

1. Add to existing file in `state/utils/` or create new file
2. Use relative imports within `state/utils/`
3. Export function:
   ```typescript
   export function newUtilFunction() { ... }
   ```
4. Import from components using @ alias:
   ```typescript
   import { newUtilFunction } from '@/state/utils/filename'
   ```

### Adding New Types

1. Always add to `src/state/types.ts`
2. Export as type:
   ```typescript
   export type NewType = { ... }
   export interface NewInterface { ... }
   ```
3. Import using:
   ```typescript
   import type { NewType } from '@/state/types'
   ```

## Refactoring Guidelines

### When Moving Files

1. Update the file's own imports (if needed)
2. Update all files that import it
3. Update barrel exports (index.ts)
4. Test with `npm run build`

### When Renaming Types

1. Update in `types.ts`
2. Search and replace across codebase
3. Check imports and usages

## Code Style

### React Hooks
- Use functional components
- Extract complex logic into custom hooks
- Keep hooks in component-specific `hooks/` folders

### State Management
- All state goes through `SheetProvider` from `@/state/store`
- Use `useSheetState()` from `@/state/hooks` to read state
- Use `useSheetActions()` from `@/state/hooks` to modify state
- Never mutate state directly
- **Separation**: Provider in `store.tsx`, hooks in `hooks.ts` (React Fast Refresh compliance)

### Formula Engine
- Parser → AST → Evaluator → DependencyGraph
- All formula logic in `state/utils/`
- Keep pure functions separate from React

## Testing Checklist

After making changes:

1. [ ] Check TypeScript errors: `tsc -b`
2. [ ] Run build: `npm run build`
3. [ ] Test in dev: `npm run dev`
4. [ ] Verify all imports use @ alias correctly
5. [ ] Check for circular dependencies
6. [ ] Test affected features in browser

## Known Issues

### Pre-existing TypeScript Errors
The following errors exist in the codebase and are not blocking:
- `CellEditor.tsx` - ref type mismatch (line 25)
- `Grid.tsx` - ref type with null (line 18)
- `Grid.tsx` - missing 'selected' prop type (line 98)

These can be fixed but are lower priority.

## AI Assistant Best Practices

### When Asked to Add Features

1. **Plan first** - Identify which files need changes
2. **Check imports** - Always use @ alias for cross-module
3. **Update types** - Add new types to `types.ts`
4. **Test incrementally** - Run build after major changes
5. **Document** - Update this file if adding new patterns

### When Asked to Refactor

1. **Read agents.md** - Understand current structure
2. **Map dependencies** - Know what imports what
3. **Preserve conventions** - Keep @ alias usage consistent
4. **Update barrel exports** - Don't break existing imports
5. **Verify** - Run build to catch import errors

### When Asked to Debug

1. **Check imports first** - Most errors are import-related
2. **Verify types** - Check `types.ts` for correct definitions
3. **Trace state flow** - store.tsx → components
4. **Check formula engine** - If calculation errors, check utils/

## Quick Commands

```bash
# Development
npm run dev

# Type check only
tsc -b

# Build (type check + bundle)
npm run build

# Lint
npm run lint

# Search for TODO/FIXME
grep -r "TODO\|FIXME" src/
```

## Important Files Reference

| File | Purpose |
|------|---------|
| `state/store.tsx` | SheetProvider component only (React Fast Refresh compliant) |
| `state/context.ts` | Context definitions and types (SheetState, Actions) |
| `state/hooks.ts` | Custom hooks (useSheetState, useSheetActions) |
| `state/types.ts` | Domain TypeScript types |
| `state/utils/parser.ts` | Formula parsing |
| `state/utils/evaluator.ts` | Formula evaluation |
| `components/Grid/Grid.tsx` | Main spreadsheet UI |
| `components/Grid/Cell/Cell.tsx` | Individual cell rendering |
| `vite.config.ts` | Build config, @ alias definition |
| `tsconfig.app.json` | TypeScript path mapping |

## Common Patterns

### Accessing Cell Data
```typescript
import { useSheetState } from '@/state/hooks'

const { cells } = useSheetState()
const cell = cells.get('A1')  // CellData | undefined
const input = cell?.input     // string
const value = cell?.value     // Value (number | string | ErrorCode | undefined)
```

### Modifying Cells
```typescript
import { useSheetActions } from '@/state/hooks'

const { setCellInput } = useSheetActions()
setCellInput('A1', '=SUM(B1:B10)')  // Triggers re-evaluation
```

### Working with A1 Notation
```typescript
import { a1ToAddress, addressToA1, indexToCol, colToIndex } from '@/state/utils/refs'

const addr = a1ToAddress('B5')    // { row: 4, col: 1 }
const a1 = addressToA1(addr)      // 'B5'
const col = indexToCol(0)         // 'A'
const idx = colToIndex('B')       // 1
```

## Resources

- [React Hooks Documentation](https://react.dev/reference/react)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- Project architecture: See `agents.md`
