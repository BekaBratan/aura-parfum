"use client";

import { useEffect, useState } from "react";

interface MlInputProps {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  onChange: (value: number) => void;
  onLimitExceeded?: () => void;
}

/**
 * Number input that allows free typing/clearing.
 * Shows a local string draft so the user can clear the field and type a new value.
 * Applies the new value to the store only when it is valid.
 * On blur, resets to the last valid value if the field is empty or out of range.
 */
export default function MlInput({
  value,
  min = 1,
  max,
  disabled,
  className,
  onChange,
  onLimitExceeded,
  ...rest
}: MlInputProps) {
  const [draft, setDraft] = useState(String(value));

  // Keep draft in sync when value changes from outside
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const handleChange = (raw: string) => {
    // Allow empty string and digits only while typing
    const cleaned = raw.replace(/\D/g, "");
    const n = parseInt(cleaned, 10);

    // If user typed a number above max, reject it: revert draft to the last valid value
    if (!isNaN(n) && max !== undefined && n > max) {
      setDraft(String(value));
      onLimitExceeded?.();
      return;
    }

    setDraft(cleaned);

    if (!isNaN(n) && n >= min) {
      onChange(n);
    }
  };

  const handleBlur = () => {
    const n = parseInt(draft, 10);
    if (isNaN(n) || n < min) {
      // Empty/too-small → restore last valid value (don't reset to min)
      setDraft(String(value));
    } else if (max !== undefined && n > max) {
      // Out of range → restore last valid value, notify
      setDraft(String(value));
      onLimitExceeded?.();
    } else {
      setDraft(String(n));
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      size={Math.max(String(draft).length || 1, 4)}
      value={draft}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      disabled={disabled}
      className={className}
      {...rest}
    />
  );
}
