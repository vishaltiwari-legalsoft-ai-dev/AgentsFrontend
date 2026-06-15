/* Sample data for the Ensemble Console UI kit (fake). */
window.ConsoleData = {
  agents: [
    { id:'a1', name:'Graphic Designer', role:'Brand & visual assets', category:'design', glyph:'palette',
      description:'Produces on-brand graphics, social creatives, and ad variants from a brief.' },
    { id:'a2', name:'SEO Analyst', role:'Search & rankings', category:'seo', glyph:'search',
      description:'Audits pages, finds keyword gaps, and writes optimization briefs.' },
    { id:'a3', name:'Copywriter', role:'Words that convert', category:'copy', glyph:'pen-line',
      description:'Drafts landing copy, emails, and posts in your brand voice.' },
    { id:'a4', name:'Social Scheduler', role:'Posts & calendars', category:'social', glyph:'megaphone',
      description:'Plans and queues content across channels at the best times.' },
    { id:'a5', name:'Ads Optimizer', role:'Paid performance', category:'ads', glyph:'target',
      description:'Tunes budgets, bids, and creatives to hit your CPA target.' },
    { id:'a6', name:'Market Researcher', role:'Insights & trends', category:'data', glyph:'bar-chart-3',
      description:'Summarizes competitors, audiences, and category trends.' },
    { id:'a7', name:'Email Marketer', role:'Lifecycle & nurture', category:'copy', glyph:'mail',
      description:'Builds sequences and writes nurture flows that re-engage leads.' },
    { id:'a8', name:'Brand Strategist', role:'Positioning & messaging', category:'design', glyph:'compass',
      description:'Shapes positioning, tone, and messaging pillars for campaigns.' },
  ],
  teams: [
    { id:'t1', name:'Campaign Manager', status:'running', lastRun:'just now', deployed:true,
      description:'Plans, drafts, and schedules a full campaign across channels.',
      members:[{name:'Brand Strategist',category:'design'},{name:'Copywriter',category:'copy'},{name:'Graphic Designer',category:'design'},{name:'Social Scheduler',category:'social'},{name:'Ads Optimizer',category:'ads'}] },
    { id:'t2', name:'Outbound Reach', status:'idle', lastRun:'1d ago', deployed:false,
      description:'Researches prospects and runs personalized multi-touch outreach.',
      members:[{name:'Market Researcher',category:'data'},{name:'Copywriter',category:'copy'},{name:'Email Marketer',category:'copy'}] },
    { id:'t3', name:'Content Engine', status:'success', lastRun:'3h ago', deployed:true,
      description:'A steady stream of SEO-driven articles, edited and published.',
      members:[{name:'SEO Analyst',category:'seo'},{name:'Copywriter',category:'copy'},{name:'Graphic Designer',category:'design'},{name:'Social Scheduler',category:'social'}] },
    { id:'t4', name:'Launch Squad', status:'paused', lastRun:'2d ago', deployed:false,
      description:'Coordinates a product launch from teaser to announcement.',
      members:[{name:'Brand Strategist',category:'design'},{name:'Graphic Designer',category:'design'},{name:'Ads Optimizer',category:'ads'},{name:'Email Marketer',category:'copy'}] },
  ],
  runSteps: [
    { t:'14:02:31', agent:'Brand Strategist', cat:'design', msg:'Defined 3 messaging pillars', status:'success' },
    { t:'14:03:08', agent:'Market Researcher', cat:'data', msg:'Summarized 12 competitor campaigns', status:'success' },
    { t:'14:05:44', agent:'Copywriter', cat:'copy', msg:'Drafted 8 post variants + 2 emails', status:'success' },
    { t:'14:07:12', agent:'Graphic Designer', cat:'design', msg:'Rendering 6 creatives…', status:'running' },
    { t:'—', agent:'Social Scheduler', cat:'social', msg:'Queue posts to calendar', status:'idle' },
    { t:'—', agent:'Ads Optimizer', cat:'ads', msg:'Set budgets & launch', status:'idle' },
  ],
};

