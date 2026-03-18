import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

function getPageNumbers(
  currentPage: number,
  totalPages: number,
): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);
  const isPrevDisabled = currentPage <= 1;
  const isNextDisabled = currentPage >= totalPages;

  return (
    <nav
      className="flex items-center justify-center gap-1 mt-10"
      aria-label="分页"
    >
      {/* 上一页 */}
      {isPrevDisabled ? (
        <span className="px-3 py-2 text-sm font-medium text-gray-300 select-none cursor-not-allowed rounded-lg">
          ← 上一页
        </span>
      ) : (
        <Link
          href={`/?page=${currentPage - 1}`}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          ← 上一页
        </Link>
      )}

      {/* 页码 */}
      {pages.map((page, i) =>
        page === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="px-3 py-2 text-sm text-gray-400 select-none"
          >
            …
          </span>
        ) : page === currentPage ? (
          <span
            key={page}
            className="px-3 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg min-w-9 text-center"
            aria-current="page"
          >
            {page}
          </span>
        ) : (
          <Link
            key={page}
            href={`/?page=${page}`}
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-w-9 text-center"
          >
            {page}
          </Link>
        ),
      )}

      {/* 下一页 */}
      {isNextDisabled ? (
        <span className="px-3 py-2 text-sm font-medium text-gray-300 select-none cursor-not-allowed rounded-lg">
          下一页 →
        </span>
      ) : (
        <Link
          href={`/?page=${currentPage + 1}`}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          下一页 →
        </Link>
      )}
    </nav>
  );
}
