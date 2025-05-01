import { useEffect, useRef, type RefObject } from 'react';

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (container && end) {
      setTimeout(() => {
        end.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
      const observer = new MutationObserver((mutations) => {
        // Only scroll if new messages are added
        const hasNewMessage = mutations.some(mutation => {
          return Array.from(mutation.addedNodes).some(node => {
            const element = node as HTMLElement;
            return element.hasAttribute && (
              element.hasAttribute('data-role') || // New message
              element.classList?.contains('thinking-message') // Loading message
            );
          });
        });
        // Force scroll to bottom with a slight delay to ensure content is rendered
        if (hasNewMessage) {
          setTimeout(() => {
            end.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }, 100);
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      return () => observer.disconnect();
    }
  }, []);

  return [containerRef, endRef];
}
