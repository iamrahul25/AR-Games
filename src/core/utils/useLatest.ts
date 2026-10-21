import { useLayoutEffect, useRef } from 'react'

/** A ref that always holds the latest value (e.g. a callback prop used inside a long-lived loop). */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
