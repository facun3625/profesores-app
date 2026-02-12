export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={`animate-pulse rounded-md bg-gray-200 ${className || ""}`}
            aria-label="Loading..."
        />
    );
}

export function StatCardSkeleton() {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="mt-2 h-9 w-16" />
            <Skeleton className="mt-1 h-3 w-32" />
            <Skeleton className="mt-4 h-5 w-28" />
        </div>
    );
}

export function ActionCardSkeleton() {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-5 shadow-sm">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-1 h-4 w-full" />
            <Skeleton className="mt-4 h-9 w-24" />
        </div>
    );
}
