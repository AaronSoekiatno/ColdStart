# Company Dashboard - Clado-Style Implementation Guide

## What We Built

Transformed your company dashboard from cards to a **Clado-style table layout** with smooth animations and expandable rows.

## ✨ New Features

### 1. **Table View** (Default)
- Clean, scannable table layout like Clado.ai
- Shows key metrics at a glance: Name, Experience, Match Score, Proven/Unproven counts
- Avatar initials with gradient backgrounds
- Color-coded match scores (Green 85+, Blue 75-84, Amber <75)

### 2. **Expandable Row Details**
- Click any row to expand full candidate details
- Smooth height animations (Framer Motion)
- Two-column layout:
  - **Left:** Proven claims + GitHub analysis
  - **Right:** Unproven claims + Match analysis
- Language proficiency bars with animated progress
- Assessment highlights when available

### 3. **View Toggle**
- Switch between **Table** and **Cards** view
- Smooth transitions between layouts
- Table is default (better for scanning multiple candidates)

### 4. **Animations**
- **Row entrance:** Staggered fade-in (each row 0.05s delay)
- **Row expansion:** Smooth height animation with easing
- **Chevron rotation:** 180° flip on expand/collapse
- **Hover states:** Subtle background color change
- **Progress bars:** Animated width on expand (GitHub languages)

## 🎨 Animation Libraries Available

### Installed & Ready:

1. **Framer Motion** (Currently using)
   - Perfect for: Layout animations, page transitions, gestures
   - Used in: Table rows, expandable sections, stagger effects
   ```tsx
   <motion.div
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ delay: 0.1 }}
   />
   ```

2. **React Spring** (@react-spring/web)
   - Perfect for: Physics-based motion, number counters, smooth bounces
   - Great for: Match score counting up, smooth hover effects
   ```tsx
   const props = useSpring({
     from: { number: 0 },
     to: { number: 92 },
     config: { tension: 300, friction: 20 }
   });
   ```

3. **Auto Animate** (@formkit/auto-animate)
   - Perfect for: Zero-config automatic animations
   - Great for: Lists, simple fades, sorting
   ```tsx
   const [parent] = useAutoAnimate();
   return <div ref={parent}>{items}</div>
   ```

4. **Remotion** (You mentioned using this)
   - Perfect for: Programmatic video generation
   - Great for: Candidate showcase videos, animated reports

## 🎯 Recommended Usage

| Feature | Best Library | Why |
|---------|--------------|-----|
| Table row entrance | Framer Motion ✅ | Stagger control, declarative |
| Expandable details | Framer Motion ✅ | Layout animations |
| Match score counter | React Spring | Smooth number animation |
| Hover effects | React Spring | Physics-based feel |
| List reordering | Auto Animate | Automatic, zero config |
| Candidate videos | Remotion | Programmatic video |

## 📊 Color System

### Match Scores:
- **85-100%:** Green (`emerald-100/700/200`)
- **75-84%:** Blue (`blue-100/700/200`)
- **<75%:** Amber (`amber-100/700/200`)

### Evidence Types:
- **Proven Claims:** Green (`emerald-50/700/100/200`)
- **Unproven Claims:** Amber (`amber-50/700/100/200`)
- **Assessment:** Blue (`blue-50/700/100/200`)

## 🚀 Quick Customization

### Change Animation Speed:
```tsx
// In CandidateTable.tsx, line ~40
transition={{ delay: index * 0.05, duration: 0.3 }}
// Adjust: 0.05 = delay between rows, 0.3 = animation duration
```

### Change Stagger Effect:
```tsx
// Slower stagger (more dramatic):
transition={{ delay: index * 0.1, duration: 0.4 }}

// Faster stagger (snappier):
transition={{ delay: index * 0.02, duration: 0.2 }}
```

### Add Spring to Hover:
```tsx
// Replace hover:bg-zinc-50 with React Spring:
import { useSpring, animated } from '@react-spring/web';

const [isHovered, setIsHovered] = useState(false);
const springProps = useSpring({
  backgroundColor: isHovered ? 'rgb(250, 250, 250)' : 'rgb(255, 255, 255)',
  transform: isHovered ? 'scale(1.01)' : 'scale(1)',
});
```

## 🎬 Next Steps (Optional Enhancements)

1. **Add Match Score Counter Animation**
   - Use React Spring to animate numbers from 0 → actual score
   - Add to table header or on row expand

2. **Add Micro-interactions**
   - Subtle scale on button hover
   - Icon bounce on expand
   - Badge wiggle on hover

3. **Add Loading Skeletons**
   - Use Framer Motion for pulsing skeleton states
   - Show while fetching real data

4. **Add Candidate Videos with Remotion**
   - Generate shareable candidate highlight reels
   - Animated proof brief videos for email

## 📁 File Structure

```
components/company/
├── CandidateTable.tsx          # New table component ✨
├── CandidateBriefCard.tsx      # Original card view
├── CompanyProfileCard.tsx      # Company info display
├── MatchScoreBreakdown.tsx     # Match visualization
└── AnimationExamples.tsx       # Library examples & docs

app/company-dashboard/
└── page.tsx                    # Main dashboard (toggle view)

lib/
└── mockCompanyData.ts          # Mock candidates & company
```

## 🔧 Toggle Between Views

The dashboard now has a view switcher in the top right:
- **Table View** (Default) - Best for scanning many candidates
- **Cards View** - Best for detailed individual review

## 💡 Pro Tips

1. **Keep animations subtle** - 0.3s is usually perfect
2. **Stagger sparingly** - 0.05s delay feels smooth without being slow
3. **Use physics for hover** - React Spring makes it feel alive
4. **Layout animations are magic** - Framer Motion's `layout` prop handles the rest
5. **Auto Animate is your friend** - For simple lists, just add the ref

## 🎨 Clado-Inspired Design Elements

✅ Clean table layout with expandable rows
✅ Avatar initials with gradients
✅ Color-coded indicators (green/amber/blue)
✅ Subtle hover states
✅ Professional spacing and typography
✅ Evidence-based proof system
✅ Scannable at a glance

## Need Help?

Check `AnimationExamples.tsx` for code samples of each animation library!
