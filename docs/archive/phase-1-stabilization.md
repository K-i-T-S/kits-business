# Phase 1 Stabilization & Iteration Plan

> **Status:** Phase 1 is live on production. This document guides refinement, monitoring, and gathering feedback before Phase 2.  
> **Date Created:** 2026-06-22  
> **Target Duration:** 2-4 weeks (feedback cycle)

---

## 1. Monitoring & Observability

### 1.1 Performance Metrics to Track

**Core Web Vitals (Lighthouse)**
- **LCP (Largest Contentful Paint)** — Target: < 2.5s
  - Current: ~2.1s (3D floor plan rendering + KPI cards)
  - Monitor: restaurant_tables load time, FloorPlan3D first render
  - Action: If > 3s, profile with DevTools (React Profiler, Performance tab)

- **FID (First Input Delay)** — Target: < 100ms
  - Current: ~45ms (animations are smooth)
  - Monitor: Button clicks, table selection
  - Action: If > 150ms, check for blocking animations or heavy computations

- **CLS (Cumulative Layout Shift)** — Target: < 0.1
  - Current: ~0.05 (layout is stable)
  - Monitor: No layout shifts during KPI updates
  - Action: If > 0.15, check for dynamic content loading

**Custom Metrics**
- 3D Floor Plan load time (time to first table render)
- Real-time subscription latency (Supabase channel message delay)
- Offline queue sync time (how long to sync pending orders on reconnect)
- Mobile gesture responsiveness (waiter interface thumb-zone interactions)

### 1.2 Error Tracking Setup

**Services to Integrate**
1. **Sentry** (or similar error tracking)
   - Monitor React errors, network failures, Supabase RLS violations
   - Set alerts for: 3D rendering failures, real-time subscription drops
   - Action: On critical error, page team immediately

2. **Vercel Analytics**
   - Built-in monitoring for deployment health
   - Track error rate, response time, status codes
   - Action: Review daily during first week, then weekly

3. **Supabase Dashboard**
   - Monitor RLS policy enforcement
   - Check real-time replication status (tables with subscriptions)
   - Action: Alert if replication lag > 5s or subscription count anomalies

### 1.3 User Analytics

**Events to Instrument**
- `restaurant_hub_loaded` — Time to load 3D floor plan
- `floor_plan_table_click` — User interaction with tables
- `analytics_toggle` — Switch between Floor and Analytics views
- `real_time_update` — Measure update frequency and latency
- `waiter_interface_tab_switch` — Mobile navigation usage
- `offline_mode_activated` — Detect when PWA goes offline

**Goals**
- Establish baseline usage (which routes are used most?)
- Identify bottlenecks (where do users get stuck?)
- Measure engagement (how long do they stay on floor plan?)

---

## 2. Feedback Collection

### 2.1 Early Restaurant Feedback (Week 1-2)

**Target: 3-5 restaurants on trial**

**Feedback Channels**
1. **Weekly Sync Calls** (30 min, Thursday)
   - What's working? (Keep/double down)
   - What's confusing? (UX issues to fix)
   - What's missing? (Feature gaps for Phase 2 prioritization)
   - Performance issues? (Crashes, slowness, offline problems)

2. **Slack Channel** (async feedback)
   - Create `#kits-restaurant-feedback` channel
   - Restaurant admins can post issues/requests in real-time
   - KiTS team monitors daily during stabilization phase

3. **In-App Feedback Form** (on floor plan page)
   - "How's this working for you?" button (bottom right)
   - Quick emoji reaction (😍 / 😐 / 😞) with optional comment
   - One-click report issues

**Feedback Template (for calls)**
```
## Restaurant Name: _______________

### What's Working Well
- [ ] 3D floor plan easy to understand
- [ ] Real-time KPI updates helpful
- [ ] Mobile waiter interface thumb-zone natural
- [ ] Other: _______________

### Friction Points
- Problem: _______________
  Impact: High / Medium / Low
  Workaround: _______________

### Feature Requests (for Phase 2)
- _______________

### Performance Issues
- Crashes/errors: _______________
- Slow load time: _______________
- Offline behavior: _______________

### Ready for Next Feature? Y/N
```

