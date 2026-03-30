import { Skeleton } from "@/components/ui/skeleton";
import { CenteredLayout } from "../../shared/CenteredLayout";

export const VehiculoDetalleSkeleton = () => (
  <CenteredLayout>
    <div className="flex items-center space-x-4 mb-8">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Skeleton className="h-[200px] w-full rounded-xl" />
      <Skeleton className="h-[200px] w-full rounded-xl" />
      <Skeleton className="h-[200px] w-full rounded-xl" />
    </div>
    <Skeleton className="h-[400px] w-full rounded-xl" />
  </CenteredLayout>
);