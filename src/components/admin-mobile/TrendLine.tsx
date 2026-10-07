"use client";

type Props = {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  label?: string;
  className?: string;
};

export function TrendLine({
  values,
  width = 120,
  height = 32,
  stroke = "var(--am-brand-500)",
  fill = "transparent",
  label,
  className,
}: Props) {
  if (values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden={!label}
        aria-label={label}
        role={label ? "img" : undefined}
        className={className}
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
      />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = 2;
  const stepX = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = padY + (1 - (v - min) / range) * (height - padY * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const area = `M0,${height} L${points
    .split(" ")
    .map((p) => p)
    .join(" L")} L${width},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden={!label}
      aria-label={label}
      role={label ? "img" : undefined}
      className={className}
      preserveAspectRatio="none"
      style={{ display: "block", maxWidth: "100%", height: "auto" }}
    >
      {fill !== "transparent" && <path d={area} fill={fill} />}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
