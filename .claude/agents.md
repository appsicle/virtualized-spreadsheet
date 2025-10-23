# Spreadsheet Application - Codebase Architecture

## Project Structure

```
spreadsheet/
├── src/
│   ├── state/               # State management & formula engine
│   │   ├── store.tsx        # SheetProvider component (React Fast Refresh compliant)
│   │   ├── context.ts       # Context definitions & types (SheetState, Actions)
│   │   ├── hooks.ts         # Custom hooks (useSheetState, useSheetActions)
│   │   ├── types.ts         # Domain TypeScript types & interfaces
│   │   └── utils/           # Formula engine utilities
│   │       ├── parser.ts    # Formula parser
│   │       ├── evaluator.ts # Formula evaluator
│   │       ├── tokenizer.ts # Lexical analysis
│   │       ├── ast.ts       # AST type re-exports
│   │       ├── refs.ts      # A1 notation converters
│   │       ├── ranges.ts    # Range expansion logic
│   │       ├── errors.ts    # Error constants
│   │       ├── dependencyGraph.ts  # Cell dependency tracking
│   │       └── rebase.ts    # Formula updates on row/col deletion
│   │
│   ├── components/          # React components
│   │   ├── Grid/
│   │   │   ├── Grid.tsx     # Main spreadsheet grid component
│   │   │   ├── index.ts     # Barrel export
│   │   │   └── Cell/
│   │   │       ├── Cell.tsx        # Individual cell component
│   │   │       ├── CellEditor.tsx  # Inline cell editor
│   │   │       ├── index.ts        # Barrel export
│   │   │       ├── hooks/          # React hooks for cell behavior
│   │   │       │   ├── useDragSelect.ts       # Drag to select cells
│   │   │       │   ├── useClipboard.ts        # Copy/paste support
│   │   │       │   └── useDoubleClickResize.ts # Double-click to expand editor
│   │   │       └── utils/
│   │   │           └── geometry.ts  # Coordinate calculations
│   │   │
│   │   ├── Toolbar/
│   │   │   ├── Toolbar.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── FormulaBar/
│   │   │   ├── FormulaBar.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── StatusBar/
│   │       ├── StatusBar.tsx
│   │       └── index.ts
│   │
│   ├── App.tsx              # Root application component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
│
├── vite.config.ts           # Vite configuration (with @ alias)
├── tsconfig.app.json        # TypeScript config (with path mapping)
├── tsconfig.json            # TypeScript project references
└── package.json
```

## Import Path Convention

### Using `@/` Path Alias

The project uses `@/` as an alias for the `src/` directory, configured in:
- `vite.config.ts` - For runtime resolution
- `tsconfig.app.json` - For TypeScript type checking

### Import Rules

1. **Cross-module imports** - Always use `@/` alias:
   ```typescript
   import { useSheetState } from '@/state/store'
   import Grid from '@/components/Grid'
   import { indexToCol } from '@/state/utils/refs'
   ```

2. **Same-module imports** - Use relative paths:
   ```typescript
   // Within state/utils/
   import { addressToA1 } from './refs'
   import type { AST } from '../types'
   ```

3. **Barrel exports** - Components use index.ts:
   ```typescript
   // Instead of: import Grid from '@/components/Grid/Grid'
   // Use:        import Grid from '@/components/Grid'
   ```

### Example Import Patterns

**In components:**
```typescript
// @/components/Grid/Cell/Cell.tsx
import { memo } from 'react'
import { useSheetActions } from '@/state/hooks'        // ✅ Cross-module
import { isError } from '@/state/utils/errors'         // ✅ Cross-module
```

**In hooks:**
```typescript
// @/components/Grid/Cell/hooks/useDragSelect.ts
import { useSheetState } from '@/state/hooks'          // ✅ Cross-module
import { clientPointToCell } from '../utils/geometry'  // ✅ Same component
import { addressToA1 } from '@/state/utils/refs'       // ✅ Cross-module
```

**In state/utils:**
```typescript
// @/state/utils/evaluator.ts
import type { AST } from './ast'          // ✅ Relative (same module)
import { expandRange } from './ranges'    // ✅ Relative (same module)
import type { Value } from '../types'     // ✅ Relative (parent)
```

## State Management

### Store Architecture
- **Provider**: `SheetProvider` from `@/state/store` - Wraps the app in `App.tsx`
- **Hooks**: `useSheetState()` and `useSheetActions()` from `@/state/hooks`
- **Context**: Contexts defined in `@/state/context.ts` (internal, not exported)
- **State**: `useSheetState()` - Access dims, cells, selection
- **Actions**: `useSheetActions()` - Modify state (setCellInput, setSelection, etc.)

