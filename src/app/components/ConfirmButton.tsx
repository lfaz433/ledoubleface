import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfirmButtonProps {
  label: React.ReactNode;
  onConfirm: () => void;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  className?: string;
  confirmClassName?: string;
  cancelClassName?: string;
  disabled?: boolean;
}

export function ConfirmButton({
  label,
  onConfirm,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  className = "px-3 py-1.5 bg-[#C8102E] hover:opacity-90 text-white rounded text-xs font-mono font-bold tracking-wider transition-all",
  confirmClassName = "px-3 py-1.5 bg-[#C8102E] hover:opacity-90 text-white rounded text-xs font-mono font-bold tracking-wider transition-all",
  cancelClassName = "px-3 py-1.5 bg-transparent border border-[#2A1E15] text-[#8E7E70] hover:text-white rounded text-xs font-mono font-bold tracking-wider transition-all",
  disabled = false,
}: ConfirmButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsConfirming(false);
    }, 4000); // Revert after 4 seconds
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setIsConfirming(true);
    startTimer();
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsConfirming(false);
    onConfirm();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsConfirming(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="inline-flex items-center gap-2 select-none">
      <AnimatePresence mode="wait">
        {!isConfirming ? (
          <motion.button
            key="initial"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={handleClick}
            disabled={disabled}
            className={`${className} cursor-pointer`}
          >
            {label}
          </motion.button>
        ) : (
          <motion.div
            key="confirm-actions"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <button
              onClick={handleConfirm}
              className={`${confirmClassName} cursor-pointer shadow-lg shadow-[#C8102E]/25`}
            >
              {confirmLabel}
            </button>
            <button
              onClick={handleCancel}
              className={`${cancelClassName} cursor-pointer`}
            >
              {cancelLabel}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
