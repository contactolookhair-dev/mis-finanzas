import { FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";

export function BetaNotice({
  title = "Módulo en evolución",
  description
}: {
  title?: string;
  description: string;
}) {
  return (
    <Card className="rounded-[24px] border-warning/30 bg-warning/5">
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 h-4 w-4 text-warning" />
        <div>
          <p className="text-sm font-semibold text-warning">{title}</p>
          <p className="mt-1 text-sm text-neutral-600">{description}</p>
        </div>
      </div>
    </Card>
  );
}
