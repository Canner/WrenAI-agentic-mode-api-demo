"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";

export default function EChart({ option }: { option: Record<string, unknown> }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    try {
      chart.setOption(option);
    } catch {
      /* malformed spec — leave the canvas empty */
    }
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [option]);

  return <div ref={ref} className="h-80 w-full" />;
}
