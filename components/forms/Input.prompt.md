Single-line text field with optional label, leading icon, hint, and error state.

```jsx
<Input label="Goal" placeholder="Launch the spring campaign" icon={<TargetIcon/>} />
<Input label="Budget" error="Enter a number" defaultValue="abc" />
```

Props: `label`, `hint`, `error` (red state, replaces hint), `icon`. Forwards all native input attrs.
