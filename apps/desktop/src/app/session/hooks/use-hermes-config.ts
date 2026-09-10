import { requestGatewayForAgent, requestGatewayForProfile } from '@/store/gateway'
import { $activeGatewayProfile, $newChatProfile, resolveNewChatOwnerRoute } from '@/store/profile'
import { type MutableRefObject, useCallback, useRef, useState } from 'react'

import { setTerminalFontFamilyFromConfig } from '@/app/right-sidebar/terminal/terminal-font'
import { getHermesConfig, getHermesConfigDefaults } from '@/hermes'
import { BUILTIN_PERSONALITIES, normalizePersonalityValue, personalityNamesFromConfig } from '@/lib/chat-runtime'
import { normalize } from '@/lib/text'
import { setDisplayTimestampsFromConfig } from '@/store/display-timestamps'
import {
  getComposerSelectionGeneration,
  getCurrentModelSource,
  setAvailablePersonalities,
  setCurrentFastMode,
  setCurrentPersonality,
  setCurrentReasoningEffort,
  setCurrentServiceTier,
  setDefaultReasoningEffort,
  setIntroPersonality
} from '@/store/session'
import {
  applyAutoSpeakFromConfig,
  applyThinkingSoundFromConfig,
  applyVoiceStopPhraseFromConfig
} from '@/store/voice-prefs'

const DEFAULT_VOICE_SECONDS = 120
const FAST_TIERS = new Set(['fast', 'priority', 'on'])

function recordingLimit(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : DEFAULT_VOICE_SECONDS
}

/** config.yaml hands back whatever the user wrote — `reasoning_effort: false`
 *  (or `off`/`no`, which YAML also parses to boolean false) means thinking
 *  disabled, and a bare boolean must not throw on `.trim()`. */
function normalizeConfigEffort(value: unknown): string {
  if (value === false) {
    return 'none'
  }

  if (typeof value !== 'string') {
    return ''
  }

  const effort = normalize(value)

  return effort === 'false' || effort === 'disabled' ? 'none' : effort
}

interface HermesConfigOptions {
  activeSessionIdRef: MutableRefObject<string | null>
}

export function useHermesConfig({ activeSessionIdRef }: HermesConfigOptions) {
  const [voiceMaxRecordingSeconds, setVoiceMaxRecordingSeconds] = useState(DEFAULT_VOICE_SECONDS)
  const [sttEnabled, setSttEnabled] = useState(true)
  const profileRefreshEpochRef = useRef(0)

  const refreshHermesConfig = useCallback(
    async (force = false, shouldPublish: () => boolean = () => true) => {
      if (force) {
        profileRefreshEpochRef.current += 1
      }

      const profileRefreshEpoch = profileRefreshEpochRef.current
      const selectionGeneration = getComposerSelectionGeneration()

      try {
        const route = resolveNewChatOwnerRoute()
        const profile = route?.profile || $newChatProfile.get() || $activeGatewayProfile.get() || 'default'
        type Policy = { default_effort?: string }
        const policyRequest = route
          ? requestGatewayForAgent<Policy>(route.connectionId, route.profile, 'config.get', {
              key: 'reasoning',
              profile: route.targetProfile || profile
            })
          : requestGatewayForProfile<Policy>(profile, 'config.get', { key: 'reasoning' })
        const [config, defaults, policy] = await Promise.all([
          getHermesConfig(),
          getHermesConfigDefaults().catch(() => ({})),
          policyRequest.catch(() => null)
        ])

        const canPublish = () => profileRefreshEpochRef.current === profileRefreshEpoch && shouldPublish()

        if (!canPublish()) {
          return
        }

        const personality = normalizePersonalityValue(
          typeof config.display?.personality === 'string' ? config.display.personality : ''
        )

        if (!canPublish()) {
          return
        }

        setIntroPersonality(personality)
        // Active sessions keep their per-session value; standalone falls back to config.
        setCurrentPersonality(prev => (activeSessionIdRef.current ? prev || personality : personality))
        setAvailablePersonalities([
          ...new Set([
            'none',
            ...BUILTIN_PERSONALITIES,
            ...personalityNamesFromConfig(defaults),
            ...personalityNamesFromConfig(config)
          ])
        ])

        const reasoning = policy?.default_effort || normalizeConfigEffort(config.agent?.reasoning_effort)
        const tier = (config.agent?.service_tier ?? '').trim()

        // Publish the profile default regardless of whether the composer is
        // reseeded below: picker rows and preset application resolve "the
        // default" from here, so a manual model pick must not leave them
        // rendering/applying Hermes' built-in medium over the user's config.
        if (!canPublish()) {
          return
        }

        setDefaultReasoningEffort(reasoning)

        const shouldSeedComposer =
          !activeSessionIdRef.current &&
          getComposerSelectionGeneration() === selectionGeneration &&
          (force || getCurrentModelSource() !== 'manual')

        if (shouldSeedComposer) {
          if (!canPublish()) {
            return
          }

          setCurrentReasoningEffort(reasoning)
          setCurrentFastMode(FAST_TIERS.has(tier.toLowerCase()))
        }

        if (!canPublish()) {
          return
        }

        setCurrentServiceTier(prev => (activeSessionIdRef.current ? prev : tier))

        if (!canPublish()) {
          return
        }

        setVoiceMaxRecordingSeconds(recordingLimit(config.voice?.max_recording_seconds))
        setSttEnabled(config.stt?.enabled !== false)

        if (!canPublish()) {
          return
        }

        setDisplayTimestampsFromConfig(config.display?.timestamps)
        setTerminalFontFamilyFromConfig(config.terminal?.font_family)

        if (!canPublish()) {
          return
        }

        applyAutoSpeakFromConfig(config)
        applyVoiceStopPhraseFromConfig(config)
        applyThinkingSoundFromConfig(config)
      } catch {
        // Config is nice-to-have; chat still works without it.
      }
    },
    [activeSessionIdRef]
  )

  return { refreshHermesConfig, sttEnabled, voiceMaxRecordingSeconds }
}
