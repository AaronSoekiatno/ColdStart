/**
 * Pagination helper utilities for client-side pagination
 * Used to slice arrays and calculate pagination metadata
 */

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationInfo;
}

/**
 * Paginate an array and return the requested page with metadata
 * 
 * @param items - Full array of items to paginate
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Sliced items for the requested page with pagination info
 */
export function paginateArray<T>(
  items: T[],
  page: number,
  limit: number
): PaginatedResult<T> {
  // Validate inputs
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  
  // Calculate pagination
  const total = items.length;
  const totalPages = Math.ceil(total / safeLimit);
  const offset = (safePage - 1) * safeLimit;
  
  // Slice array for requested page
  const pageItems = items.slice(offset, offset + safeLimit);
  
  return {
    items: pageItems,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      hasMore: safePage < totalPages,
    },
  };
}

/**
 * Calculate pagination metadata without slicing the array
 * 
 * @param totalItems - Total number of items
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Pagination metadata
 */
export function calculatePagination(
  totalItems: number,
  page: number,
  limit: number
): PaginationInfo {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.ceil(totalItems / safeLimit);
  
  return {
    page: safePage,
    limit: safeLimit,
    total: totalItems,
    totalPages,
    hasMore: safePage < totalPages,
  };
}
