import React, { useEffect, useRef, useState } from 'react';

/**
 * Scroll-reveal wrapper — fades/slides in when entering viewport both scrolling down & up.
 * @param {'up'|'left'|'right'|'fade'|'scale'} variant
 * @param {number} delay ms stagger
 * @param {boolean} once reveal only once (default false for bi-directional scroll animation)
 */
export default function Reveal({
  children,
  className = '',
  variant = 'up',
  delay = 0,
  once = false,
  as: Tag = 'div',
  threshold = 0.1,
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          // Reset when leaving viewport so scrolling back up or down re-triggers smooth animation
          setVisible(false);
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -4% 0px',
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, once, threshold]);

  return (
    <Tag
      ref={ref}
      className={`reveal reveal-${variant}${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={{
        transitionDelay: visible ? `${delay}ms` : '0ms',
      }}
    >
      {children}
    </Tag>
  );
}
