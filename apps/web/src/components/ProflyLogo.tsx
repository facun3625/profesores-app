function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

export function ProflyLogo({ className = "h-7 w-auto" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 54.59 20.68"
            className={cn("fill-current transition-colors duration-300", className)}
            xmlns="http://www.w3.org/2000/svg"
        >
            <text
                transform="translate(0 15.76)"
                className="font-logo"
                style={{
                    fontSize: "18.54px",
                    fontWeight: 500,
                }}
            >
                <tspan style={{ letterSpacing: "-.04em" }} x="0" y="0">p</tspan>
                <tspan style={{ letterSpacing: "-.05em" }} x="11.98" y="0">r</tspan>
                <tspan style={{ letterSpacing: "-.04em" }} x="18.84" y="0">o</tspan>
                <tspan style={{ letterSpacing: "-.09em" }} x="29.4" y="0">f</tspan>
                <tspan x="36.8" y="0">ly</tspan>
            </text>
        </svg>
    );
}
