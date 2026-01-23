export default function InsightsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <div className="bg-muted/50 rounded-2xl p-12 border-2 border-dashed border-muted-foreground/20 max-w-lg w-full">
        <div className="text-6xl mb-6 flex justify-center">🔒</div>
        <h2 className="text-2xl font-bold text-foreground mb-3">Insights Tab Locked</h2>
        <p className="text-muted-foreground mb-8">
          The Absurd Data Flywheel is stalled. Complete the mission to unlock this dashboard and restore the feedback loop.
        </p>
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 text-left">
          <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            MISSION OBJECTIVES:
          </h4>
          <ul className="text-xs space-y-2 text-muted-foreground">
            <li>• Remove this lock screen from <code>app/insights/page.tsx</code></li>
            <li>• Fetch data from <code>/api/insights/performance</code></li>
            <li>• Map and display viral scores for all scripts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