/* Per-team coordinator chat: channel preview, history of past work, and a seed conversation. */
window.ConsoleData.teamChat = {
  t1: {
    coordinator:'Cam', preview:'Drafting the spring launch posts now…', time:'now', unread:2,
    history:[
      { name:'Spring Sale — launch', when:'2d ago', status:'success', stats:'12 posts · 6 creatives · 3 emails' },
      { name:'Webinar promo push', when:'1w ago', status:'success', stats:'8 posts · 2 emails · 1 landing page' },
      { name:'Brand refresh teaser', when:'3w ago', status:'success', stats:'5 posts · 4 creatives' },
    ],
    seed:[
      { role:'coordinator', text:"Hi Mara — I'm Cam, the Campaign Manager. Tell me the goal and I'll route the work to the team. What are we launching?" },
      { role:'user', text:'Launch our spring sale — 20% off, runs Apr 1–14. Need posts, creatives and a launch email.' },
      { role:'coordinator', text:"On it. I'll brief the strategist first, then hand off to copy, design and ads. Here's the plan:" },
      { role:'step', agent:'Brand Strategist', cat:'design', msg:'Defined 3 messaging pillars for the sale', status:'success', t:'14:02' },
      { role:'step', agent:'Copywriter', cat:'copy', msg:'Drafted 8 post variants + launch email', status:'success', t:'14:05' },
      { role:'step', agent:'Graphic Designer', cat:'design', msg:'Rendering 6 creatives…', status:'running', t:'14:07' },
      { role:'coordinator', text:"Copy and pillars are ready for your review. Designer is finishing creatives — want me to queue everything to the calendar once they're done?" },
    ],
  },
  t2: {
    coordinator:'Theo', preview:'18 replies so far — 3 booked meetings.', time:'1d', unread:0,
    history:[
      { name:'Q2 enterprise outreach', when:'1d ago', status:'success', stats:'240 prospects · 18 replies · 3 meetings' },
      { name:'Re-engage cold leads', when:'5d ago', status:'success', stats:'90 prospects · 11 replies' },
    ],
    seed:[
      { role:'coordinator', text:"I'm Theo, your Outbound Reach coordinator. Give me an ICP and I'll research, write, and run the sequence." },
      { role:'user', text:'Target Series-B marketing leaders in SaaS. 3-touch email sequence.' },
      { role:'step', agent:'Market Researcher', cat:'data', msg:'Built a list of 240 matching prospects', status:'success', t:'09:12' },
      { role:'step', agent:'Copywriter', cat:'copy', msg:'Wrote a 3-touch personalized sequence', status:'success', t:'09:20' },
      { role:'coordinator', text:'Sequence is live. 18 replies and 3 meetings booked so far — full report in the History tab.' },
    ],
  },
  t3: {
    coordinator:'Remy', preview:'Published “10 SEO myths”. Next up: 2 drafts.', time:'3h', unread:1,
    history:[
      { name:'October content sprint', when:'3h ago', status:'success', stats:'6 articles · 6 hero images · published' },
      { name:'Pillar page refresh', when:'1w ago', status:'success', stats:'3 articles · 18 internal links' },
    ],
    seed:[
      { role:'coordinator', text:"Remy here, running the Content Engine. Tell me a topic or let me pull from the SEO backlog." },
      { role:'user', text:'Write and publish a post busting common SEO myths.' },
      { role:'step', agent:'SEO Analyst', cat:'seo', msg:'Found a 2.4k-volume keyword gap', status:'success', t:'11:01' },
      { role:'step', agent:'Copywriter', cat:'copy', msg:'Drafted “10 SEO myths” (1,400 words)', status:'success', t:'11:14' },
      { role:'coordinator', text:'Published and shared to social. Two more drafts are queued — sound good?' },
    ],
  },
  t4: {
    coordinator:'Nia', preview:'Paused — waiting on launch date.', time:'2d', unread:0,
    history:[
      { name:'v3 product launch', when:'paused', status:'paused', stats:'teaser ready · announcement drafted' },
    ],
    seed:[
      { role:'coordinator', text:"I'm Nia, coordinating the Launch Squad. Share the launch date and I'll sequence teaser → announcement → follow-up." },
      { role:'user', text:'Launch is May 6. Hold everything until I confirm.' },
      { role:'coordinator', text:"Got it — I've drafted the teaser and announcement and paused the squad until you give the go-ahead." },
    ],
  },
};
