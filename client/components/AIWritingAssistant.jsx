import React, { useState } from 'react';
import { 
  CheckCircle2, XCircle, RefreshCw, Copy, Download, Info,
  Sparkles, BookOpen, Wand2, MessageSquare, Lightbulb, 
  ChevronDown, ChevronUp, AlertCircle, Check, X
} from 'lucide-react';

const tabs = [
  { id: 'grammar', label: 'Grammar', icon: CheckCircle2 },
  { id: 'enhance', label: 'Enhance', icon: Wand2 },
  { id: 'summary', label: 'Summary', icon: BookOpen },
  { id: 'complete', label: 'Complete', icon: Sparkles },
  { id: 'suggest', label: 'Ideas', icon: Lightbulb },
];

export default function AIWritingAssistant({
  grammarState, enhancementState, summaryState, completionState, suggestionsState,
  onCheckGrammar, onEnhanceText, onGenerateSummary, onGetSuggestions, onGetCompletion,
  onApplyEnhancement, onApplyGrammarFix, onApplyAllGrammarFixes, onInsertCompletion,
  onCopySummary, onInsertSummary, onRegenerateSummary, onRegenerateEnhancement,
  // NEW handlers (parent should pass these)
  onDismissGrammar,            // (index) => void
  onDeclineEnhancement,        // () => void
  onDeclineCompletion,         // () => void
  onDeclineSummary,            // () => void
  onDismissSuggestion,         // (index) => void
  onApplySuggestion,           // (idea, index) => void
  selectionText,
}) {
  const [activeTab, setActiveTab] = useState('grammar');
  // Keep small local UI sets for fast instant UI feedback — parent will be the source of truth.
  const [dismissedCorrections, setDismissedCorrections] = useState(new Set());
  const [dismissedSuggestions, setDismissedSuggestions] = useState(new Set());
  const [expandedItems, setExpandedItems] = useState(new Set());

  const toggleExpand = (id) => {
    const newSet = new Set(expandedItems);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedItems(newSet);
  };

  // local dismissed marking (but call parent after)
  const dismissCorrectionLocal = (idx) => {
    setDismissedCorrections(new Set([...dismissedCorrections, idx]));
    if (typeof onDismissGrammar === 'function') onDismissGrammar(idx);
  };

  const dismissAllCorrections = () => {
    const all = grammarState.data?.corrections?.map((_, i) => i) || [];
    setDismissedCorrections(new Set(all));
    if (typeof onDismissGrammar === 'function') {
      all.forEach((i) => onDismissGrammar(i));
    }
  };

  const dismissSuggestionLocal = (idx) => {
    setDismissedSuggestions(new Set([...dismissedSuggestions, idx]));
    if (typeof onDismissSuggestion === 'function') onDismissSuggestion(idx);
  };

  const visibleCorrections = (grammarState.data?.corrections || []).filter((_, i) => !dismissedCorrections.has(i));
  const visibleSuggestions = (suggestionsState.data?.ideas || []).filter((_, i) => !dismissedSuggestions.has(i));

  // Inline style fallbacks (used in addition to Tailwind classes)
  const baseBtnStyle = {
    minHeight: '40px',
    minWidth: '90px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    zIndex: 1,
  };
  const primaryBlue = '#2563EB';   // tailwind blue-600
  const primaryBlueHover = '#1D4ED8'; // blue-700
  const green600 = '#16A34A';
  const green700 = '#15803D';
  const gray600 = '#4B5563';
  const gray200 = '#E5E7EB';
  const blue100 = '#DBEAFE';
  const gray100 = '#F3F4F6';

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 bg-gray-50 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-colors border-b-2 ${
                isActive 
                  ? 'border-blue-600 text-blue-600 bg-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Grammar Tab */}
        {activeTab === 'grammar' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Grammar & Style Check</h3>
              <button
                onClick={onCheckGrammar}
                disabled={grammarState.status === 'loading'}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                style={{ ...baseBtnStyle, backgroundColor: primaryBlue, color: '#fff' }}
              >
                {grammarState.status === 'loading' ? (
                  <><RefreshCw className="w-4 h-4 animate-spin text-white" /> Checking...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 text-white" /> Check</>
                )}
              </button>
            </div>

            {grammarState.status === 'loading' && <LoadingSkeleton lines={4} />}
            
            {grammarState.error && <ErrorMessage message={grammarState.error} />}

            {grammarState.status === 'ready' && visibleCorrections.length > 0 && (
              <>
                {/* Overall Score */}
                {grammarState.data.overallScore !== undefined && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <span className="text-sm font-medium text-gray-600">Overall Score</span>
                    <ScoreBadge score={grammarState.data.overallScore} />
                  </div>
                )}

                {/* Bulk Actions */}
                <div className="flex gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <button
                    onClick={onApplyAllGrammarFixes}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    style={{ ...baseBtnStyle, backgroundColor: green600, color: '#fff' }}
                  >
                    <Check className="w-4 h-4 text-white" /> Accept All
                  </button>
                  <button
                    onClick={dismissAllCorrections}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                    style={{ ...baseBtnStyle, backgroundColor: gray600, color: '#fff' }}
                  >
                    <X className="w-4 h-4 text-white" /> Decline All
                  </button>
                </div>

                {/* Corrections List */}
                <div className="space-y-3">
                  {visibleCorrections.map((item, idx) => {
                    // Find original index in full corrections array (so parent can remove by index)
                    const originalIndex = grammarState.data.corrections.indexOf(item);
                    return (
                      <GrammarCorrectionCard
                        key={`${item.issue}-${originalIndex}-${idx}`}
                        item={item}
                        onAccept={() => {
                          // call parent to apply AND remove (parent will update grammarState)
                          onApplyGrammarFix?.(item, originalIndex);
                          // also mark locally dismissed for instant UI feedback
                          setDismissedCorrections(new Set([...dismissedCorrections, originalIndex]));
                        }}
                        onDecline={() => dismissCorrectionLocal(originalIndex)}
                        expanded={expandedItems.has(`grammar-${originalIndex}`)}
                        onToggleExpand={() => toggleExpand(`grammar-${originalIndex}`)}
                        // pass styles via props if needed (we keep card self-contained)
                      />
                    );
                  })}
                </div>
              </>
            )}

            {grammarState.status === 'ready' && visibleCorrections.length === 0 && (
              <SuccessMessage message="No grammar issues found! Your writing looks great." />
            )}

            {grammarState.status === 'idle' && <EmptyState icon={CheckCircle2} text="Click 'Check' to analyze your writing for grammar and style issues." />}
          </div>
        )}

        {/* Enhancement Tab */}
        {activeTab === 'enhance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Text Enhancement</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectionText ? 'Enhancing selected text' : 'Enhancing entire document'}
                </p>
              </div>
              <button
                onClick={onEnhanceText}
                disabled={enhancementState.status === 'loading'}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                style={{ ...baseBtnStyle, backgroundColor: primaryBlue, color: '#fff' }}
              >
                {enhancementState.status === 'loading' ? (
                  <><RefreshCw className="w-4 h-4 animate-spin text-white" /> Enhancing...</>
                ) : (
                  <><Wand2 className="w-4 h-4 text-white" /> Enhance</>
                )}
              </button>
            </div>

            {enhancementState.status === 'loading' && <LoadingSkeleton lines={6} />}
            
            {enhancementState.error && <ErrorMessage message={enhancementState.error} />}

            {enhancementState.status === 'ready' && enhancementState.data?.improved && (
              <div className="space-y-3">
                {/* Side by Side Comparison */}
                <div className="grid grid-cols-1 gap-3">
                  {selectionText && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs font-medium text-red-700 mb-1">Original</p>
                      <p className="text-sm text-red-900">{selectionText}</p>
                    </div>
                  )}
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs font-medium text-green-700 mb-1">Enhanced</p>
                    <p className="text-sm text-green-900 whitespace-pre-wrap">{enhancementState.data.improved}</p>
                  </div>
                </div>

                {enhancementState.data.rationale && (
                  <p className="text-xs text-gray-500 italic px-1">💡 {enhancementState.data.rationale}</p>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { onApplyEnhancement?.(enhancementState.data.improved); /* parent will clear state */ }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    style={{ ...baseBtnStyle, backgroundColor: green600, color: '#fff' }}
                  >
                    <Check className="w-4 h-4 text-white" /> Accept
                  </button>
                  <button
                    onClick={() => { onDeclineEnhancement?.(); setDismissedCorrections(new Set()); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                    style={{ ...baseBtnStyle, backgroundColor: gray600, color: '#fff' }}
                  >
                    <X className="w-4 h-4 text-white" /> Decline
                  </button>
                  <button
                    onClick={onRegenerateEnhancement}
                    className="px-4 py-2.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors"
                    style={{ ...baseBtnStyle, backgroundColor: blue100, color: '#1e3a8a' }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {enhancementState.status === 'idle' && <EmptyState icon={Wand2} text="Select text or click 'Enhance' to improve your writing style and clarity." />}
          </div>
        )}

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Content Summary</h3>
              <button
                onClick={onGenerateSummary}
                disabled={summaryState.status === 'loading'}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                style={{ ...baseBtnStyle, backgroundColor: primaryBlue, color: '#fff' }}
              >
                {summaryState.status === 'loading' ? (
                  <><RefreshCw className="w-4 h-4 animate-spin text-white" /> Generating...</>
                ) : (
                  <><BookOpen className="w-4 h-4 text-white" /> Summarize</>
                )}
              </button>
            </div>

            {summaryState.status === 'loading' && <LoadingSkeleton lines={5} />}
            
            {summaryState.error && <ErrorMessage message={summaryState.error} />}

            {summaryState.status === 'ready' && summaryState.data?.summary && (
              <div className="space-y-3">
                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-800 leading-relaxed">{summaryState.data.summary}</p>
                  {summaryState.data.bullets?.length > 0 && (
                    <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                      {summaryState.data.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold mt-0.5">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={onCopySummary}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    style={{ ...baseBtnStyle, backgroundColor: gray100, color: '#374151' }}
                  >
                    <Copy className="w-4 h-4" /> Copy
                  </button>
                  <button
                    onClick={onInsertSummary}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    style={{ ...baseBtnStyle, backgroundColor: primaryBlue, color: '#fff' }}
                  >
                    <Download className="w-4 h-4 text-white" /> Insert
                  </button>
                  <button
                    onClick={() => { onDeclineSummary?.(); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                    style={{ ...baseBtnStyle, backgroundColor: gray200, color: '#374151', minWidth: '80px' }}
                  >
                    <X className="w-4 h-4" /> Decline
                  </button>
                  <button
                    onClick={onRegenerateSummary}
                    className="px-4 py-2.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors"
                    style={{ ...baseBtnStyle, backgroundColor: blue100, color: '#1e3a8a' }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {summaryState.status === 'idle' && <EmptyState icon={BookOpen} text="Click 'Summarize' to generate a quick recap of your content." />}
          </div>
        )}

        {/* Auto-Complete Tab */}
        {activeTab === 'complete' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Smart Auto-Complete</h3>
              <button
                onClick={onGetCompletion}
                disabled={completionState.status === 'loading'}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                style={{ ...baseBtnStyle, backgroundColor: primaryBlue, color: '#fff' }}
              >
                {completionState.status === 'loading' ? (
                  <><RefreshCw className="w-4 h-4 animate-spin text-white" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 text-white" /> Complete</>
                )}
              </button>
            </div>

            {completionState.status === 'loading' && <LoadingSkeleton lines={3} />}
            
            {completionState.error && <ErrorMessage message={completionState.error} />}

            {completionState.status === 'ready' && completionState.data?.completion && (
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600 italic leading-relaxed">{completionState.data.completion}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                  <span>Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono">Tab</kbd> to accept</span>
                  <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono">Esc</kbd> to decline</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { onInsertCompletion?.(completionState.data.completion); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    style={{ ...baseBtnStyle, backgroundColor: green600, color: '#fff' }}
                  >
                    <Check className="w-4 h-4 text-white" /> Accept
                  </button>
                  <button
                    onClick={() => { onDeclineCompletion?.(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                    style={{ ...baseBtnStyle, backgroundColor: gray600, color: '#fff' }}
                  >
                    <X className="w-4 h-4 text-white" /> Decline
                  </button>
                </div>
              </div>
            )}

            {completionState.status === 'idle' && <EmptyState icon={Sparkles} text="Click 'Complete' to generate text continuation based on your writing." />}
          </div>
        )}

        {/* Suggestions Tab */}
        {activeTab === 'suggest' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Writing Suggestions</h3>
              <button
                onClick={onGetSuggestions}
                disabled={suggestionsState.status === 'loading'}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                style={{ ...baseBtnStyle, backgroundColor: primaryBlue, color: '#fff' }}
              >
                {suggestionsState.status === 'loading' ? (
                  <><RefreshCw className="w-4 h-4 animate-spin text-white" /> Loading...</>
                ) : (
                  <><Lightbulb className="w-4 h-4 text-white" /> Get Ideas</>
                )}
              </button>
            </div>

            {suggestionsState.status === 'loading' && <LoadingSkeleton lines={4} />}
            
            {suggestionsState.error && <ErrorMessage message={suggestionsState.error} />}

            {suggestionsState.status === 'ready' && visibleSuggestions.length > 0 && (
              <div className="space-y-3">
                {visibleSuggestions.map((idea, idx) => {
                  // get original index in full ideas array (for parent)
                  const originalIndex = suggestionsState.data.ideas.indexOf(idea);
                  return (
                    <SuggestionCard
                      key={`${idea.title}-${originalIndex}-${idx}`}
                      idea={idea}
                      onApply={() => {
                        onApplySuggestion?.(idea, originalIndex);
                        setDismissedSuggestions(new Set([...dismissedSuggestions, originalIndex]));
                      }}
                      onDismiss={() => dismissSuggestionLocal(originalIndex)}
                      onMoreInfo={() => toggleExpand(`suggestion-${originalIndex}`)}
                      expanded={expandedItems.has(`suggestion-${originalIndex}`)}
                    />
                  );
                })}
              </div>
            )}

            {suggestionsState.status === 'idle' && <EmptyState icon={Lightbulb} text="Click 'Get Ideas' to receive tactical writing recommendations." />}

            {suggestionsState.status === 'ready' && visibleSuggestions.length === 0 && (
              <SuccessMessage message="No suggestions left." />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components
function GrammarCorrectionCard({ item, onAccept, onDecline, expanded, onToggleExpand }) {
  const severityColors = {
    error: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  // Smaller base for the compact cards
  const compactBtnStyle = { minHeight: '36px', minWidth: '72px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', zIndex: 1 };

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${severityColors[item.severity] || severityColors.info}`}>
          {item.type || 'Grammar'}
        </span>
        <button onClick={onToggleExpand} className="text-gray-400 hover:text-gray-600" aria-label={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      
      <p className="text-sm text-gray-800 font-medium mb-2">{item.issue}</p>
      
      {item.original && item.corrected && (
        <div className="space-y-1 text-sm mb-3">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            <span className="line-through text-red-600">{item.original}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-green-600 font-medium">{item.corrected}</span>
          </p>
        </div>
      )}

      {expanded && item.explanation && (
        <p className="text-xs text-gray-500 mb-3 p-2 bg-gray-50 rounded-lg">{item.explanation}</p>
      )}

      <div className="flex gap-2">
        <button onClick={onAccept} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors" style={{ ...compactBtnStyle, backgroundColor: '#16A34A', color: '#fff' }} aria-label="Accept correction">
          <Check className="w-3.5 h-3.5 text-white" /> Accept
        </button>
        <button onClick={onDecline} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300 transition-colors" style={{ ...compactBtnStyle, backgroundColor: '#E5E7EB', color: '#374151' }} aria-label="Decline correction">
          <X className="w-3.5 h-3.5 text-gray-700" /> Decline
        </button>
      </div>
    </div>
  );
}

function SuggestionCard({ idea, onApply, onDismiss, onMoreInfo, expanded }) {
  const suggestionBtnStyle = { minHeight: '36px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', zIndex: 1 };
  return (
    <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <p className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        {idea.title}
      </p>
      <p className={`text-sm text-gray-600 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>{idea.detail}</p>
      
      <div className="flex gap-2 mt-3">
        {/* <button onClick={onApply} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors" style={{ ...suggestionBtnStyle, backgroundColor: '#16A34A', color: '#fff' }}>
          <Check className="w-3.5 h-3.5 text-white" /> Apply
        </button> */}
        <button onClick={onDismiss} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300 transition-colors" style={{ ...suggestionBtnStyle, backgroundColor: '#E5E7EB', color: '#374151' }}>
          <X className="w-3.5 h-3.5 text-gray-700" /> Dismiss
        </button>
        <button onClick={onMoreInfo} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-200 transition-colors" style={{ ...suggestionBtnStyle, backgroundColor: '#DBEAFE', color: '#1E3A8A' }}>
          <Info className="w-3.5 h-3.5 text-blue-700" /> {expanded ? 'Less' : 'More'}
        </button>
      </div>
    </div>
  );
}

function LoadingSkeleton({ lines = 3 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: `${70 + Math.random() * 30}%` }}></div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="text-center py-8 px-4">
      <Icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

function ErrorMessage({ message }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800">{message}</p>
    </div>
  );
}

function SuccessMessage({ message }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
        <Check className="w-5 h-5 text-green-600" />
      </div>
      <p className="text-sm font-medium text-green-700">{message}</p>
    </div>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
  const bg = score >= 80 ? 'bg-green-100' : score >= 60 ? 'bg-amber-100' : 'bg-red-100';
  return (
    <span className={`text-lg font-bold ${color} ${bg} px-3 py-1 rounded-full`}>
      {score}/100
    </span>
  );
}
