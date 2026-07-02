interface SkeletonBarsProps {
  count?: number
}

export function SkeletonBars({ count = 4 }: SkeletonBarsProps) {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-mc-sm bg-mc-canvas-alt animate-pulse"
          style={{ width: `${70 + (i % 3) * 10}%` }}
        />
      ))}
    </div>
  )
}
