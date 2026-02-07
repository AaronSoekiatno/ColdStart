// Animation Examples - Choose what works best for your use case

/**
 * ANIMATION LIBRARIES COMPARISON:
 *
 * 1. Framer Motion (Already using ✅)
 *    - Declarative, React-first
 *    - Great for: Page transitions, gestures, layout animations
 *    - Bundle size: ~30kb
 *
 * 2. React Spring (@react-spring/web) (Just installed ✅)
 *    - Physics-based, smooth natural motion
 *    - Great for: Bouncy effects, number counters, parallax
 *    - Bundle size: ~15kb
 *
 * 3. Auto Animate (@formkit/auto-animate) (Just installed ✅)
 *    - Zero-config, automatic
 *    - Great for: Lists, simple fades, automatic layout changes
 *    - Bundle size: ~3kb
 */

'use client';

import { motion } from 'framer-motion';
import { useSpring, animated } from '@react-spring/web';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useState } from 'react';

// ====== FRAMER MOTION EXAMPLES ======

export function FramerMotionStaggeredList({ items }: { items: any[] }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1 // Each child animates 0.1s after the previous
          }
        }
      }}
    >
      {items.map((item, i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0 }
          }}
          whileHover={{ scale: 1.02 }} // Subtle hover effect
          className="p-4 bg-white rounded-lg border"
        >
          {item}
        </motion.div>
      ))}
    </motion.div>
  );
}

export function FramerMotionExpandable({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      layout // Automatically animates layout changes
      onClick={() => setIsOpen(!isOpen)}
      className="cursor-pointer"
    >
      <motion.div
        animate={{ height: isOpen ? 'auto' : 60 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="overflow-hidden"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ====== REACT SPRING EXAMPLES ======

export function SpringNumberCounter({ value }: { value: number }) {
  const { number } = useSpring({
    from: { number: 0 },
    number: value,
    delay: 200,
    config: { mass: 1, tension: 20, friction: 10 } // Smooth physics
  });

  return (
    <animated.div>
      {number.to(n => `${Math.floor(n)}%`)}
    </animated.div>
  );
}

export function SpringHoverCard({ children }: { children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);

  const springProps = useSpring({
    transform: isHovered ? 'scale(1.05) translateY(-4px)' : 'scale(1) translateY(0px)',
    boxShadow: isHovered
      ? '0 20px 25px -5px rgb(0 0 0 / 0.1)'
      : '0 1px 3px 0 rgb(0 0 0 / 0.1)',
    config: { tension: 300, friction: 20 }
  });

  return (
    <animated.div
      style={springProps}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="p-6 bg-white rounded-lg border"
    >
      {children}
    </animated.div>
  );
}

// ====== AUTO ANIMATE EXAMPLES ======

export function AutoAnimateList({ items }: { items: any[] }) {
  const [parent] = useAutoAnimate({
    duration: 300,
    easing: 'ease-out'
  });

  return (
    <div ref={parent} className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="p-4 bg-white rounded-lg border">
          {item}
        </div>
      ))}
    </div>
  );
}

// Just add ref to any parent and children will auto-animate!
export function AutoAnimateExample() {
  const [parent] = useAutoAnimate();
  const [items, setItems] = useState([1, 2, 3]);

  return (
    <div>
      <button onClick={() => setItems([...items, items.length + 1])}>
        Add Item
      </button>
      <div ref={parent}>
        {items.map(i => (
          <div key={i} className="p-4 bg-white rounded-lg border">
            Item {i}
          </div>
        ))}
      </div>
    </div>
  );
}

// ====== RECOMMENDED USAGE ======

/**
 * For your dashboard:
 *
 * 1. Table Rows: Use Framer Motion staggered animations (already implemented ✅)
 * 2. Match Score Numbers: Use React Spring for smooth counting up
 * 3. Expandable Details: Use Framer Motion layout animations (already implemented ✅)
 * 4. Hover Effects: Use React Spring for smooth scale/shadow transitions
 * 5. List Reordering: Use Auto Animate for simple automatic animations
 *
 * Mix and match based on the effect you want!
 */
