import React, { useRef, useEffect, useCallback } from "react";
import { twMerge } from "tailwind-merge";
import { type Paths, setupSvgRenderer } from "@left4code/svg-renderer";

const Frame = React.memo(({
  className,
  paths,
  ...props
}: { paths: Paths } & React.ComponentProps<"svg">) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendererInstance = useRef<ReturnType<typeof setupSvgRenderer> | null>(null);
  const initialized = useRef(false);

  // Memoize paths to prevent unnecessary re-renders
  const memoizedPaths = useRef(paths);

  const cleanupRenderer = useCallback(() => {
    if (rendererInstance.current) {
      rendererInstance.current.destroy();
      rendererInstance.current = null;
    }
    initialized.current = false;
  }, []);

  useEffect(() => {
    return () => {
      cleanupRenderer();
    };
  }, [cleanupRenderer]);

  useEffect(() => {
    if (!svgRef.current || initialized.current) return;

    // Only initialize once
    rendererInstance.current = setupSvgRenderer({
      el: svgRef.current,
      paths: memoizedPaths.current,
    });

    initialized.current = true;

    return () => {
      cleanupRenderer();
    };
  }, [cleanupRenderer]);

  return (
    <svg
      {...props}
      className={twMerge(["absolute inset-0 size-full", className])}
      xmlns="http://www.w3.org/2000/svg"
      ref={svgRef}
      key="frame-svg"
    />
  );
});

export { Frame };