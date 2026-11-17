import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, RotateCcw, Terminal } from 'lucide-react';

export interface SectionErrorBoundaryProps {
  key?: string | number;
  children: ReactNode;
  areaNameEn?: string;
  areaNameDv?: string;
  language?: 'en' | 'dv';
  compact?: boolean;
  isAdmin?: boolean;
  onRecover?: () => void;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  friendlyMessageEn: string;
  friendlyMessageDv: string;
  technicalSummary: string;
  componentFrame: string;
  timestampIso: string;
  showDiagnostics: boolean;
}

const BaseComponent = Component as unknown as {
  new (props: SectionErrorBoundaryProps): {
    props: Readonly<SectionErrorBoundaryProps>;
    state: SectionErrorBoundaryState;
    setState: (
      state:
        | Partial<SectionErrorBoundaryState>
        | ((prev: SectionErrorBoundaryState) => Partial<SectionErrorBoundaryState>)
    ) => void;
  };
};

function summarizeFriendlyError(error: Error | null): { en: string; dv: string } {
  const raw = error?.message || '';

  // Parse structured FirestoreErrorInfo JSON safely without exposing stack traces to patrons
  if (raw.startsWith('{') && raw.includes('"operationType"')) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.error === 'string') {
        const lower = parsed.error.toLowerCase();
        if (lower.includes('permission') || lower.includes('insufficient')) {
          return {
            en: 'Access to this record requires librarian sign-in or updated permissions. Offline cache remains available.',
            dv: 'މި މަޢުލޫމާތު ބެލުމަށް އެޑްމިން ނުވަތަ ލައިބްރޭރިއަން އެކައުންޓަކުން ލޮގިން ވާންޖެހެއެވެ.',
          };
        }
        if (lower.includes('quota') || lower.includes('exhausted')) {
          return {
            en: 'Cloud database daily write quota was reached. Reload this section to continue safely in offline cache mode.',
            dv: 'ކްލައުޑް ޑޭޓާބޭސް ކޯޓާ ހަމަވެފައިވާތީ އޮފްލައިން ކޭޝްގައި މަސައްކަތް ކުރިއަށް ގެންދެވޭނެއެވެ.',
          };
        }
      }
    } catch {
      // Fall through to generic friendly handling
    }
  }

  if (/chunk|loading css|dynamically imported module|preload/i.test(raw)) {
    return {
      en: 'A newer version of the library portal was published. Reload this section or refresh the page to fetch the latest bundle.',
      dv: 'ޕޯޓަލްގެ އައު ވަރޝަނެއް ޝާއިޢުކުރެވިއްޖެއެވެ. އަލުން ރީލޯޑް ކޮށްލައްވާ.',
    };
  }

  if (/network|offline|fetch/i.test(raw)) {
    return {
      en: 'Network connection was interrupted while loading this section. Reload this section to continue in offline-resilient mode.',
      dv: 'އިންޓަރނެޓް ގުޅުން މެދުކެނޑުނެވެ. އޮފްލައިން މޯޑުގައި ކުރިއަށް ގެންދިއުމަށް އަލުން ހުޅުއްވާ.',
    };
  }

  return {
    en: 'Something went wrong in this section. Your library records and active loans remain safely preserved.',
    dv: 'މި ބައި ދެއްކުމުގައި ކުޑަ މައްސަލައެއް ދިމާވެއްޖެއެވެ. ހުރިހާ ރެކޯޑުތަކެއް ރައްކާތެރިކަމާއެކު އެބަހުއްޓެވެ.',
  };
}

export class SectionErrorBoundary extends BaseComponent {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      friendlyMessageEn: '',
      friendlyMessageDv: '',
      technicalSummary: '',
      componentFrame: '',
      timestampIso: '',
      showDiagnostics: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<SectionErrorBoundaryState> {
    const summary = summarizeFriendlyError(error);
    return {
      hasError: true,
      friendlyMessageEn: summary.en,
      friendlyMessageDv: summary.dv,
      technicalSummary: `${error?.name || 'Error'}: ${error?.message || 'Unexpected render error'}`,
      timestampIso: new Date().toISOString(),
      showDiagnostics: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const firstFrame =
      errorInfo.componentStack
        ?.split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(' -> ') || '';
    this.setState({ componentFrame: firstFrame });
    console.warn(`[SectionErrorBoundary:${this.props.areaNameEn || 'Workspace'}]`, error.message, firstFrame);
  }

  handleRecover = () => {
    this.setState({
      hasError: false,
      friendlyMessageEn: '',
      friendlyMessageDv: '',
      technicalSummary: '',
      componentFrame: '',
      timestampIso: '',
      showDiagnostics: false,
    });
    if (this.props.onRecover) {
      this.props.onRecover();
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDv =
      this.props.language === 'dv' ||
      (typeof document !== 'undefined' && document.documentElement.lang === 'dv');
    const areaLabel = isDv
      ? this.props.areaNameDv || 'މި ބައި'
      : this.props.areaNameEn || 'This Section';

    return (
      <div
        role="alert"
        className={`bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/70 rounded-2xl shadow-xs space-y-3 ${
          this.props.compact ? 'p-4' : 'p-6 sm:p-8'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-relaxed">
                {isDv
                  ? `${areaLabel} — މައްސަލައެއް ދިމާވެއްޖެ`
                  : `Something went wrong in ${areaLabel}`}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                {isDv ? this.state.friendlyMessageDv : this.state.friendlyMessageEn}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={this.handleRecover}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isDv ? 'މި ބައި އަލުން ހުޅުވާ' : 'Reload Section'}</span>
            </button>
            {!this.props.compact && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isDv ? 'ރީލޯޑް' : 'Refresh Portal'}</span>
              </button>
            )}
          </div>
        </div>

        {this.props.isAdmin && this.state.technicalSummary && (
          <div className="pt-2 border-t border-rose-100 dark:border-rose-900/50">
            <button
              type="button"
              onClick={() =>
                this.setState((prev) => ({ showDiagnostics: !prev.showDiagnostics }))
              }
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-rose-500" />
              <span>
                {isDv ? 'ޓެކްނިކަލް ޑައިގްނޯސްޓިކް ތަފްސީލު' : 'Technical Diagnostic Details'}
              </span>
              {this.state.showDiagnostics ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {this.state.showDiagnostics && (
              <div className="mt-2 p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] space-y-1 overflow-x-auto">
                <div>
                  <span className="text-rose-400">Section:</span>{' '}
                  <bdi dir="ltr">{this.props.areaNameEn || 'Workspace'}</bdi>
                </div>
                <div>
                  <span className="text-rose-400">Timestamp:</span>{' '}
                  <bdi dir="ltr">{this.state.timestampIso}</bdi>
                </div>
                <div>
                  <span className="text-rose-400">Message:</span>{' '}
                  <bdi dir="ltr">{this.state.technicalSummary}</bdi>
                </div>
                {this.state.componentFrame && (
                  <div className="text-slate-400">
                    <span className="text-rose-400">Trace:</span>{' '}
                    <bdi dir="ltr">{this.state.componentFrame}</bdi>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}
