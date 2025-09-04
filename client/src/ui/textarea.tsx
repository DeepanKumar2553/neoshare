
import { Frame } from "@/ui/frame";
import { twMerge } from "tailwind-merge";

function Textarea({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={twMerge([
        "relative",
        "[--color-frame-1-stroke:var(--color-success)]/70",
        "[--color-frame-1-fill:var(--color-success)]/10",
        "[--color-frame-2-stroke:transparent]",
          "[--color-frame-2-fill:transparent]",
        "text-area w-60"
      ])}
    >
      <div className="absolute inset-0 -mb-2 [&>svg]:drop-shadow-[0_0px_20px_var(--color-primary)]">
        <Frame
          paths={JSON.parse(
            '[{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-1-stroke)","fill":"var(--color-frame-1-fill)"},"path":[["M","17","0"],["L","100% - 7","0"],["L","100% + 0","0% + 9.5"],["L","100% - 18","100% - 6"],["L","4","100% - 6"],["L","0","100% - 15"],["L","17","0"]]},{"show":true,"style":{"strokeWidth":"1","stroke":"var(--color-frame-2-stroke)","fill":"var(--color-frame-2-fill)"},"path":[["M","9","100% - 6"],["L","100% - 22","100% - 6"],["L","100% - 25","100% + 0"],["L","12","100% + 0"],["L","9","100% - 6"]]}]'
          )}
        />
      </div>
      <div>{children}</div>
    </div>
  );
}

export { Textarea };
                