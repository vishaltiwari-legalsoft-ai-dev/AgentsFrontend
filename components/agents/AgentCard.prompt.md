A single specialist AI agent card: category glyph tile, name, role, description, category tag, and an add-to-team action.

```jsx
<AgentCard
  name="Graphic Designer" role="Brand & visual assets"
  description="Creates on-brand graphics, social creatives, and ad variants."
  category="design" glyph={<PaletteIcon/>}
  onAdd={() => {}} interactive
/>
```

`category` (design/seo/copy/social/ads/data) drives the glyph-tile and tag color. Pass `status` to show a run state; `added` flips the button to "Added".
