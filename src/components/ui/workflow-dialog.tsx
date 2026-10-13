'use client'

import { useRef, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'

/** Radix traps focus and supports Escape. These workflow dialogs are mounted
 * conditionally, so explicitly remember and restore their launching control. */
export function WorkflowDialog({ title, description, onClose, busy = false, wide = false, children }: {
  title: string
  description: string
  onClose: () => void
  busy?: boolean
  wide?: boolean
  children: ReactNode
}) {
  const launchControl = useRef<HTMLElement | null>(null)
  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
      <DialogContent
        className={`bg-card max-h-[85vh] overflow-y-auto ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        showCloseButton={!busy}
        aria-busy={busy}
        onOpenAutoFocus={() => { launchControl.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }}
        onCloseAutoFocus={event => { event.preventDefault(); if (launchControl.current?.isConnected) launchControl.current.focus() }}
        onEscapeKeyDown={event => { if (busy) event.preventDefault() }}
        onPointerDownOutside={event => { if (busy) event.preventDefault() }}
        onInteractOutside={event => { if (busy) event.preventDefault() }}
      >
        <DialogTitle className="text-sm font-semibold text-foreground pr-6">{title}</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  )
}
