# 🤖 Stitch UI 设计优化专用提示词 (Prompt for Stitch)

---

### 📋 直接复制以下 Prompt 提交给 Stitch：

```markdown
Role & Task:
You are a World-Class UI/UX Designer & Mobile Web Developer specializing in premium mobile-first Novel Reading Apps (like Fanqie Reader / 番茄小说 App).

CRITICAL BOUNDARIES & STRICT CONSTRAINTS:
1. PURE UI/CSS DESIGN ONLY: DO NOT modify any backend, database fetching logic (`listPublishedBooks`, Supabase schema, data repositories), state management, or route handlers. Only enhance visual CSS, layout structure, and aesthetic rendering.
2. MOBILE-FIRST APP EXPERIENCE (TOP PRIORITY): The UI must primarily feel like a native high-end mobile iOS/Android app (375px - 430px viewport), while elegantly stretching for desktop browsers (1120px+).

Context:
The attached codebase is "Soma" — a bilingual African web novel platform. The page contains: Fanqie Sticky Search Header, 5 Golden Diamond Shortcuts, Featured Hero Pick, Rank 1/2/3 Metallic Leaderboards, and Book Cards Stream.

Optimization Focus Areas:

1. Native Mobile App Ergonomics (Highest Priority):
   - Touch-friendly action zones (min 44px tap targets).
   - Smooth horizontal swipeable entry pills and ranking carousels.
   - Clean mobile bottom navigation bar alignment.
   - High readability fonts, line-heights, and clear visual hierarchy on mobile screens.

2. Visual Aesthetics & Polish:
   - Modern glassmorphism, soft ambient shadows, ambient glows, and rich warm color scheme (#ED7248 orange, #172B29 deep ink, #F8F7F2 cream).
   - Metallic badges (🥇 🥈 🥉) for Top Rankings.

3. Desktop Adaptability:
   - Clean, centered multi-column grid layout for wide desktop displays.

Output Expectations:
- Provide optimized Vanilla CSS (`app/globals.css`) and clean React TSX layout components (`app/page.tsx`, `app/components/*`).
- DO NOT break any database or data fetching contracts.
```
