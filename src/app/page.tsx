import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-50">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-1 backdrop-blur-xl">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        
        <Card className="border-0 bg-transparent text-zinc-50">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                Sprint 1 Foundation Active
              </Badge>
              <span className="text-xs text-zinc-500">v0.1.0</span>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-50 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              AI Investment Research Assistant
            </CardTitle>
            <CardDescription className="text-zinc-400">
              A high-performance agentic workspace for quantitative financial analysis and real-time market insights.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Active Core Services</h3>
              <ul className="grid grid-cols-2 gap-2 text-sm text-zinc-400">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Zustand Stores
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Zod Validations
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Axios Instances
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  TypeScript Types
                </li>
              </ul>
            </div>
            <p className="text-center text-xs text-zinc-600">
              Awaiting Sprint 1 verification. Next.js App Router active.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
