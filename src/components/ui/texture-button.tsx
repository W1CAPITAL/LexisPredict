"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export type TextureButtonProps = ButtonProps & {
  textureVariant?: "default" | "accent" | "icon";
};

export const TextureButton = React.forwardRef<HTMLButtonElement, TextureButtonProps>(
  ({ className, textureVariant = "default", variant, ...props }, ref) => {
    const mapped =
      textureVariant === "accent"
        ? "default"
        : textureVariant === "icon"
          ? "outline"
          : variant || "outline";

    return (
      <Button
        ref={ref}
        variant={mapped as ButtonProps["variant"]}
        className={cn(
          "texture-btn relative overflow-hidden",
          "before:pointer-events-none before:absolute before:inset-0 before:opacity-[0.14]",
          "before:bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.85),transparent_45%),repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.035)_2px,rgba(0,0,0,0.035)_3px)]",
          textureVariant === "accent" &&
            "bg-neutral-900 text-neutral-50 hover:bg-neutral-800 border-neutral-800",
          textureVariant === "icon" && "gap-2 px-3",
          className
        )}
        {...props}
      />
    );
  }
);
TextureButton.displayName = "TextureButton";
