import { CustomEndpointsSettings } from './custom-endpoints-settings'

export const PROVIDER_VIEWS = ['custom-endpoints'] as const
export type ProviderView = (typeof PROVIDER_VIEWS)[number]
interface ProvidersSettingsProps {
  onClose: () => void
  onConfigSaved?: () => void
  onMainModelChanged?: (provider: string, model: string) => void
  onViewChange: (view: ProviderView) => void
  view: ProviderView
}
export function ProvidersSettings({ onConfigSaved, onMainModelChanged }: ProvidersSettingsProps) {
  return <CustomEndpointsSettings onConfigSaved={onConfigSaved} onMainModelChanged={onMainModelChanged} />
}
