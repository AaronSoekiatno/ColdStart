export default function Home() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="max-w-2xl p-8">
        <h1 className="text-3xl font-bold mb-4">
          Real-Time Notification Bell Assessment
        </h1>

        <div className="space-y-4 text-muted-foreground">
          <p>
            <strong>Time Limit:</strong> 20 minutes<br />
            <strong>Total Points:</strong> 100 (Backend: 40, Frontend: 40, Integration: 20)
          </p>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="font-semibold text-foreground mb-2">
              📋 Read the full instructions:
            </p>
            <p>
              Open <code className="bg-muted px-2 py-1 rounded">INSTRUCTIONS.md</code> in the workspace root
            </p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-2">What you'll build:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>🔔 Notification bell icon with unread count badge</li>
              <li>📋 Dropdown menu showing all notifications</li>
              <li>⚡ Real-time updates using Supabase Realtime</li>
              <li>✅ Mark notifications as read functionality</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-2">Files to modify:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><code>/lib/notifications.service.ts</code> - Service layer</li>
              <li><code>/app/api/notifications/route.ts</code> - GET endpoint</li>
              <li><code>/app/api/notifications/[id]/mark-read/route.ts</code> - POST endpoint</li>
              <li><code>/hooks/use-notifications.ts</code> - React hook</li>
              <li><code>/components/notifications/notification-bell.tsx</code> - Bell UI</li>
              <li><code>/components/notifications/notification-dropdown.tsx</code> - Dropdown UI</li>
            </ul>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <p className="font-semibold text-foreground mb-2">
              ✅ Getting started:
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Read INSTRUCTIONS.md</li>
              <li>Look for TODO comments in each file</li>
              <li>Start with backend (service + API routes)</li>
              <li>Then frontend (hook + components)</li>
              <li>Run tests: <code className="bg-muted px-2 py-1 rounded">npm test</code></li>
            </ol>
          </div>

          <p className="text-sm italic">
            Note: The notification bell icon is already visible in the top-right corner.
            Complete the TODOs to make it functional!
          </p>
        </div>
      </div>
    </div>
  );
}
