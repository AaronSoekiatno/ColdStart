'use client';

import { useEffect, useState } from 'react';

type PerformanceData = {
  script_id: string;
  title: string;
  script_content: string;
  views: number;
  likes: number;
  shares: number;
  engagement_rate: number;
  viral_score: number;
  logged_at: string;
};

export default function InsightsPage() {
  const [data, setData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPerformanceData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/insights/performance');

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }

        const performanceData = await response.json();
        setData(performanceData);
      } catch (err) {
        console.error('Error fetching performance data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load insights data');
      } finally {
        setLoading(false);
      }
    }

    fetchPerformanceData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Loading insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-semibold text-destructive mb-2">Error Loading Data</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Performance Insights</h1>
        <p className="text-muted-foreground">
          Track viral scores and engagement metrics across all video scripts
        </p>
        <p className="text-muted-foreground mt-2">
          Our advanced insights engine analyzes performance data to help you understand what resonates with your audience. Use these metrics to refine your content strategy and boost engagement.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => {
          const isHighPerformer = item.viral_score > 85;

          return (
            <div
              key={item.script_id}
              className={`
                rounded-lg border p-6 transition-all hover:shadow-lg
                ${isHighPerformer
                  ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 shadow-md'
                  : 'bg-card border-border'
                }
              `}
            >
              {isHighPerformer && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary text-primary-foreground">
                    ⭐ High Performer
                  </span>
                </div>
              )}

              <h3 className="font-semibold text-lg mb-3 line-clamp-2">
                {item.title}
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Viral Score</span>
                  <span className={`text-2xl font-bold ${isHighPerformer ? 'text-primary' : ''}`}>
                    {item.viral_score.toFixed(1)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Views</div>
                    <div className="font-semibold">{item.views.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Likes</div>
                    <div className="font-semibold">{item.likes.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Shares</div>
                    <div className="font-semibold">{item.shares.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Engagement</div>
                    <div className="font-semibold">{item.engagement_rate.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No performance data available</p>
        </div>
      )}
    </div>
  );
}
