import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  icon: LucideIcon;
  iconColor?: string;
  description?: string;
}

export function StatCard({
  title,
  value,
  change,
  changePositive,
  icon: Icon,
  iconColor = "text-primary",
  description,
}: StatCardProps) {
  return (
    <Card className="shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums leading-none">{value}</p>
            {change && (
              <p
                className={cn(
                  "mt-1.5 text-xs font-medium flex items-center gap-1",
                  changePositive ? "text-[color:var(--brand-success)]" : "text-destructive"
                )}
              >
                <span className="font-bold">{changePositive ? "↑" : "↓"} {change}</span>
                <span className="text-muted-foreground font-normal">vs yesterday</span>
              </p>
            )}
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className={cn("flex-shrink-0 p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors", iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
