import React, { useEffect, useRef, useState } from 'react';

/**
 * Scroll-reveal wrapper — fades/slides in when entering viewport.
 * @param {'up'|'left'|'right'|'fade'|'scale'} variant
 * @param {number} delay ms stagger
 * @param {boolean} once reveal only once (default true)
 */
export default function Reveal({
  children,
  className = '',
  variant = 'up',
  delay = 0,
  once = true,
  as: Tag = 'div',
  threshold = 0.14,
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

    // Already in view on first paint (hero / top of page)
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      // slight delay so transition still plays
      const t = window.setTimeout(() => setVisible(true), 40 + delay);
      return () => window.clearTimeout(t);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -6% 0px',
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
