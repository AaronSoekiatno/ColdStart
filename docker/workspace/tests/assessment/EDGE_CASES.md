# AST Test Edge Cases & Detection Rules

## Test 1: Data Fetching (10 points)

### What We're Looking For
**ANY ONE** of these actual function calls:
- `fetch()`
- `useEffect()`
- `useSWR()`
- `useQuery()`
- `axios()`

### ✅ PASS Examples
```typescript
// Example 1: Direct fetch
const data = await fetch('/api/insights/performance');

// Example 2: useEffect with fetch
useEffect(() => {
  fetch('/api/insights/performance');
}, []);

// Example 3: useSWR
const { data } = useSWR('/api/insights/performance');

// Example 4: Async function
async function getData() {
  return fetch('/api/insights/performance');
}
```

### ❌ FAIL Examples
```typescript
// FAIL: Just a comment
// TODO: Add fetch() here

// FAIL: Just a string
const message = "Use fetch to get data";

// FAIL: Variable named fetch
const fetch = myCustomFunction;

// FAIL: No actual call
import { fetch } from 'node-fetch'; // Just import, no call
```

---

## Test 2: API Endpoint Call (10 points)

### What We're Looking For
A `fetch()` call with `/api/insights/performance` in the URL

### ✅ PASS Examples
```typescript
// Example 1: String literal
fetch('/api/insights/performance')

// Example 2: Template literal
fetch(`/api/insights/performance`)

// Example 3: With full URL
fetch('http://localhost:3000/api/insights/performance')

// Example 4: Template with variables (partial match)
fetch(`${baseUrl}/api/insights/performance`)
```

### ❌ FAIL Examples
```typescript
// FAIL: Wrong endpoint
fetch('/api/insights/summary')

// FAIL: Typo
fetch('/api/insight/performance')

// FAIL: Comment only
// fetch('/api/insights/performance')

// FAIL: Variable without call
const url = '/api/insights/performance';
// (no actual fetch call)
```

### ⚠️ EDGE CASE: Dynamic URLs
```typescript
// MIGHT FAIL: Fully dynamic URL
const endpoint = getEndpoint();
fetch(endpoint); // AST can't know what endpoint is

// WILL PASS: Partial template
fetch(`${baseUrl}/api/insights/performance`); // Contains the path
```

---

## Test 3: State Management (10 points)

### What We're Looking For
**BOTH** of these:
1. A `useState()` call
2. At least one state variable extracted

### ✅ PASS Examples
```typescript
// Example 1: Standard useState
const [data, setData] = useState([]);

// Example 2: Multiple states
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

// Example 3: With type
const [items, setItems] = useState<PerformanceData[]>([]);
```

### ❌ FAIL Examples
```typescript
// FAIL: No useState call
let data = [];

// FAIL: useState imported but not called
import { useState } from 'react';

// FAIL: Comment only
// const [data, setData] = useState([]);

// FAIL: Wrong destructuring
const state = useState([]); // Not array destructuring
```

### ⚠️ EDGE CASE: Custom Hooks
```typescript
// MIGHT FAIL: Custom hook that uses useState internally
const data = useCustomData(); // AST doesn't see useState

// WILL PASS: Direct useState
const [data, setData] = useState([]);
```

---

## Test 4: Array Mapping (10 points)

### What We're Looking For
A `.map()` method call on any array

### ✅ PASS Examples
```typescript
// Example 1: Standard map
data.map(item => <div>{item.title}</div>)

// Example 2: With index
items.map((item, index) => <Card key={index} />)

// Example 3: Chained
data.filter(x => x.active).map(x => x.name)

// Example 4: Variable
const results = performances.map(p => p.score);
```

### ❌ FAIL Examples
```typescript
// FAIL: Comment
// data.map(item => <div>{item}</div>)

// FAIL: String
const code = "data.map(x => x)";

// FAIL: No map call
const items = data; // Just assignment

// FAIL: forEach instead
data.forEach(item => console.log(item));
```

### ⚠️ EDGE CASE: Array Methods
```typescript
// WILL PASS: Any .map() call
[1,2,3].map(x => x * 2)
myArray.map(transform)
response.data.map(format)

// MIGHT FAIL: Custom map function
function map(arr, fn) { ... }
map(data, x => x); // Not a method call
```

---

## Test 5: Viral Score Display (10 points)

### What We're Looking For
Text containing `viral_score` or `viral score` (case-insensitive)

### ✅ PASS Examples
```typescript
// Example 1: Property access
<div>{item.viral_score}</div>

// Example 2: Variable
const score = data.viral_score;

// Example 3: Comment (YES, this passes - it's a text check)
// Display the viral_score here

// Example 4: String
const label = "Viral Score";
```

