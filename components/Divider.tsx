type DividerProps = {
  orientation?: "horizontal" | "vertical";
  className?: string;
};

/** 1px hairline in --ll-line. */
export function Divider({
  orientation = "horizontal",
  className = "",
}: DividerProps) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={`w-px self-stretch bg-line ${className}`}
      />
    );
  }
  return <hr className={`border-line ${className}`} />;
}
