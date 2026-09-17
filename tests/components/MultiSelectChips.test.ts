import { describe, expect, it } from 'vitest'
import { resolveValueToAdd, Option } from '@/components/MultiSelectChips'

/**
 * Covers the add-and-clear behaviour for MultiSelectChips's chip input
 * (defect: the raw <input> inside cmdk's <Command> broke Enter-to-add and
 * the "Add \"...\"" option). resolveValueToAdd is the pure decision function
 * both the Enter-key handler and the "Add" CommandItem's onSelect rely on,
 * so exercising it here covers the logic without needing to render cmdk.
 */
describe('resolveValueToAdd', () => {
  it('adds free-text input for a field with no options (e.g. Location)', () => {
    expect(resolveValueToAdd('Cairo, Egypt', [], [], true)).toBe('Cairo, Egypt')
  })

  it('returns null for free text when the field disallows custom values', () => {
    expect(resolveValueToAdd('Not An Option', [], [], false)).toBeNull()
  })

  const seniorityOptions: Option[] = [
    { value: 'Senior', label: 'Senior' },
    { value: 'Staff', label: 'Staff' },
  ]

  it('resolves typed text matching an existing option label to that option value', () => {
    expect(resolveValueToAdd('senior', seniorityOptions, [], false)).toBe('Senior')
  })

  it('resolves typed text matching an existing option value (case-insensitive)', () => {
    expect(resolveValueToAdd('STAFF', seniorityOptions, [], false)).toBe('Staff')
  })

  it('returns null when the resolved value is already selected (no duplicate add)', () => {
    expect(resolveValueToAdd('Senior', seniorityOptions, ['Senior'], false)).toBeNull()
    expect(resolveValueToAdd('Cairo, Egypt', [], ['Cairo, Egypt'], true)).toBeNull()
  })

  it('allows a new custom value alongside already-selected ones', () => {
    expect(resolveValueToAdd('Berlin', [], ['Cairo, Egypt'], true)).toBe('Berlin')
  })

  const skillOptions: Option[] = [
    { value: 'Python', label: 'Python', category: 'Backend' },
    { value: 'Python', label: 'Python', category: 'Data / AI' },
  ]

  it('matches a categorized option regardless of which category the typed text falls under', () => {
    expect(resolveValueToAdd('python', skillOptions, [], true)).toBe('Python')
  })
})
