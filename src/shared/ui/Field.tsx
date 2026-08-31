/**
 * A labelled input. Exists because the 40-line rule kept catching panels
 * whose length was entirely label/input boilerplate — which is exactly the
 * kind of "extract the named sub-step" the rule is supposed to force, and
 * the panels read better for it.
 */

export function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  mono = false,
  placeholder,
  disabled,
  min,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password" | "number";
  mono?: boolean;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
}) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        className={mono ? "mono" : undefined}
        disabled={disabled}
        id={id}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </>
  );
}
