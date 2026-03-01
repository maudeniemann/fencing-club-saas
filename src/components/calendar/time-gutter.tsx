'use client';

import { HOUR_HEIGHT, START_HOUR, END_HOUR } from './calendar-utils';

export function TimeGutter() {
  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, i) => START_HOUR + i
  );

  return (
    <div className="relative w-14 shrink-0 border-r border-border/50">
      {hours.map((hour) => {
        const label =
          hour === 0
            ? '12 AM'
            : hour < 12
              ? `${hour} AM`
              : hour === 12
                ? '12 PM'
                : `${hour - 12} PM`;

        return (
          <div
            key={hour}
            className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground/70 tabular-nums select-none"
            style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