### Files Structure
```
src/state/
├── store.tsx      # SheetProvider component only (React Fast Refresh compliant)
├── context.ts     # Context definitions and types (SheetState, Actions)
├── hooks.ts       # Custom hooks (useSheetState, useSheetActions)
├── types.ts       # Domain types (A1, Cells, Value, Graph, etc.)
└── utils/         # Formula engine utilities
```

### Separation of Concerns
To maintain React Fast Refresh compatibility:
- `store.tsx` - **Only exports the SheetProvider component**
- `hooks.ts` - **Only exports hooks**
- `context.ts` - **Only exports contexts and related types**
- This prevents the "Fast refresh only works when a file only exports components" warning

### Formula Engine Flow
1. User enters formula (starts with `=`)
2. `parser.ts` → tokenizes and creates AST
3. `evaluator.ts` → evaluates AST, tracks dependencies
4. `dependencyGraph.ts` → updates affected cells
5. Re-render affected cells

## Component Hierarchy

```
App
└── SheetProvider (state)
    └── Shell
        ├── Toolbar (delete row/col, clear, smoke test)
        ├── FormulaBar (formula input)
        ├── Grid (main spreadsheet)
        │   └── Cell[] (virtualized rendering)
        │       └── CellEditor (inline editing)
        └── StatusBar (selection info)
```

## Key Concepts

### Cell References
- **A1 notation**: `A1`, `B10`, `Z99` (column letter + row number)
- **Converters**: `a1ToAddress()`, `addressToA1()`, `indexToCol()`, `colToIndex()`

### Formula Syntax
- Formulas start with `=`
- Operators: `+`, `-`, `*`, `/`
- Functions: `SUM(range)`, `AVG(range)`
- Ranges: `A1:B10`

### Error Codes
- `#CYCLE` - Circular dependency
- `#REF!` - Invalid reference
- `#DIV/0!` - Division by zero
- `#VALUE!` - Type error

## Development Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Run ESLint
```

## TypeScript Type Safety

This project follows **strict type adherence** with zero tolerance for type assertions.

### Rules

1. **No `as any` type assertions** - All type assertions have been removed from the codebase
2. **Use type guards** - Create runtime validation functions for type narrowing
3. **Proper union types** - Instead of `any`, use specific union types
4. **Separate refs** - Use distinct refs for different element types instead of union refs

### Type Guard Pattern

When you need to narrow types at runtime, create type guard functions:

```typescript
// ✅ Good - Type guard function
type BinOp = '+' | '-' | '*' | '/'

function isBinOp(v: string): v is BinOp {
  return v === '+' || v === '-' || v === '*' || v === '/'
}

// Usage
if (isBinOp(op)) {
  // TypeScript knows op is BinOp here
}

// ❌ Bad - Type assertion
const op = value as BinOp
```

### Ref Typing Pattern

For components with conditional rendering, use separate refs:

```typescript
// ✅ Good - Separate refs
const inputRef = useRef<HTMLInputElement>(null)
const textareaRef = useRef<HTMLTextAreaElement>(null)

function onKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  // Handle both types properly
}

// ❌ Bad - Union ref with type assertion
const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
(ref.current as HTMLInputElement).focus()
```

### Hook Signature Pattern

Be explicit about null handling in ref types:

```typescript
// ✅ Good - Explicit null handling
export function useClipboard(containerRef: React.RefObject<HTMLElement | null>) {
  const el = containerRef.current
  if (!el) return
  // ...
}

// ❌ Bad - Type assertion to bypass null
const el = containerRef.current as HTMLElement
```

### Examples in Codebase

**Type guards in parser.ts:**
```typescript
function isBinOp(v: string): v is BinOp {
  return v === '+' || v === '-' || v === '*' || v === '/'
}

function isFunctionName(id: string): id is 'SUM' | 'AVG' {
  return id === 'SUM' || id === 'AVG'
}
```

**Type guards in tokenizer.ts:**
```typescript
const isOperator = (ch: string): ch is '+' | '-' | '*' | '/' | ':' => {
  return ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === ':'
}
```

**Separate refs in CellEditor.tsx:**
```typescript
const inputRef = useRef<HTMLInputElement>(null)
const textareaRef = useRef<HTMLTextAreaElement>(null)

useEffect(() => {
  if (expanded) {
    textareaRef.current?.focus()
  } else {
    inputRef.current?.focus()
  }
}, [a1, expanded])
```

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety (strict mode, no type assertions)
- **Vite (Rolldown)** - Fast build tool
- **Context API** - State management
- **Local Storage** - Persistence
- **Prettier** - Code formatting (semi: false, singleQuote: true)
