import type { ToolbarIcon } from '@drawink/core'
/** Try this map as demoOptions.toolbarIcons in demoState.ts. */
export const iconExamples: Record<string, ToolbarIcon> = {
  pen: {
    type: 'image',
    src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 16l-1 5 5-1L20 8l-4-4L4 16zm10-10l4 4" fill="none" stroke="#7863d7" stroke-width="2"/></svg>'),
  },
  pan: {
    type: 'svg',
    content: '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M8 7l4-4 4 4M7 8l-4 4 4 4M17 8l4 4-4 4M8 17l4 4 4-4" stroke="currentColor" fill="none" stroke-width="1.6"/></svg>',
  },
  // For a real icon font, import its stylesheet and use its class/glyph.
  select: { type: 'font', className: 'drawink-demo-iconfont', text: '✥' },
}
