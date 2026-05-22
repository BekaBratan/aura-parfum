"use client";

import { Minus, Plus } from "lucide-react";
import MlInput from "@/components/ui/MlInput";

interface QuantityControlsProps {
  value: number;
  min?: number;
  max: number;
  unit: "ml" | "pcs";
  step?: number;
  className?: string;
  size?: "sm" | "md";
  onChange: (value: number) => void;
  onDecrementBelowMin?: () => void;
  onLimitExceeded?: () => void;
}

export default function QuantityControls({
  value,
  min = 1,
  max,
  unit,
  step = 1,
  className = "",
  size = "md",
  onChange,
  onDecrementBelowMin,
  onLimitExceeded,
}: QuantityControlsProps) {
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDecrement = (e: React.MouseEvent) => {
    stop(e);
    if (value <= min) {
      onDecrementBelowMin?.();
      return;
    }
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = (e: React.MouseEvent) => {
    stop(e);
    if (value >= max) {
      onLimitExceeded?.();
      return;
    }
    onChange(Math.min(max, value + step));
  };

  const canDecrement = value > min || !!onDecrementBelowMin;
  const canIncrement = value < max;

  return (
    <div className={`qty-controls qty-controls--${size} ${className}`} onClick={stop}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={!canDecrement}
        className="icon-button qty-btn"
        aria-label="Уменьшить"
      >
        <Minus size={14} />
      </button>
      <MlInput
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        onLimitExceeded={onLimitExceeded}
        className="input qty-input"
        aria-label={unit === "ml" ? "Объём в мл" : "Количество"}
      />
      <span className="qty-unit">{unit === "ml" ? "мл" : "шт"}</span>
      <button
        type="button"
        onClick={handleIncrement}
        disabled={!canIncrement}
        className="icon-button qty-btn"
        aria-label="Увеличить"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
