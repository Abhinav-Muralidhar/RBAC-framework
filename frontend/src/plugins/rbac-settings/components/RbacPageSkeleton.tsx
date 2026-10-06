interface RbacPageSkeletonProps {
    titleWidth?: string;
    subtitleWidth?: string;
    showToolbar?: boolean;
    showActionButton?: boolean;
    columns?: number;
    rows?: number;
}

function SkeletonLine({ className }: { className: string }) {
    return <div className={`ui-skeleton ${className}`} />;
}

export function RbacPageSkeleton({
    titleWidth = 'w-56',
    subtitleWidth = 'w-72',
    showToolbar = true,
    showActionButton = true,
    columns = 5,
    rows = 4,
}: RbacPageSkeletonProps) {
    return (
        <div className="settings-page" aria-busy="true" aria-live="polite">
            <header className="page-header">
                <div className="space-y-2">
                    <SkeletonLine className={`h-8 ${titleWidth}`} />
                    <SkeletonLine className={`h-4 ${subtitleWidth}`} />
                </div>
                {showActionButton && <SkeletonLine className="h-10 w-36" />}
            </header>

            {showToolbar && (
                <div className="page-toolbar">
                    <SkeletonLine className="h-[42px] w-full max-w-md rounded-xl" />
                    <div className="flex gap-3">
                        <SkeletonLine className="h-10 w-28 rounded-xl" />
                        <SkeletonLine className="h-10 w-28 rounded-xl" />
                    </div>
                </div>
            )}

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            {Array.from({ length: columns }).map((_, index) => (
                                <th key={index}>
                                    <SkeletonLine className="h-3 w-20 rounded-full" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: rows }).map((_, rowIndex) => (
                            <tr key={rowIndex}>
                                {Array.from({ length: columns }).map((__, columnIndex) => (
                                    <td key={columnIndex}>
                                        <SkeletonLine className="h-4 w-full rounded-full" />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function RbacFormSkeleton() {
    return (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
            <SkeletonLine className="h-6 w-48 rounded-full" />
            <SkeletonLine className="h-10 w-full rounded-xl" />
            <SkeletonLine className="h-10 w-full rounded-xl" />
            <SkeletonLine className="h-10 w-5/6 rounded-xl" />
            <SkeletonLine className="h-24 w-full rounded-2xl" />
            <SkeletonLine className="h-10 w-full rounded-xl" />
        </div>
    );
}
