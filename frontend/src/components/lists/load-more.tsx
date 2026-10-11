import { useInView } from 'react-intersection-observer'

import { Button } from '@/components/ui/button'
import { m } from '@/paraglide/messages.js'

// Starts loading the next page this far before the end of the list scrolls into view.
const PRELOAD_MARGIN = '800px'

type LoadMoreProps = {
  // Whether the next page is on its way.
  loading: boolean
  onLoadMore: () => void
}

/**
 * The end of a list with more to load: loads the next page as it nears the screen, or when its
 * button is pressed.
 */
export function LoadMore({ loading, onLoadMore }: LoadMoreProps) {
  const { ref } = useInView({
    rootMargin: PRELOAD_MARGIN,
    onChange: (inView) => {
      if (inView && !loading) onLoadMore()
    },
  })

  return (
    <div ref={ref} className="mt-8 flex justify-center">
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        disabled={loading}
        onClick={onLoadMore}
      >
        {loading ? m.common_loading_more() : m.common_load_more()}
      </Button>
    </div>
  )
}
