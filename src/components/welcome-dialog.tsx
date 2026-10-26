import { useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ClipboardCheck,
  DatabaseZap,
  GitCompareArrows,
  Package,
  Table2,
} from 'lucide-react'
import type { Page } from '@/lib/data'
import { useWorkspace } from '@/lib/workspace'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

const steps = [
  {
    title: 'Choose a connection',
    icon: DatabaseZap,
    text: 'Try the local lab with synthetic data, or add your FileMaker host and database using OData or Data API. Enter account details or a token locally in the app.',
    action: 'Open connections',
    page: null,
  },
  {
    title: 'Explore what the API exposes',
    icon: Table2,
    text: 'Open a resource to inspect fields and types. Browse a bounded record page and review available relationships. Missing metadata stays unknown; this is the structure visible to your connection.',
    action: 'Open schema explorer',
    page: 'schema',
  },
  {
    title: 'Save an integration check',
    icon: ClipboardCheck,
    text: 'Build a read query, then save it with the fields, types, and minimum row count your integration expects. Run the check to see what passes or needs attention.',
    action: 'Open query builder',
    page: 'query',
  },
  {
    title: 'Review changes over time',
    icon: GitCompareArrows,
    text: 'Each connection or schema refresh preserves a dated version. Compare inspections and review saved requests that reference changed fields. The local lab includes an illustrative change example.',
    action: 'Open schema history',
    page: 'history',
  },
  {
    title: 'Hand over the knowledge',
    icon: Package,
    text: 'Choose resources, add developer notes, and preview a handoff ZIP with schema, types, read examples, and context. Credentials and record rows are excluded; saved filter values are redacted by default.',
    action: 'Open handoff package',
    page: 'handoff',
  },
] as const

export function WelcomeDialog({
  open,
  onOpenChange,
  onNavigate,
  onConnections,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (page: Page) => void
  onConnections: () => void
}) {
  const w = useWorkspace(),
    [guide, setGuide] = useState(false),
    [step, setStep] = useState(0)
  const current = steps[step],
    StepIcon = current.icon
  const focus = useRef<HTMLHeadingElement>(null)
  function dismiss() {
    onOpenChange(false)
  }
  function openStep() {
    dismiss()
    if (current.page) onNavigate(current.page)
    else onConnections()
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="welcome-dialog"
        onOpenAutoFocus={(event) => {
          if (focus.current) {
            event.preventDefault()
            focus.current.focus({ preventScroll: true })
          }
        }}
      >
        <div className="welcome-scroll">
          <div className="welcome-kicker">
            <span className="welcome-mark">
              <DatabaseZap size={23} />
            </span>
            <span>
              FM API Explorer<span>A workbench by Alex Seidler</span>
            </span>
          </div>
          <DialogHeader>
            <DialogTitle ref={focus} tabIndex={-1}>
              {guide
                ? 'A practical path from connection to handoff.'
                : 'Understand your FileMaker API. Build with a clearer picture.'}
            </DialogTitle>
            <DialogDescription>
              {guide
                ? 'Five optional steps. Open a screen when you are ready, or close the guide and explore. Reopen it from Help & shortcuts.'
                : 'See what your connection exposes, check what your integration expects, and give the next developer—or AI assistant—a documented starting point.'}
            </DialogDescription>
          </DialogHeader>
          {guide ? (
            <section className="welcome-guide" aria-label="Quick start guide">
              <div
                className="welcome-progress"
                aria-label={`Step ${step + 1} of ${steps.length}`}
              >
                {steps.map((item, index) => (
                  <button
                    key={item.title}
                    aria-label={`Step ${index + 1}: ${item.title}`}
                    aria-current={step === index ? 'step' : undefined}
                    className={
                      index === step
                        ? 'current'
                        : index < step
                          ? 'complete'
                          : ''
                    }
                    onClick={() => setStep(index)}
                  >
                    {index < step ? <Check size={16} /> : index + 1}
                  </button>
                ))}
              </div>
              <div className="welcome-step" aria-live="polite">
                <span className="welcome-step-icon">
                  <StepIcon size={24} />
                </span>
                <p className="welcome-step-count">
                  Step {step + 1} of {steps.length}
                </p>
                <h3>{current.title}</h3>
                <p>{current.text}</p>
                <Button variant="outline" onClick={openStep}>
                  {current.action}
                  <ArrowUpRight size={15} />
                </Button>
              </div>
              <div className="welcome-guide-controls">
                <Button variant="ghost" onClick={() => setGuide(false)}>
                  <ArrowLeft size={14} />
                  Welcome
                </Button>
                <div>
                  <Button
                    variant="outline"
                    disabled={step === 0}
                    onClick={() => setStep((index) => Math.max(0, index - 1))}
                  >
                    Back
                  </Button>
                  {step < steps.length - 1 ? (
                    <Button
                      onClick={() =>
                        setStep((index) =>
                          Math.min(steps.length - 1, index + 1),
                        )
                      }
                    >
                      Next
                      <ArrowRight size={14} />
                    </Button>
                  ) : (
                    <Button onClick={dismiss}>
                      Finish guide
                      <Check size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <div className="welcome-benefits">
              <div>
                <Table2 size={21} />
                <strong>Understand the API</strong>
                <p>
                  Inspect accessible resources, fields, types, and exposed
                  relationships.
                </p>
              </div>
              <div>
                <ClipboardCheck size={21} />
                <strong>Review integration changes</strong>
                <p>Save read checks and compare dated schema inspections.</p>
              </div>
              <div>
                <Package size={21} />
                <strong>Make handoffs useful</strong>
                <p>
                  Export types, examples, and reviewed developer knowledge
                  together.
                </p>
              </div>
            </div>
          )}
          <section className="welcome-credit" aria-label="About the creator">
            <div>
              <span className="welcome-avatar" aria-hidden="true">
                AS
              </span>
              <div>
                <p>
                  Created by <strong>Alex Seidler</strong>
                </p>
                <h3>RGC Data Solutions</h3>
              </div>
            </div>
            <p>
              Custom FileMaker ↔ web ↔ mobile integrations, hosting, and complex
              development projects.
            </p>
            <a
              href="https://rgcdata.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Build something with RGC Data Solutions
              <ArrowUpRight size={17} />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </section>
          <div className="welcome-footer">
            <label>
              <input
                type="checkbox"
                checked={w.welcomeHidden}
                onChange={(event) =>
                  void w.setWelcomeHidden(event.target.checked)
                }
              />
              Don’t show this on startup
            </label>
            {!guide && (
              <div className="welcome-actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep(0)
                    setGuide(true)
                  }}
                >
                  Quick start guide
                </Button>
                <Button onClick={dismiss}>
                  Explore workspace
                  <ArrowRight size={15} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
