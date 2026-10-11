/**
 * The pages to offer, in order, on `page` of `total`: all of them, or for more than seven, the
 * first and last, `page` and the pages beside it, and a 'gap' for each run of two or more pages
 * left out. That's always seven, so the buttons stay put as the page changes.
 */
export function pageNumbers(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return pagesFrom(1, total)
  // Near either end, a gap on that side would leave out one page or none, so it's the pages.
  if (page <= 4) return [...pagesFrom(1, 5), 'gap', total]
  if (page >= total - 3) return [1, 'gap', ...pagesFrom(total - 4, total)]
  return [1, 'gap', page - 1, page, page + 1, 'gap', total]
}

function pagesFrom(first: number, last: number) {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}