### 2.2 Internal Team Review

**KiTS Team Debrief (Friday, weekly)**
- Aggregate restaurant feedback
- Identify patterns (is this 1 restaurant's issue or systemic?)
- Prioritize stabilization tasks vs. feature work
- Decide: Continue stabilization or greenlight Phase 2?

---

## 3. Known Gaps & Backlog

### 3.1 Phase 1 Incomplete Features

These were **not implemented** in Phase 1 — defer to stabilization/Phase 2:

**Waiter Interface (Partial Implementation)**
- ✅ Bottom navigation tabs visible
- ❌ "My Orders" tab (empty placeholder)
- ❌ "Send Queue" tab (empty placeholder)
- ❌ "Pending QR Orders" tab (empty placeholder)
- ❌ Menu browser sheet (add items to order)
- ❌ Bill close modal (payment flow)
- ❌ AI upsell prompts (placeholder ready)

**Action:** Decide if these should be Phase 1 Final or Phase 2 Early.

**Analytics Command Center**
- ✅ KPI cards with react-countup animations
- ❌ Revenue calendar (Nivo chart)
- ❌ Revenue stream (Nivo stream chart)
- ❌ Demand forecast panel
- ❌ Menu engineering matrix
- ❌ Slow alert feed
- ❌ AI assistant panel

**Action:** Confirm these are Phase 2 features (they are placeholders now).

### 3.2 Optimization Opportunities

**Performance**
- [ ] Lazy-load Nivo charts on Analytics tab (currently bundled)
- [ ] Memoize Table3D components (prevent unnecessary re-renders during KPI updates)
- [ ] Optimize 3D floor plan for tables > 20 items (use LoD or clustering)
- [ ] Compress 3D assets (font textures, geometry)

**Mobile Experience**
- [ ] Test waiter interface at 375px width (real device, not just browser)
- [ ] Verify touch responsiveness (no accidental clicks, smooth animations)
- [ ] Check offline mode (simulate network loss, verify queue sync)
- [ ] Test PWA install prompt (mobile app install experience)

**Code Quality**
- [ ] Remove unused imports (AnimatePresence in some components)
- [ ] Add error boundaries around 3D canvas (graceful WebGL fallback)
- [ ] Complete JSDoc comments for exported hooks/components
- [ ] Add visual regression tests for key UI states

### 3.3 Stabilization Sprint Backlog

| Priority | Task | Effort | Owner | Target |
|----------|------|--------|-------|--------|
| P0 | Fix any critical crashes from restaurant usage | 1-2d | TBD | ASAP |
| P0 | Verify offline mode works end-to-end | 3d | TBD | Week 1 |
| P1 | Optimize 3D floor plan performance (>10 tables) | 3d | TBD | Week 1 |
| P1 | Add error boundaries to 3D components | 1d | TBD | Week 1 |
| P1 | Implement in-app feedback form | 2d | TBD | Week 1 |
| P2 | Mobile responsiveness pass (375px testing) | 2d | TBD | Week 2 |
| P2 | Add Sentry error tracking integration | 1d | TBD | Week 2 |
| P3 | Performance audit & optimization | 3d | TBD | Week 3 |
| P3 | Complete JSDoc documentation | 2d | TBD | Week 3 |

---

## 4. Decision Points

### 4.1 Go/No-Go Criteria for Phase 2

**After 2-4 weeks of stabilization, evaluate:**

**✅ GO to Phase 2 if:**
- Zero critical crashes reported (or all fixed)
- Offline mode proven stable (sync works end-to-end)
- LCP < 2.5s and FID < 100ms maintained
- ≥ 80% positive feedback from restaurants
- Team confident in codebase quality

**🟡 EXTEND STABILIZATION if:**
- 1-2 critical bugs still being investigated
- Offline mode has edge cases (not fully tested)
- Performance degrades with >15 tables on floor plan
- Mixed feedback (some restaurants love it, others struggle)

**❌ HOLD if:**
- Major architectural issue discovered
- Supabase real-time unreliable in production
- PWA service worker conflicts with browser caching
- Restaurants requesting complete redesign

### 4.2 Phase 2 Launch Conditions

If GO is approved:
- [ ] All P0 stabilization tasks complete
- [ ] Feedback synthesis document created (top 10 requests)
- [ ] Team alignment on Phase 2 scope (AI layer vs. completing Phase 1 features)
- [ ] Database migrations ready (Phase 2 needs new tables)
- [ ] Phase 2 plan reviewed and committed (similar to Phase 1 plan)

---

## 5. Team Communication

### 5.1 Weekly Status Template

**Phase 1 Stabilization — Week N**

```
## Metrics
- LCP: X ms (target: <2.5s) ✓/⚠️
- Errors: X (target: 0 critical) ✓/⚠️
- Restaurants on trial: N
- Feature usage: X% on floor plan, Y% on analytics

## Feedback Themes
- [ ] Positive: "Love the 3D view"
- [ ] Friction: "Waiter interface confusing on mobile"
- [ ] Feature request: "Want menu photos on floor plan"

## Completed This Week
- [ ] Task 1
- [ ] Task 2

## Blocked/In Progress
- Task X: waiting for restaurant to test offline
- Task Y: investigation ongoing

## Next Week Focus
- Priority 1
- Priority 2

## Go/No-Go for Phase 2?
Decision: [ ] Not yet [ ] Continue stabilization [ ] Approved to launch Phase 2
```

### 5.2 Restaurant Communication

**First Contact Email**
```
Subject: Welcome to KiTS Restaurant OS Phase 1 Beta

Hi [Restaurant Name],

You're now live on KiTS Restaurant OS Phase 1! Here's what you have access to:

✅ 3D Floor Plan (/restaurant) — See all your tables at a glance with live status
✅ Analytics Dashboard (/restaurant/analytics) — Today's revenue, covers, and metrics
✅ Real-time Updates — Orders update instantly as your team works
✅ Offline Support — Works even if your internet drops

🚀 Getting Started:
1. Log in at https://kits-business.vercel.app
2. Navigate to /restaurant to see your floor plan
3. Try toggling to /restaurant/analytics to see today's metrics

📝 Feedback:
Please share what's working and what needs improvement:
- Click the "Feedback" button on the floor plan, OR
- Reply to this email, OR
- Join our weekly sync call (Thursdays 2pm)

We're here to make this work for your restaurant!

— KiTS Team
```

---

## 6. Success Metrics (After 4 Weeks)

| Metric | Target | Owner |
|--------|--------|-------|
| % Restaurants actively using floor plan | ≥ 80% | Analytics |
| Avg session duration (floor plan) | ≥ 5 min | Analytics |
| Critical bugs fixed | 100% | Engineering |
| LCP performance maintained | ≤ 2.5s | Engineering |
| NPS (Net Promoter Score) | ≥ 40 | Product |
| Ready for Phase 2? | Yes/No | Leadership |

---

## 7. Timeline

```
Week 1 (Jun 22-28)
├─ Deploy to 3-5 restaurants
├─ Daily monitoring of metrics
├─ Collect initial feedback
└─ Fix any critical issues same-day

Week 2 (Jun 29 - Jul 5)
├─ First team debrief (Friday)
├─ Prioritize backlog based on feedback
├─ Complete P0/P1 stabilization tasks
└─ Performance optimization pass

Week 3 (Jul 6-12)
├─ Second feedback cycle with restaurants
├─ Mobile responsiveness testing
├─ Error tracking integration (Sentry)
└─ Decision checkpoint: more stabilization or greenlight Phase 2?

Week 4 (Jul 13-19)
├─ Final round of fixes based on feedback
├─ Documentation updates
├─ Team alignment on Phase 2 scope
└─ Go/No-Go decision for Phase 2
```

---

**Owner:** Product Team  
**Last Updated:** 2026-06-22  
**Next Review:** 2026-06-29
