import React from 'react';

export default function AIWritingAssistant({
  grammarState,
  enhancementState,
  summaryState,
  completionState,
  suggestionsState,
  onCheckGrammar,
  onEnhanceText,
  onGenerateSummary,
  onGetSuggestions,
  onGetCompletion,
  onApplyEnhancement,
  onInsertCompletion,
  selectionText,
  onApplyGrammarFixes,
}) {
  const completion = completionState?.data?.completion?.trim() || '';
  const improved = enhancementState?.data?.improved?.trim() || '';
  const correctedText = grammarState?.data?.correctedText?.trim() || '';
  
  // Debug logging
  React.useEffect(() => {
    if (completionState?.data) {
      console.log('[AI Assistant] Completion data:', completionState.data);
    }
  }, [completionState]);
  
  React.useEffect(() => {
    if (suggestionsState?.data) {
      console.log('[AI Assistant] Suggestions data:', suggestionsState.data);
    }
  }, [suggestionsState]);

  return (
    <aside className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 space-y-4 lg:w-96">
      <header className="border-b border-gray-100 pb-3">
        <p className="text-xs uppercase tracking-wide text-indigo-500 font-semibold">AI Writing Assistant</p>
        <p className="text-sm text-gray-500 mt-1">Click buttons to generate insights</p>
      </header>

      <PanelCard
        title="Grammar & Style"
        description="Check grammar, spelling, and tone."
        action={
          <div className="flex items-center gap-2">
            {correctedText && grammarState?.data?.corrections?.length > 0 && (
              <button
                onClick={() => onApplyGrammarFixes?.()}
                className="text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
              >
                Apply Fixes
              </button>
            )}
            <button
              onClick={onCheckGrammar}
              disabled={grammarState?.status === 'loading'}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {grammarState?.status === 'loading' ? 'Checking...' : 'Check'}
            </button>
          </div>
        }
      >
        {grammarState?.error && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <p className="font-medium">ℹ️ {grammarState.error}</p>
          </div>
        )}
        {grammarState?.data?.corrections?.length ? (
          <div className="space-y-3">
            {grammarState.data.overallScore !== undefined && (
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-xs font-medium text-gray-600">Overall Score</span>
                <span className={`text-sm font-bold ${
                  grammarState.data.overallScore >= 80 ? 'text-green-600' :
                  grammarState.data.overallScore >= 60 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {grammarState.data.overallScore}/100
                </span>
              </div>
            )}
            <ul className="space-y-3 max-h-80 overflow-y-auto">
              {grammarState.data.corrections.map((item, idx) => (
                <li key={`${item.issue}-${idx}`} className="p-3 border border-gray-100 rounded-xl bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {item.type || 'ISSUE'}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.severity === 'error'
                        ? 'bg-red-100 text-red-700'
                        : item.severity === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.severity || 'info'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 font-medium">{item.issue}</p>
                  {item.original && item.corrected && (
                    <div className="mt-2 text-sm">
                      <p className="text-red-600">
                        <span className="font-semibold">Wrong:</span> <span className="line-through">{item.original}</span>
                      </p>
                      <p className="text-green-600">
                        <span className="font-semibold">Fix:</span> {item.corrected}
                      </p>
                    </div>
                  )}
                  {!item.original && item.suggestion && (
                    <p className="text-sm text-emerald-700 mt-1.5">
                      <span className="font-semibold">→</span> {item.suggestion}
                    </p>
                  )}
                  {item.explanation && (
                    <p className="text-xs text-gray-500 mt-1 italic">{item.explanation}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : grammarState?.status === 'ready' ? (
          <div className="p-4 text-center bg-green-50 rounded-xl border border-green-100">
            <p className="text-2xl mb-1">✓</p>
            <p className="text-sm font-medium text-green-700">No issues detected!</p>
          </div>
        ) : grammarState?.status === 'empty' ? (
          <EmptyState text="Start typing to check grammar." />
        ) : (
          <EmptyState text="Click 'Check' to analyze grammar." />
        )}
      </PanelCard>

      <PanelCard
        title="Text Enhancement"
        description={selectionText ? 'Rewrite the highlighted selection.' : 'Improve the overall passage.'}
        action={
          <div className="flex items-center gap-2">
            {improved && (
              <button
                onClick={() => onApplyEnhancement?.(improved)}
                className="text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
              >
                Apply
              </button>
            )}
            <button
              onClick={onEnhanceText}
              disabled={enhancementState?.status === 'loading'}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {enhancementState?.status === 'loading' ? 'Enhancing...' : 'Enhance'}
            </button>
          </div>
        }
      >
        {enhancementState?.error && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <p className="font-medium">ℹ️ {enhancementState.error}</p>
          </div>
        )}
        {improved ? (
          <div className="space-y-3">
            <div className="p-3 bg-white border border-gray-200 rounded-xl">
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{improved}</p>
            </div>
            {enhancementState?.data?.rationale && (
              <p className="text-xs text-gray-500 italic">💡 {enhancementState.data.rationale}</p>
            )}
          </div>
        ) : enhancementState?.status === 'empty' ? (
          <EmptyState text="Start typing to get enhancements." />
        ) : (
          <EmptyState text="Click 'Enhance' to improve text." />
        )}
      </PanelCard>

      <PanelCard 
        title="Content Summary" 
        description="Quick recap for collaborators."
        action={
          <button
            onClick={onGenerateSummary}
            disabled={summaryState?.status === 'loading'}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {summaryState?.status === 'loading' ? 'Summarizing...' : 'Summarize'}
          </button>
        }
      >
        {summaryState?.error && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <p className="font-medium">ℹ️ {summaryState.error}</p>
          </div>
        )}
        {summaryState?.data?.summary ? (
          <div className="space-y-3">
            <div className="p-3 bg-white border border-gray-200 rounded-xl">
              <p className="text-sm text-gray-800 leading-relaxed">{summaryState.data.summary}</p>
            </div>
            {summaryState.data.bullets?.length > 0 && (
              <ul className="space-y-1.5 text-sm text-gray-700">
                {summaryState.data.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold mt-0.5">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : summaryState?.status === 'empty' ? (
          <EmptyState text="Start typing to generate a summary." />
        ) : (
          <EmptyState text="Click 'Summarize' to create a summary." />
        )}
      </PanelCard>

      <PanelCard
        title="Smart Auto-complete"
        description="Generate text continuation."
        action={
          <div className="flex items-center gap-2">
            {completion && (
              <button
                onClick={() => onInsertCompletion?.(completion)}
                className="text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
              >
                Insert
              </button>
            )}
            <button
              onClick={onGetCompletion}
              disabled={completionState?.status === 'loading'}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {completionState?.status === 'loading' ? 'Generating...' : 'Complete'}
            </button>
          </div>
        }
      >
        {completionState?.error && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <p className="font-medium">ℹ️ {completionState.error}</p>
          </div>
        )}
        {completion ? (
          <div className="p-3 bg-white border border-gray-200 rounded-xl">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{completion}</p>
          </div>
        ) : completionState?.status === 'empty' ? (
          <EmptyState text="Start typing to get completions." />
        ) : (
          <EmptyState text="Click 'Complete' to continue writing." />
        )}
      </PanelCard>

      <PanelCard 
        title="Writing Suggestions" 
        description="Get tactical recommendations."
        action={
          <button
            onClick={onGetSuggestions}
            disabled={suggestionsState?.status === 'loading'}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {suggestionsState?.status === 'loading' ? 'Loading...' : 'Get Ideas'}
          </button>
        }
      >
        {suggestionsState?.error && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <p className="font-medium">ℹ️ {suggestionsState.error}</p>
          </div>
        )}
        {suggestionsState?.data?.ideas?.length ? (
          <ul className="space-y-2">
            {suggestionsState.data.ideas.map((idea, idx) => (
              <li key={`${idea.title}-${idx}`} className="p-3 rounded-xl border border-gray-100 bg-white hover:border-indigo-100 transition-colors">
                <p className="text-sm font-semibold text-gray-900 mb-1">💡 {idea.title}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{idea.detail}</p>
              </li>
            ))}
          </ul>
        ) : suggestionsState?.status === 'empty' ? (
          <EmptyState text="Start typing to get suggestions." />
        ) : (
          <EmptyState text="Click 'Get Ideas' for recommendations." />
        )}
      </PanelCard>
    </aside>
  );
}

function PanelCard({ title, description, children, action }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="border border-gray-100 rounded-2xl p-3 bg-gray-50">
        {children}
      </div>
    </section>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-6">
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}