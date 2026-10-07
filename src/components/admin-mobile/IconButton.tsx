"use client";

import { forwardRef } from "react";
import { Button } from "./Button";

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "ref" | "children"> & {
  label: string;
  icon: React.ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, icon, ...rest },
  ref
) {
  return (
    <Button ref={ref} variant="icon" aria-label={label} {...rest}>
      {icon}
    </Button>
  );
});
