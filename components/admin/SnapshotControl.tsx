'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Camera, Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SnapshotControlProps {
  sessionId: string;
  className?: string;
}

interface SnapshotMetrics {
  totalSize: number;
  fileCount: number;
  collectionTime: number;
}

interface SnapshotResult {
  success: boolean;
  snapshotId?: string;
  storagePath?: string;
  size?: number;
  url?: string;
  metrics?: SnapshotMetrics;
  error?: string;
}

export function SnapshotControl({ sessionId, className }: SnapshotControlProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<SnapshotResult | null>(null);
  const { toast } = useToast();

  const createSnapshot = async () => {
    setIsCreating(true);

    try {
      const response = await fetch('/api/snapshots/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          trigger: 'manual',
          message: 'Manual snapshot from admin UI',
        }),
      });

      const data: SnapshotResult = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create snapshot');
      }

      setLastSnapshot(data);

      // Format size for display
      const sizeMB = data.size ? (data.size / 1024 / 1024).toFixed(2) : '0';
      const timeSec = data.metrics?.collectionTime
        ? (data.metrics.collectionTime / 1000).toFixed(2)
        : '0';

      toast({
        title: 'Snapshot Created',
        description: `Created snapshot (${sizeMB}MB, ${data.metrics?.fileCount || 0} files) in ${timeSec}s`,
        variant: 'default',
      });
    } catch (error: any) {
      console.error('[Snapshot Control] Failed to create snapshot:', error);

      toast({
        title: 'Snapshot Failed',
        description: error.message || 'Failed to create snapshot',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const downloadSnapshot = () => {
    if (!sessionId) {
      toast({
        title: 'Error',
        description: 'Session ID is required',
        variant: 'destructive',
      });
      return;
    }

    // Open download URL in new tab
    const downloadUrl = `/api/snapshots/download?sessionId=${sessionId}`;
    window.open(downloadUrl, '_blank');

    toast({
      title: 'Downloading',
      description: 'Snapshot download started',
      variant: 'default',
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Workspace Snapshot
        </CardTitle>
        <CardDescription>
          Create and download snapshots of the workspace files
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={createSnapshot}
            disabled={isCreating}
            className="flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Create Snapshot
              </>
            )}
          </Button>

          <Button
            onClick={downloadSnapshot}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Latest
          </Button>
        </div>

        {lastSnapshot && lastSnapshot.success && (
          <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-green-900 dark:text-green-100">
                  Last snapshot created successfully
                </p>
                <div className="text-green-700 dark:text-green-300 space-y-0.5">
                  <p>
                    Size: {lastSnapshot.size ? (lastSnapshot.size / 1024 / 1024).toFixed(2) : '0'} MB
                  </p>
                  <p>Files: {lastSnapshot.metrics?.fileCount || 0}</p>
                  <p>
                    Time: {lastSnapshot.metrics?.collectionTime ? (lastSnapshot.metrics.collectionTime / 1000).toFixed(2) : '0'}s
                  </p>
                  {lastSnapshot.storagePath && (
                    <p className="text-xs font-mono truncate">
                      Path: {lastSnapshot.storagePath}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {lastSnapshot && !lastSnapshot.success && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-red-900 dark:text-red-100">
                  Snapshot creation failed
                </p>
                <p className="text-red-700 dark:text-red-300">
                  {lastSnapshot.error || 'Unknown error'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Snapshots exclude build artifacts, dependencies, and other junk files.
          </p>
          <p>Maximum snapshot size: 100MB</p>
        </div>
      </CardContent>
    </Card>
  );
}
