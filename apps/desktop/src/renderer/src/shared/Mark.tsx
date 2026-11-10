import { BAR_GAP, BAR_WIDTH, BARS, PEAK_BAR } from "../../../shared/mark";

const SPAN = BARS.length * BAR_WIDTH + (BARS.length - 1) * BAR_GAP;

/**
 * The app mark, drawn from the same numbers as the window, tray and installer icons, so the one
 * in the sidebar cannot drift from the one in the taskbar. Aubergine plate, Silver bars, the
 * tallest in Marigold — fixed colours, because it is a logo and not part of the theme.
 */
export function Mark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1 1" className={className} aria-hidden="true">
      <rect x="0.06" y="0.06" width="0.88" height="0.88" rx="0.22" fill="#3a0f34" />
      {BARS.map((height, index) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: the bars are positional and never reorder
          key={index}
          x={0.5 - SPAN / 2 + index * (BAR_WIDTH + BAR_GAP)}
          y={0.5 - height / 2}
          width={BAR_WIDTH}
          height={height}
          rx={BAR_WIDTH / 2}
          fill={index === PEAK_BAR ? "#eaaa00" : "#dde3e8"}
        />
      ))}
    </svg>
  );
}
