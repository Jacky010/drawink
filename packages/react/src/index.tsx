'use client'
import { forwardRef, useEffect, useImperativeHandle, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { Drawboard as CoreDrawboard, createHandle, type DrawboardHandle, type DrawboardOptions, type DrawingData } from '@drawink/core'
export type { ToolbarPosition, ToolbarPlacement, ExportImageOptions, BrushSettings, Viewport, Point, ToolbarIcon, BackgroundSettings, CustomShapeDefinition, ToolbarItem, BoardMode, DrawboardHandle, DrawboardOptions, DrawingData, Tool, Shape } from '@drawink/core'
export interface DrawboardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options?: Omit<DrawboardOptions, 'data' | 'onChange'>
  data?: DrawingData
  onChange?: (data: DrawingData) => void
  onReady?: (board: CoreDrawboard) => void
  children?: ReactNode
}

/** React adapter. Each effect owns exactly one instance, including StrictMode remounts. */
export const Drawboard = forwardRef<DrawboardHandle, DrawboardProps>(function Drawboard(
  { options, data, onChange, onReady, children, style, ...attrs }, ref,
) {
  const host = useRef<HTMLDivElement>(null)
  const board = useRef<CoreDrawboard | null>(null)
  const appliedData = useRef(data)
  const latest = useRef({ options, data, onChange, onReady })
  latest.current = { options, data, onChange, onReady }
  useImperativeHandle(ref, () => createHandle(() => board.current), [])
  useEffect(() => {
    const instance = new CoreDrawboard(host.current!, {
      ...latest.current.options, data: latest.current.data,
      onChange: value => latest.current.onChange?.(value),
    })
    board.current = instance
    appliedData.current = latest.current.data
    latest.current.onReady?.(instance)
    return () => { instance.destroy(); board.current = null }
  }, [])
  useEffect(() => {
    board.current?.setOptions({ ...options, onChange: value => latest.current.onChange?.(value) })
  }, [options])
  useEffect(() => {
    if (data === appliedData.current) return
    appliedData.current = data
    if (data && board.current && JSON.stringify(data) !== JSON.stringify(board.current.getData())) {
      board.current.loadData(data)
    }
  }, [data])
  return <div {...attrs} ref={host} style={{ position: 'relative', minHeight: 300, ...style }}>{children}</div>
})
