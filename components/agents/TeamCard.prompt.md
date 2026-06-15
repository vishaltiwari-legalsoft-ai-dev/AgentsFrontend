An AI Team card — a workflow assembled from multiple agents. Shows member avatars, run status, and a deploy/open action.

```jsx
<TeamCard
  name="Campaign Manager"
  description="Plans, drafts, and schedules a full campaign across channels."
  members={[{name:'Graphic Designer',category:'design'},{name:'Copywriter',category:'copy'},{name:'Social Scheduler',category:'social'},{name:'Ads Optimizer',category:'ads'}]}
  status="running" lastRun="2h ago"
  onDeploy={() => {}} interactive
/>
```

Pairs with `AgentCard` (single specialist). `deployed` flips the CTA to "Open team".
