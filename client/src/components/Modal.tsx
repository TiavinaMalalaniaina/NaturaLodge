import React, { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible name for the dialog — visually hidden if the content already shows its own heading. */
  title: string;
  children: React.ReactNode;
  /** Classes for the animated card (sizing, background, radius...). */
  className?: string;
  zIndexClassName?: string;
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({
  isOpen, onClose, title, children,
  className, zIndexClassName = 'z-[100]',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const titleId = useId();

  useEscapeKey(onClose, isOpen);

  // Focus le premier champ à l'ouverture, restitue le focus au déclencheur à la fermeture.
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      const focusable = cardRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      focusable?.focus();
    } else if (triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus();
    }
  }, [isOpen]);

  // Piège de focus : Tab/Shift+Tab reste dans le dialogue tant qu'il est ouvert.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !cardRef.current) return;
      const focusableEls = cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusableEls.length === 0) return;
      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={cn('fixed inset-0 flex items-center justify-center p-4', zIndexClassName)}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
          />

          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn('relative w-full', className)}
          >
            <span id={titleId} className="sr-only">{title}</span>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
