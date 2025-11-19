/**
 * Loading state for week dagdelen page
 * Displays skeleton UI while data is being fetched
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="px-6 py-4 animate-pulse">
          {/* Back button skeleton */}
          <div className="h-5 w-64 bg-gray-200 rounded mb-3"></div>
          
          {/* Title skeleton */}
          <div className="h-8 w-96 bg-gray-200 rounded mb-2"></div>
          
          {/* Subtitle skeleton */}
          <div className="h-4 w-80 bg-gray-200 rounded"></div>
        </div>
      </div>

      {/* Action Bar Skeleton */}
      <div className="sticky top-[80px] z-10 bg-gray-50 border-b border-gray-200">
        <div className="px-6 py-4 animate-pulse">
          <div className="flex items-center justify-between gap-4">
            {/* Filter buttons skeleton */}
            <div className="flex items-center gap-3">
              <div className="h-8 w-24 bg-gray-200 rounded"></div>
              <div className="h-8 w-24 bg-gray-200 rounded"></div>
              <div className="h-8 w-24 bg-gray-200 rounded"></div>
            </div>
            
            {/* Export button skeleton */}
            <div className="h-10 w-40 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        {/* Legenda Skeleton */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm animate-pulse">
          <div className="h-5 w-32 bg-gray-200 rounded mb-3"></div>
          <div className="flex flex-wrap gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 rounded"></div>
                <div className="h-3 w-24 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="animate-pulse">
              {/* Table header skeleton */}
              <div className="h-6 w-48 bg-gray-200 rounded mb-4 mx-auto"></div>
              
              {/* Grid skeleton - 7 columns (days) x 4 rows (dagdelen) */}
              <div className="grid grid-cols-7 gap-4">
                {[...Array(28)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
            
            {/* Loading text */}
            <div className="mt-6 text-center">
              <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
