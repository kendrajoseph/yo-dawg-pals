import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  readOnly?: boolean;
};

const sizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function StarRating({ value, onChange, size = "md", className, readOnly }: StarRatingProps) {
  const interactive = !readOnly && !!onChange;
  return (
    <div className={cn("flex items-center gap-1", className)} role={interactive ? "radiogroup" : undefined} aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const Btn = interactive ? "button" : "span";
        return (
          <Btn
            key={star}
            type={interactive ? "button" : undefined}
            onClick={interactive ? () => onChange?.(star) : undefined}
            aria-label={interactive ? `${star} star${star > 1 ? "s" : ""}` : undefined}
            aria-checked={interactive ? value === star : undefined}
            role={interactive ? "radio" : undefined}
            className={cn(
              "transition-transform",
              interactive && "cursor-pointer hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            <Star
              className={cn(
                sizes[size],
                filled ? "fill-tag text-tag" : "fill-transparent text-muted-foreground",
              )}
              strokeWidth={2}
            />
          </Btn>
        );
      })}
    </div>
  );
}
