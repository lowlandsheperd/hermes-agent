import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider, useI18n } from '@/i18n'
import { armWakeWord, resumeWakeAfterVoice, toggleWakeWord, resetWakeWordState, $wakeWord } from '@/store/wake-word'
import { startClientWakeCapture } from '@/lib/wake-client-capture'
vi.mock('@/lib/wake-client-capture', () => ({ startClientWakeCapture: vi.fn() }))
beforeEach(() => {
  localStorage.clear()
  resetWakeWordState()
})
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'hermesDesktop')
})
function Language() {
  const { locale, setLocale } = useI18n()
  return <button onClick={() => void setLocale('en')}>{locale}</button>
}
test('Chinese is the client default and a language choice persists without reading or writing server config', async () => {
  const api = vi.fn()
  Object.defineProperty(window, 'hermesDesktop', { configurable: true, value: { api } })
  const first = render(
    <I18nProvider>
      <Language />
    </I18nProvider>
  )
  expect(await screen.findByRole('button', { name: 'zh' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(localStorage.getItem('hermes.desktop.language')).toBe('en'))
  first.unmount()
  render(
    <I18nProvider>
      <Language />
    </I18nProvider>
  )
  expect(await screen.findByRole('button', { name: 'en' })).toBeTruthy()
  expect(api).not.toHaveBeenCalled()
})
test('read-aloud remains off despite server auto-TTS, but honors an explicit client choice', async () => {
  vi.resetModules()
  const voice = await import('@/store/voice-prefs')
  voice.applyAutoSpeakFromConfig({ voice: { auto_tts: true } })
  expect(voice.$autoSpeakReplies.get()).toBe(false)
  await voice.setAutoSpeakReplies(true)
  voice.applyAutoSpeakFromConfig({ voice: { auto_tts: false } })
  expect(voice.$autoSpeakReplies.get()).toBe(true)
})
test('wake-word never starts or captures audio without client opt-in, even if server is listening', async () => {
  const request = vi.fn(async () => ({ available: true, enabled: true, listening: true, capture: 'client' }))
  await armWakeWord(request as any)
  await resumeWakeAfterVoice(request as any)
  expect(request.mock.calls).toHaveLength(1)
  expect($wakeWord.get().listening).toBe(false)
  expect(startClientWakeCapture).not.toHaveBeenCalled()
  const toggle = vi.fn(async () => ({ started: true, capture: 'server' }))
  await toggleWakeWord(toggle as any)
  expect(localStorage.getItem('hermes.desktop.wakeWordEnabled')).toBe('true')
})
