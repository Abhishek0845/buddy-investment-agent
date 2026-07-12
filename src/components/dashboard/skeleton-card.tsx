import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="border border-border bg-card/60 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-[200px] bg-muted" />
          <Skeleton className="h-3 w-[120px] bg-muted" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-[60px] bg-muted/80" />
          <Skeleton className="h-8 w-[100px] bg-muted" />
        </div>
      </div>

      {/* Chart Skeleton */}
      <div className="h-[240px] w-full bg-card/60 border border-border rounded-xl p-5 flex flex-col justify-between">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-[100px] bg-muted" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-[60px] bg-muted" />
            <Skeleton className="h-4 w-[60px] bg-muted" />
          </div>
        </div>
        <div className="h-[120px] flex items-end gap-2 pb-4">
          <Skeleton className="h-[40%] flex-1 bg-muted/85" />
          <Skeleton className="h-[60%] flex-1 bg-muted/85" />
          <Skeleton className="h-[50%] flex-1 bg-muted/85" />
          <Skeleton className="h-[80%] flex-1 bg-muted/85" />
          <Skeleton className="h-[70%] flex-1 bg-muted/85" />
          <Skeleton className="h-[90%] flex-1 bg-muted/85" />
        </div>
      </div>

      {/* Recommendation Card Skeleton */}
      <Card className="bg-card border border-border p-5 space-y-4 rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-[120px] bg-muted" />
            <Skeleton className="h-6 w-[240px] bg-muted" />
          </div>
          <Skeleton className="h-10 w-[100px] rounded-lg bg-muted" />
        </div>
        <Skeleton className="h-3 w-full bg-muted" />
        <Skeleton className="h-3 w-2/3 bg-muted" />
      </Card>

      {/* Score Cards Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-card border border-border p-4 space-y-4 rounded-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <Skeleton className="h-4 w-[100px] bg-muted" />
              <Skeleton className="h-5 w-[40px] bg-muted" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full bg-muted" />
              <Skeleton className="h-3 w-5/6 bg-muted" />
            </div>
            <div className="border border-border rounded-lg p-2 space-y-2 mt-4 bg-muted/40">
              <Skeleton className="h-4 w-full bg-muted/80" />
              <Skeleton className="h-4 w-5/6 bg-muted/80" />
            </div>
          </Card>
        ))}
      </div>

      {/* News Card Skeleton */}
      <Card className="bg-card border border-border p-5 space-y-4 rounded-2xl">
        <Skeleton className="h-4 w-[140px] bg-muted" />
        <div className="space-y-3">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="flex justify-between items-start gap-4 py-2 border-b border-border last:border-0">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-5/6 bg-muted" />
                <Skeleton className="h-3 w-[80px] bg-muted/80" />
              </div>
              <Skeleton className="h-4 w-[40px] bg-muted/80" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
