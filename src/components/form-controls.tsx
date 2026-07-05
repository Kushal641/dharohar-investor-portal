export const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#f4511e] focus:outline-none focus:ring-1 focus:ring-[#f4511e]";

export const BUTTON_CLASS =
  "rounded-md bg-[#f4511e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#d8430f]";

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className={INPUT_CLASS}
      />
    </div>
  );
}
