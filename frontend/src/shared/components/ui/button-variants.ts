import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_18px_40px_-20px_hsl(var(--primary)/0.85)] hover:-translate-y-0.5 hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_16px_34px_-20px_hsl(var(--destructive)/0.85)] hover:-translate-y-0.5 hover:bg-destructive/90",
        outline:
          "border border-input/80 bg-white/80 text-foreground shadow-[0_14px_30px_-22px_rgba(15,23,42,0.28)] backdrop-blur-sm hover:-translate-y-0.5 hover:bg-white hover:text-foreground",
        secondary:
          "border border-white/60 bg-secondary text-secondary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary/85",
        ghost: "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
