import type { ReactNode } from "react";

type PolicyAcceptanceCheckboxProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
};

const classes = {
  row: "flex gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3",
  checkbox: "mt-1 h-4 w-4 shrink-0 rounded border-zinc-300",
  label: "text-sm text-zinc-800",
} as const;

// One affirmative, never-pre-checked opt-in. Callers pass the exact
// acceptance wording, with links to the documents, as children.
const PolicyAcceptanceCheckbox = (props: PolicyAcceptanceCheckboxProps) => {
  const { id, checked, onChange, disabled = false, children } = props;

  return (
    <label className={classes.row} htmlFor={id}>
      <input
        id={id}
        className={classes.checkbox}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className={classes.label}>{children}</span>
    </label>
  );
};

export default PolicyAcceptanceCheckbox;