### ❌ FAIL Examples
```typescript
// FAIL: Typo
<div>{item.viralScore}</div> // camelCase

// FAIL: Different name
<div>{item.score}</div>

// FAIL: No mention
<div>{item.views}</div>
```

### ⚠️ NOTE: This is NOT AST-based
This test uses regex because we're checking if they're displaying the field, not calling a function.

---

## Test 6: Views Display (10 points)

### What We're Looking For
The word `views` (case-insensitive, word boundary)

### ✅ PASS Examples
```typescript
// Example 1: Property
{item.views}

// Example 2: Label
<span>Views: {count}</span>

// Example 3: Comment
// Show views count
```

### ❌ FAIL Examples
```typescript
// FAIL: Part of another word
{item.previews} // Contains "views" but not as word

// FAIL: Typo
{item.view} // Singular

// FAIL: No mention
{item.count}
```

---

## Test 7: High Performer Logic (10 points)

### What We're Looking For
Comparison with a number (e.g., `score > 80`)

### ✅ PASS Examples
```typescript
// Example 1: Direct comparison
item.viral_score > 80

// Example 2: Variable
const isHigh = score >= 90;

// Example 3: Ternary
item.score > 75 ? 'high' : 'low'

// Example 4: If statement
if (viral_score > 80) { ... }
```

### ❌ FAIL Examples
```typescript
// FAIL: No comparison
const isHigh = item.isHighPerformer; // Boolean field

// FAIL: String comparison
score > 'high'

// FAIL: No threshold
const sorted = items.sort((a,b) => a.score - b.score);
```

### ⚠️ EDGE CASE: Constants
```typescript
// WILL PASS: Named constant
const THRESHOLD = 80;
score > THRESHOLD; // Regex sees "score > "

// MIGHT FAIL: Calculated threshold
score > calculateThreshold(); // Depends on regex
```

---

## Test 8: Conditional Styling (10 points)

### What We're Looking For
A ternary operator (`? :`) anywhere in the code

### ✅ PASS Examples
```typescript
// Example 1: className
className={isHigh ? 'highlight' : 'normal'}

// Example 2: style
style={{ color: score > 80 ? 'green' : 'red' }}

// Example 3: Any ternary
const value = condition ? a : b;

// Example 4: Nested
className={
  score > 90 ? 'excellent' :
  score > 70 ? 'good' : 'normal'
}
```

### ❌ FAIL Examples
```typescript
// FAIL: If statement (not ternary)
if (isHigh) {
  className = 'highlight';
}

// FAIL: Logical AND
{isHigh && <Badge />}

// FAIL: Object lookup
const styles = { high: 'bg-green', low: 'bg-red' };
className={styles[level]}
```

### ⚠️ EDGE CASE: Conditional Rendering
```typescript
// WILL PASS: Any ternary
{loading ? <Spinner /> : <Data />}

// MIGHT FAIL: Logical operators
{isHigh && <HighBadge />} // No ternary
{!loading || <Spinner />} // No ternary
```

---

## Critical Edge Cases Summary

### Will Cause FALSE NEGATIVES (should pass but fails):

1. **Custom hooks wrapping useState**
   ```typescript
   const data = usePerformanceData(); // Fails - no direct useState
   ```

2. **Fully dynamic API URLs**
   ```typescript
   fetch(API_ENDPOINTS.performance); // Fails - can't see string
   ```

3. **Custom map implementations**
   ```typescript
   customMap(data, x => x); // Fails - not .map() method
   ```

4. **Conditional rendering without ternary**
   ```typescript
   {isHigh && <Badge />} // Fails - no ? :
   ```

### Will Cause FALSE POSITIVES (should fail but passes):

1. **Comments mentioning keywords** (for text-based checks)
   ```typescript
   // TODO: Display viral_score // PASSES viral_score check
   ```

2. **Strings containing keywords**
   ```typescript
   const msg = "views count"; // PASSES views check
   ```

3. **Any ternary operator** (not just styling)
   ```typescript
   const x = true ? 1 : 2; // PASSES conditional styling
   ```

---

## Recommendations

### To Reduce False Negatives:
1. Accept `useSWR`, `useQuery` as alternatives to `useState`
2. Accept any `/api/insights/` endpoint (not just `/performance`)
3. Accept logical AND (`&&`) for conditional rendering

### To Reduce False Positives:
1. Keep AST-based checks (already done for fetch, useState, map)
2. Add AST check for property access (viral_score, views)
3. Add context checking for ternaries (must be in JSX or className)

### Current Accuracy:
- **AST-based tests**: ~95% accurate
- **Regex-based tests**: ~80% accurate (viral_score, views, high performer logic)
