Ink-black or brand-blue action button for any clickable command — use `brand` sparingly as the single highlight per view.

```jsx
<Button variant="brand" size="md" iconLeft={<PlusIcon/>}>New agent</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost" size="sm">Skip</Button>
```

Variants: `primary` (ink, default), `brand` (blue), `secondary` (white + border), `ghost`, `danger`. Sizes: `sm` / `md` / `lg`. Props: `fullWidth`, `iconLeft`, `iconRight`, `as` (e.g. render as `"a"`).
