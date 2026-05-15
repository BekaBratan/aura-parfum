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
    setDraft(cleaned);

    const n = parseInt(cleaned, 10);
    if (!isNaN(n) && n >= min && (max === undefined || n <= max)) {
      onChange(n);
    }
  };

  const handleBlur = () => {
    const n = parseInt(draft, 10);
    if (isNaN(n) || n < min) {
      setDraft(String(min));
      onChange(min);
    } else if (max !== undefined && n > max) {
      setDraft(String(max));
      onChange(max);
    } else {
      setDraft(String(n));
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      disabled={disabled}
      className={className}
      {...rest}
    />
  );
}
