import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { basename } from '@/core/fs/paths'
import { host, useContributions } from '@/extensions'
import { formatKeybinding } from '@/extensions/keybindings'
import { fuzzyScore, usePalette } from '@/stores/palette'
import { useWorkspace } from '@/stores/workspace'
import { FileIcon } from '@/ui/explorer/FileIcon'

interface Row {
  key: string
  label: string
  description?: string
  hint?: string
  path?: string
  run: () => void
}

export function CommandPalette() {
  const { t } = useTranslation()
  const { open, mode, initialQuery, pick, close } = usePalette()
  const commands = useContributions('commands')
  const entries = useWorkspace((s) => s.entries)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (open) {
      setQuery(initialQuery)
      setIndex(0)
      requestAnimationFrame(() => input.current?.focus())
    }
  }, [open, initialQuery, mode])

  // VS Code convention: in "Go to file", a leading ">" switches to commands.
  const effective = mode === 'pick' ? 'pick' : query.startsWith('>') ? 'commands' : 'files'
  const text = effective === 'commands' ? query.slice(1) : query

  const rows: Row[] = useMemo(() => {
    let all: Row[] = []
    if (effective === 'pick' && pick) {
      all = pick.items.map((item, i) => ({
        key: String(i),
        label: item.label,
        description: item.description,
        hint: item.detail,
        run: () => close(item),
      }))
    } else if (effective === 'commands') {
      all = commands
        .filter((c) => c.id !== 'qidea.palette.commands' && (!c.when || c.when()))
        .map((c) => {
          const title = t(c.title, { defaultValue: c.title })
          const category = c.category ? t(c.category, { defaultValue: c.category }) : undefined
          return {
            key: c.id,
            label: category ? `${category}: ${title}` : title,
            hint: c.keybinding ? formatKeybinding([c.keybinding].flat()[0]) : undefined,
            run: () => {
              close()
              void host.executeCommand(c.id)
            },
          }
        })
    } else {
      all = Object.values(entries)
        .filter((e) => e.kind === 'file')
        .map((e) => ({
          key: e.path,
          label: basename(e.path),
          description: e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/')) : undefined,
          path: e.path,
          run: () => {
            close()
            useWorkspace.getState().openFile(e.path)
          },
        }))
    }
    return all
      .map((r) => ({ r, s: fuzzyScore(text, effective === 'files' ? (r.path ?? r.label) : r.label) }))
      .filter((x): x is { r: Row; s: number } => x.s !== null)
      // Quick picks keep the order the extension gave; other lists sort by name until the user types.
      .sort((a, b) => (text.trim() ? b.s - a.s : effective === 'pick' ? 0 : a.r.label.localeCompare(b.r.label)))
      .map((x) => x.r)
  }, [effective, pick, commands, entries, text, t, close])

  useEffect(() => setIndex(0), [text, effective])

  // Escape must close the palette even before the input has received focus.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, close])
  useEffect(() => {
    list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null

  const placeholder =
    effective === 'pick'
      ? (pick?.placeholder ?? t('palette.pickPlaceholder'))
      : effective === 'commands'
        ? t('palette.commandsPlaceholder')
        : t('palette.filesPlaceholder')
  const empty =
    effective === 'files' && !Object.keys(entries).length ? t('palette.noProject') : t('palette.noResults')

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/30 px-4 pt-[12vh]" onMouseDown={() => close()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={placeholder}
        onMouseDown={(e) => e.stopPropagation()}
        className="h-fit w-[min(620px,100%)] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
      >
        <input
          ref={input}
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={rows[index] ? `palette-row-${index}` : undefined}
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(rows.length - 1, i + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(0, i - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              rows[index]?.run()
            }
          }}
          className="w-full border-b border-line bg-transparent px-4 py-3 text-[14px] text-text outline-none placeholder:text-muted focus-visible:outline-none"
        />
        <ul id="palette-list" ref={list} role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
          {rows.length === 0 && <li className="px-4 py-3 text-[13px] text-muted">{empty}</li>}
          {rows.map((r, i) => (
            <li
              key={r.key}
              id={`palette-row-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === index}
              onMouseMove={() => setIndex(i)}
              onClick={() => r.run()}
              className={`mx-1 flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-[13.5px] ${
                i === index ? 'bg-surface-2 text-text' : 'text-text'
              }`}
            >
              {r.path && <FileIcon path={r.path} />}
              <span className="truncate">{r.label}</span>
              {r.description && <span className="truncate text-[12px] text-muted">{r.description}</span>}
              {r.hint && <span className="ml-auto shrink-0 text-[12px] text-muted">{r.hint}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
