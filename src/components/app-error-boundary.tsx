import { Component, type ReactNode } from 'react'
import { Button } from './ui/button'

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="startup-error panel" role="alert">
        <h1>Let’s reopen your workspace</h1>
        <p>
          A screen could not load. This can happen when an older tab is open
          after an update, or an application file is unavailable.
        </p>
        <p>
          Reloading does not clear your saved Explorer workspace. If this
          continues, check that the entire assets folder was uploaded with
          index.html.
        </p>
        <Button onClick={() => location.reload()}>Reload workspace</Button>
      </main>
    )
  }
}
