import { Wordmark } from './wordmark'

export type IntroProps = {
  personality?: string
  seed?: number
}

/** The client brand stays consistent across new conversations and personalities. */
export function Intro(_props: IntroProps) {
  return (
    <div
      className="pointer-events-none flex w-full min-w-0 flex-col items-center justify-center px-0.5 py-6 text-center text-muted-foreground sm:px-6 lg:px-8"
      data-slot="aui_intro"
    >
      <div className="w-full min-w-0">
        <Wordmark text="CEDAR AGENT" />
      </div>
    </div>
  )
}
