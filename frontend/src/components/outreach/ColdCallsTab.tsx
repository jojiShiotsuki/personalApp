import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import {
  Upload,
  Plus,
  Circle,
  PhoneOutgoing,
  PhoneCall,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Linkedin,
  Globe,
  MessageCircle,
  Heart,
  Reply,
  Video,
  Pencil,
  Trash2,
  Tag,
  Layers,
  X,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { coldCallsApi, coldOutreachApi } from '@/lib/api';
import { CallProspect, CallStatus, CampaignType, StepChannelType, ProspectTier, type OutreachCampaign, type CampaignWithStats, type MultiTouchStep, type CallProspectUpdate } from '@/types';
import CallProspectDetailModal from './CallProspectDetailModal';
import ColdCallCsvImportModal from './ColdCallCsvImportModal';
import AddColdLeadModal from './AddColdLeadModal';
import HubStatsBar, { type HubStat } from './HubStatsBar';
import CampaignSelector from './CampaignSelector';
import NewCampaignModal from '@/components/NewCampaignModal';
import {
  kanbanColumnClasses,
  kanbanColumnAccents,
  kanbanColumnTitleAccents,
  kanbanCountBadgeAccents,
  prospectCardClasses,
  prospectCardHoverClasses,
  prospectCardDraggingClasses,
  type KanbanAccent,
} from '@/lib/outreachStyles';
import { getStepColor } from '@/lib/stepColors';
import { getScriptLabelTokens } from '@/lib/scriptLabelColor';
import { useWheelToHorizontalScroll } from '@/hooks/useWheelToHorizontalScroll';
import {
  callbackTier,
  formatCallbackLabel,
  isDueByEndOfToday,
  parseBackendDatetime,
} from '@/lib/callbackFormat';
import { useCurrentMinute } from '@/hooks/useCurrentMinute';
import { sortProspects, SORT_OPTIONS, type SortKey } from '@/lib/sortProspects';
import { TIER_META, TIER_ORDER } from '@/lib/tierMeta';

interface ColumnConfig {
  status: CallStatus;
  label: string;
  accent: KanbanAccent;
}

const COLUMNS: ColumnConfig[] = [
  { status: CallStatus.NEW, label: 'New Leads', accent: 'blue' },
  { status: CallStatus.ATTEMPTED, label: 'Attempted', accent: 'amber' },
  { status: CallStatus.CONNECTED, label: 'Connected', accent: 'emerald' },
  { status: CallStatus.DEAD, label: 'Dead', accent: 'rose' },
];

const smallPrimaryButtonClasses = cn(
  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white',
  'bg-[--exec-accent] hover:bg-[--exec-accent-dark]',
  'transition-all duration-200 shadow-sm hover:shadow-md'
);

const CHANNEL_ICON: Record<string, typeof Phone> = {
  [StepChannelType.PHONE_CALL]: Phone,
  [StepChannelType.EMAIL]: Mail,
  [StepChannelType.FOLLOW_UP_EMAIL]: Reply,
  [StepChannelType.LINKEDIN_CONNECT]: Linkedin,
  [StepChannelType.LINKEDIN_MESSAGE]: MessageCircle,
  [StepChannelType.LINKEDIN_ENGAGE]: Heart,
  [StepChannelType.LOOM_EMAIL]: Video,
  [StepChannelType.CUSTOM]: Pencil,
};

const CHANNEL_ACCENT: Record<string, string> = {
  [StepChannelType.PHONE_CALL]: 'text-orange-400',
  [StepChannelType.EMAIL]: 'text-blue-400',
  [StepChannelType.FOLLOW_UP_EMAIL]: 'text-purple-400',
  [StepChannelType.LINKEDIN_CONNECT]: 'text-sky-400',
  [StepChannelType.LINKEDIN_MESSAGE]: 'text-indigo-400',
  [StepChannelType.LINKEDIN_ENGAGE]: 'text-amber-400',
  [StepChannelType.LOOM_EMAIL]: 'text-rose-400',
  [StepChannelType.CUSTOM]: 'text-cyan-400',
};

// Channel-colored kanban column chrome for the step-based view.
const CHANNEL_BORDER_TOP: Record<string, string> = {
  [StepChannelType.PHONE_CALL]: 'border-t-orange-500',
  [StepChannelType.EMAIL]: 'border-t-blue-500',
  [StepChannelType.FOLLOW_UP_EMAIL]: 'border-t-purple-500',
  [StepChannelType.LINKEDIN_CONNECT]: 'border-t-sky-500',
  [StepChannelType.LINKEDIN_MESSAGE]: 'border-t-indigo-500',
  [StepChannelType.LINKEDIN_ENGAGE]: 'border-t-amber-500',
  [StepChannelType.LOOM_EMAIL]: 'border-t-rose-500',
  [StepChannelType.CUSTOM]: 'border-t-cyan-500',
};

const CHANNEL_COUNT_BADGE: Record<string, string> = {
  [StepChannelType.PHONE_CALL]: 'bg-orange-500/20 text-orange-400',
  [StepChannelType.EMAIL]: 'bg-blue-500/20 text-blue-400',
  [StepChannelType.FOLLOW_UP_EMAIL]: 'bg-purple-500/20 text-purple-400',
  [StepChannelType.LINKEDIN_CONNECT]: 'bg-sky-500/20 text-sky-400',
  [StepChannelType.LINKEDIN_MESSAGE]: 'bg-indigo-500/20 text-indigo-400',
  [StepChannelType.LINKEDIN_ENGAGE]: 'bg-amber-500/20 text-amber-400',
  [StepChannelType.LOOM_EMAIL]: 'bg-rose-500/20 text-rose-400',
  [StepChannelType.CUSTOM]: 'bg-cyan-500/20 text-cyan-400',
};

const CALLBACK_PILL_TOKENS: Record<
  ReturnType<typeof callbackTier>,
  string
> = {
  overdue:
    'bg-red-500/20 text-red-400 animate-pulse',
  soon: 'bg-orange-500/20 text-orange-400',
  today: 'bg-amber-500/20 text-amber-400',
  tomorrow: 'bg-blue-500/20 text-blue-400',
  thisweek: 'bg-stone-500/20 text-stone-300',
  future: 'bg-stone-500/20 text-stone-300',
};

function firstNotePreview(notes: string | null): string | null {
  if (!notes) return null;
  const trimmed = notes.trim();
  if (!trimmed) return null;
  // Take the last non-empty line (most recent note if user timestamps them at the bottom)
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] ?? '';
  return last.length > 80 ? last.slice(0, 80) + '…' : last;
}

// Apollo prefixes phone numbers with a leading apostrophe (Excel
// text-protection). Strip it for display + tel: links — older imports
// done before the backend strip lived with the apostrophe in the DB.
function cleanPhone(phone: string): string {
  const trimmed = phone.trim();
  return trimmed.startsWith("'") ? trimmed.slice(1).trim() : trimmed;
}

function buildPersonLine(prospect: CallProspect): string | null {
  const name = [prospect.first_name, prospect.last_name].filter(Boolean).join(' ').trim();
  if (name && prospect.position) return `${name} · ${prospect.position}`;
  if (name) return name;
  if (prospect.position) return prospect.position;
  return null;
}

function ensureUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

// "Mobile Phone" → "Mobile", "Work Direct Phone" → "Work Direct".
// Drops trailing " Phone" so the label doesn't visually duplicate the icon.
function shortenPhoneLabel(label: string): string {
  return label.replace(/\s*Phone\s*$/i, '').trim() || label;
}

// Digits-only signature for dedupe: "+61 1800 975 399" and "1800 975 399"
// collapse to the same key. Apollo often has Corporate Phone == Company Phone.
function phoneSignature(value: string): string {
  return value.replace(/\D/g, '');
}

async function copyPhoneToClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Copied ${value}`);
  } catch {
    toast.error('Failed to copy — clipboard blocked');
  }
}

interface CallbackPillProps {
  callbackAt: string;
  now: Date;
}

function CallbackPill({ callbackAt, now }: CallbackPillProps) {
  const at = parseBackendDatetime(callbackAt);
  const tier = callbackTier(at, now);
  const tokens = CALLBACK_PILL_TOKENS[tier];
  const label = formatCallbackLabel(at, now);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md mb-1',
        tokens,
      )}
      title={at.toLocaleString()}
    >
      <PhoneCall className="w-3 h-3" />
      {label}
    </span>
  );
}

interface CallProspectCardProps {
  prospect: CallProspect;
  index: number;
  onClick: (prospect: CallProspect) => void;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  hasAnySelection: boolean;
  now: Date;
}

function CallProspectCard({ prospect, index, onClick, isSelected, onToggleSelect, hasAnySelection, now }: CallProspectCardProps) {
  const preview = firstNotePreview(prospect.notes);
  const personLine = buildPersonLine(prospect);
  const phone = prospect.phone ? cleanPhone(prospect.phone) : null;
  const hasQuickActions = Boolean(phone || prospect.email || prospect.linkedin_url || prospect.website);

  // Dedupe additional phones: drop any matching primary, drop duplicates among themselves.
  // Apollo often has Corporate Phone == Company Phone; old DB rows may have both stored.
  const dedupedAdditional = (() => {
    if (!prospect.additional_phones || prospect.additional_phones.length === 0) return [];
    const seen = new Set<string>();
    if (phone) seen.add(phoneSignature(phone));
    const out: Array<{ label: string; value: string }> = [];
    for (const p of prospect.additional_phones) {
      const cleaned = cleanPhone(p.value);
      if (!cleaned) continue;
      const sig = phoneSignature(cleaned);
      if (!sig || seen.has(sig)) continue;
      seen.add(sig);
      out.push({ label: p.label, value: cleaned });
    }
    return out;
  })();

  return (
    <Draggable draggableId={`cp-${prospect.id}`} index={index}>
      {(provided, snapshot) => {
        const content = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => onClick(prospect)}
            className={cn(
              prospectCardClasses,
              prospectCardHoverClasses,
              'cursor-pointer relative group',
              isSelected && 'ring-2 ring-[--exec-accent] border-[--exec-accent]/60',
              snapshot.isDragging && prospectCardDraggingClasses
            )}
            style={provided.draggableProps.style}
          >
            {/* Selection checkbox — always visible when any selection exists,
                otherwise reveal on hover. Stops propagation so it doesn't open
                the detail modal. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(prospect.id);
              }}
              className={cn(
                'absolute top-2 right-2 w-5 h-5 rounded-md border flex items-center justify-center transition-all z-10',
                isSelected
                  ? 'bg-[--exec-accent] border-[--exec-accent] text-white opacity-100'
                  : 'border-stone-500/60 bg-stone-900/40 text-transparent hover:border-stone-400 hover:bg-stone-800',
                !isSelected && !hasAnySelection && 'opacity-0 group-hover:opacity-100',
                !isSelected && hasAnySelection && 'opacity-60 hover:opacity-100'
              )}
              aria-label={isSelected ? 'Deselect prospect' : 'Select prospect'}
            >
              {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
            </button>

            <h4 className={cn(
              'text-sm font-semibold text-[--exec-text] line-clamp-2 leading-tight mb-1',
              // Make room for the checkbox in the corner
              'pr-6'
            )}>
              {prospect.business_name}
            </h4>

            {prospect.tier && (() => {
              const meta = TIER_META[prospect.tier];
              return (
                <div className="mb-1.5">
                  <span
                    className={cn(
                      'inline-flex items-center text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md',
                      meta.pillClasses,
                    )}
                    title={meta.fullLabel}
                  >
                    {meta.pillLabel}
                  </span>
                </div>
              );
            })()}

            {prospect.script_label && (() => {
              const tokens = getScriptLabelTokens(prospect.script_label);
              return (
                <div className="mb-1.5">
                  <span
                    className={cn(
                      'inline-flex items-center text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md',
                      tokens.bg,
                      tokens.text,
                    )}
                  >
                    {prospect.script_label}
                  </span>
                </div>
              );
            })()}

            {personLine && (
              <p className="text-xs text-[--exec-text-secondary] line-clamp-1 mb-2">
                {personLine}
              </p>
            )}

            {phone && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyPhoneToClipboard(phone);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-[--exec-text] font-mono mb-1 hover:text-[--exec-accent] transition-colors"
                title="Click to copy"
              >
                <Phone className="w-3 h-3 text-[--exec-text-muted]" />
                {phone}
              </button>
            )}

            {prospect.callback_at && (
              <div className="mb-1">
                <CallbackPill callbackAt={prospect.callback_at} now={now} />
              </div>
            )}

            {dedupedAdditional.length > 0 && (
              <div className="ml-[18px] mb-2 space-y-0.5">
                {dedupedAdditional.map((p) => (
                  <button
                    key={`${p.label}-${p.value}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyPhoneToClipboard(p.value);
                    }}
                    className="flex items-baseline gap-1.5 text-[11px] font-mono text-[--exec-text-muted] hover:text-[--exec-accent] transition-colors w-full text-left"
                    title={`Click to copy ${p.label}`}
                  >
                    <span className="text-[10px] uppercase tracking-wide font-sans font-medium text-[--exec-text-muted]/80 w-[58px] flex-shrink-0">
                      {shortenPhoneLabel(p.label)}
                    </span>
                    <span className="truncate">{p.value}</span>
                  </button>
                ))}
              </div>
            )}

            {prospect.vertical && (
              <div className="mb-2">
                <span className="inline-block text-[10px] uppercase tracking-wider font-medium text-[--exec-text-muted] bg-stone-700/60 px-2 py-0.5 rounded">
                  {prospect.vertical}
                </span>
              </div>
            )}

            {hasQuickActions && (
              <div className="flex items-center gap-1 mb-2">
                {prospect.email && (
                  <a
                    href={`mailto:${prospect.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[--exec-text-muted] hover:text-blue-400 hover:bg-blue-500/15 transition-colors"
                    title={prospect.email}
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                )}
                {prospect.linkedin_url && (
                  <a
                    href={ensureUrl(prospect.linkedin_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[--exec-text-muted] hover:text-sky-400 hover:bg-sky-500/15 transition-colors"
                    title="LinkedIn"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                  </a>
                )}
                {prospect.website && (
                  <a
                    href={ensureUrl(prospect.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/60 transition-colors"
                    title={prospect.website}
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            {preview && (
              <p className="text-xs text-[--exec-text-muted] line-clamp-2 pt-2 border-t border-stone-700/30">
                {preview}
              </p>
            )}
          </div>
        );

        // Portal the dragging clone to document.body to escape the
        // `animate-fade-slide-up` transform on OutreachHub's tab-content wrapper,
        // which creates a containing block and breaks @hello-pangea/dnd's
        // position:fixed drag clone.
        if (snapshot.isDragging) {
          return createPortal(content, document.body);
        }
        return content;
      }}
    </Draggable>
  );
}

interface StepColumnProps {
  step: MultiTouchStep;
  prospects: CallProspect[];
  onCardClick: (prospect: CallProspect) => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  now: Date;
}

function StepColumn({ step, prospects, onCardClick, selectedIds, onToggleSelect, now }: StepColumnProps) {
  const chKey = (step.channel_type || '').toUpperCase();
  const Icon = CHANNEL_ICON[chKey] ?? Phone;
  const isCustom = chKey === StepChannelType.CUSTOM;
  // Color resolution: a user-picked custom_color overrides any channel default.
  // CUSTOM steps without a pick fall back to the palette default (cyan).
  // Predefined channels without a pick use their fixed channel palette maps.
  const overrideTokens = step.custom_color ? getStepColor(step.custom_color) : null;
  const customDefaultTokens = isCustom && !overrideTokens ? getStepColor(undefined) : null;
  const effectiveTokens = overrideTokens ?? customDefaultTokens;
  const accent = effectiveTokens ? effectiveTokens.accent : (CHANNEL_ACCENT[chKey] ?? 'text-stone-400');
  const borderClass = effectiveTokens ? effectiveTokens.border : (CHANNEL_BORDER_TOP[chKey] ?? 'border-t-stone-500');
  const countBadgeClass = effectiveTokens ? effectiveTokens.badge : (CHANNEL_COUNT_BADGE[chKey] ?? 'bg-stone-500/20 text-stone-400');

  // For CUSTOM steps the user's instruction_text IS the step label; for
  // predefined channels we keep the generic channel label and surface
  // instruction_text separately as the action description.
  const headerLabel = isCustom
    ? (step.instruction_text?.trim() || `Step ${step.step_number}`)
    : `Step ${step.step_number}`;
  const description = isCustom ? null : step.instruction_text;

  return (
    <Droppable droppableId={`step-${step.step_number}`}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            'bg-stone-700/30 rounded-xl p-3 border-l border-r border-b border-stone-600/40 min-w-[240px] flex-1',
            'border-t-2 transition-all',
            'h-full flex flex-col min-h-0',
            borderClass,
            snapshot.isDraggingOver && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
          )}
        >
          {/* Column header */}
          <div className="flex items-start justify-between mb-2 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-stone-700/60 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-[--exec-text-secondary]">
                  {step.step_number}
                </span>
              </div>
              <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', accent)} />
              <span className={cn('text-xs font-semibold truncate', accent)} title={headerLabel}>
                {headerLabel}
              </span>
            </div>
            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', countBadgeClass)}>
              {prospects.length}
            </span>
          </div>

          {description && (
            <p className="text-[10px] text-[--exec-text-muted] mb-3 line-clamp-2">
              {description}
            </p>
          )}

          {/* Cards */}
          <div
            data-col-scroll
            className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2"
          >
            {prospects.map((prospect, index) => (
              <CallProspectCard
                key={prospect.id}
                prospect={prospect}
                index={index}
                onClick={onCardClick}
                isSelected={selectedIds.has(prospect.id)}
                onToggleSelect={onToggleSelect}
                hasAnySelection={selectedIds.size > 0}
                now={now}
              />
            ))}
            {provided.placeholder}
            {prospects.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-xs text-[--exec-text-muted] text-center py-4 italic">
                No prospects
              </p>
            )}
          </div>
        </div>
      )}
    </Droppable>
  );
}

interface ColumnProps {
  column: ColumnConfig;
  prospects: CallProspect[];
  onCardClick: (prospect: CallProspect) => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  now: Date;
}

function Column({ column, prospects, onCardClick, selectedIds, onToggleSelect, now }: ColumnProps) {
  return (
    <Droppable droppableId={column.status}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            kanbanColumnClasses,
            kanbanColumnAccents[column.accent],
            'h-full flex flex-col min-h-0',
            snapshot.isDraggingOver && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
          )}
        >
          {/* Column header */}
          <div className="flex items-center justify-between mb-3">
            <span
              className={cn(
                'text-xs font-semibold',
                kanbanColumnTitleAccents[column.accent]
              )}
            >
              {column.label}
            </span>
            <span
              className={cn(
                'text-xs font-medium px-1.5 py-0.5 rounded-full',
                kanbanCountBadgeAccents[column.accent]
              )}
            >
              {prospects.length}
            </span>
          </div>

          {/* Cards */}
          <div
            data-col-scroll
            className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2"
          >
            {prospects.map((prospect, index) => (
              <CallProspectCard
                key={prospect.id}
                prospect={prospect}
                index={index}
                onClick={onCardClick}
                isSelected={selectedIds.has(prospect.id)}
                onToggleSelect={onToggleSelect}
                hasAnySelection={selectedIds.size > 0}
                now={now}
              />
            ))}
            {provided.placeholder}
            {prospects.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-xs text-[--exec-text-muted] text-center py-4 italic">
                No leads
              </p>
            )}
          </div>
        </div>
      )}
    </Droppable>
  );
}

export default function ColdCallsTab() {
  const queryClient = useQueryClient();
  const now = useCurrentMinute();
  const [selectedProspect, setSelectedProspect] = useState<CallProspect | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<OutreachCampaign | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isLabelPopoverOpen, setIsLabelPopoverOpen] = useState(false);
  const [isTierPopoverOpen, setIsTierPopoverOpen] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [callbackFilterActive, setCallbackFilterActive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('default');

  const kanbanScrollRef = useRef<HTMLDivElement | null>(null);
  useWheelToHorizontalScroll(kanbanScrollRef);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsLabelPopoverOpen(false);
    setIsTierPopoverOpen(false);
    setLabelInput('');
  };

  // Clear selection when changing campaign (different prospect scope)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedCampaignId]);

  const { data: campaigns = [], isLoading: isCampaignsLoading } = useQuery<OutreachCampaign[]>({
    queryKey: ['outreach-campaigns'],
    queryFn: () => coldOutreachApi.getCampaigns(),
  });

  const { data: selectedCampaignDetail } = useQuery<CampaignWithStats>({
    queryKey: ['outreach-campaign', selectedCampaignId],
    queryFn: () => coldOutreachApi.getCampaign(selectedCampaignId!),
    enabled: selectedCampaignId !== null,
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (id: number) => coldOutreachApi.deleteCampaign(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
      if (selectedCampaignId === deletedId) setSelectedCampaignId(null);
      toast.success('Campaign deleted');
    },
    onError: () => toast.error('Failed to delete campaign'),
  });

  const handleEditCampaign = (c: OutreachCampaign) => {
    setEditingCampaign(c);
    setIsNewCampaignOpen(true);
  };

  const handleDeleteCampaign = (id: number) => {
    if (window.confirm('Delete this campaign? Prospects stay but become unassigned.')) {
      deleteCampaignMutation.mutate(id);
    }
  };

  const handleCloseCampaignModal = () => {
    setIsNewCampaignOpen(false);
    setEditingCampaign(null);
  };

  const {
    data: prospects = [],
    isLoading,
    isError,
  } = useQuery<CallProspect[]>({
    queryKey: ['call-prospects', selectedCampaignId],
    queryFn: () =>
      coldCallsApi.list(
        selectedCampaignId === null ? undefined : { campaign_id: selectedCampaignId },
      ),
  });

  const updateProspectMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<CallProspectUpdate>) =>
      coldCallsApi.update(id, data),
    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: ['call-prospects', selectedCampaignId] });
      const previous = queryClient.getQueryData<CallProspect[]>(['call-prospects', selectedCampaignId]);
      queryClient.setQueryData<CallProspect[]>(['call-prospects', selectedCampaignId], (old) =>
        old
          ? old.map((p) =>
              p.id === id
                ? { ...p, ...data, updated_at: new Date().toISOString() }
                : p
            )
          : []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['call-prospects', selectedCampaignId], context.previous);
      }
      toast.error('Failed to update prospect');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => coldCallsApi.bulkDelete(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['call-prospects', selectedCampaignId] });
      const previous = queryClient.getQueryData<CallProspect[]>(['call-prospects', selectedCampaignId]);
      const idSet = new Set(ids);
      queryClient.setQueryData<CallProspect[]>(['call-prospects', selectedCampaignId], (old) =>
        old ? old.filter((p) => !idSet.has(p.id)) : []
      );
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['call-prospects', selectedCampaignId], context.previous);
      }
      toast.error('Failed to delete prospects');
    },
    onSuccess: (result) => {
      toast.success(`Deleted ${result.deleted_count} prospect${result.deleted_count === 1 ? '' : 's'}`);
      clearSelection();
      setIsConfirmDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
    },
  });

  const bulkUpdateLabelMutation = useMutation({
    mutationFn: ({ ids, label }: { ids: number[]; label: string | null }) =>
      coldCallsApi.bulkUpdateLabel(ids, label),
    onMutate: async ({ ids, label }) => {
      await queryClient.cancelQueries({ queryKey: ['call-prospects', selectedCampaignId] });
      const previous = queryClient.getQueryData<CallProspect[]>([
        'call-prospects',
        selectedCampaignId,
      ]);
      const idSet = new Set(ids);
      const cleaned = (label ?? '').trim() || null;
      queryClient.setQueryData<CallProspect[]>(
        ['call-prospects', selectedCampaignId],
        (old) =>
          old ? old.map((p) => (idSet.has(p.id) ? { ...p, script_label: cleaned } : p)) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['call-prospects', selectedCampaignId], context.previous);
      }
      toast.error('Failed to update labels');
    },
    onSuccess: (result, { label }) => {
      const cleaned = (label ?? '').trim() || null;
      if (cleaned === null) {
        toast.success(`Cleared ${result.updated_count} label${result.updated_count === 1 ? '' : 's'}`);
      } else {
        toast.success(`Labeled ${result.updated_count} prospect${result.updated_count === 1 ? '' : 's'}`);
      }
      clearSelection();
      setIsLabelPopoverOpen(false);
      setLabelInput('');
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
    },
  });

  const bulkUpdateTierMutation = useMutation({
    mutationFn: ({ ids, tier }: { ids: number[]; tier: ProspectTier | null }) =>
      coldCallsApi.bulkUpdateTier(ids, tier),
    onMutate: async ({ ids, tier }) => {
      await queryClient.cancelQueries({ queryKey: ['call-prospects', selectedCampaignId] });
      const previous = queryClient.getQueryData<CallProspect[]>([
        'call-prospects',
        selectedCampaignId,
      ]);
      const idSet = new Set(ids);
      queryClient.setQueryData<CallProspect[]>(
        ['call-prospects', selectedCampaignId],
        (old) =>
          old ? old.map((p) => (idSet.has(p.id) ? { ...p, tier } : p)) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['call-prospects', selectedCampaignId], context.previous);
      }
      toast.error('Failed to update tiers');
    },
    onSuccess: (result, { tier }) => {
      if (tier === null) {
        toast.success(`Cleared tier on ${result.updated_count} prospect${result.updated_count === 1 ? '' : 's'}`);
      } else {
        toast.success(`Tagged ${result.updated_count} prospect${result.updated_count === 1 ? '' : 's'}`);
      }
      clearSelection();
      setIsTierPopoverOpen(false);
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    const id = parseInt(draggableId.replace('cp-', ''), 10);
    const dest = destination.droppableId;
    if (dest.startsWith('step-')) {
      const newStep = parseInt(dest.slice(5), 10);
      if (!Number.isNaN(newStep)) {
        updateProspectMutation.mutate({ id, current_step: newStep });
      }
    } else {
      updateProspectMutation.mutate({ id, status: dest as CallStatus });
    }
  };

  const visibleProspects = useMemo(() => {
    if (!callbackFilterActive) return prospects;
    return prospects.filter(
      (p) => p.callback_at && isDueByEndOfToday(parseBackendDatetime(p.callback_at), now),
    );
  }, [prospects, callbackFilterActive, now]);

  const prospectsByStatus = useMemo(() => {
    const sorted = sortProspects(visibleProspects, sortKey);
    const map: Record<CallStatus, CallProspect[]> = {
      [CallStatus.NEW]: [],
      [CallStatus.ATTEMPTED]: [],
      [CallStatus.CONNECTED]: [],
      [CallStatus.DEAD]: [],
    };
    for (const p of sorted) {
      if (map[p.status]) {
        map[p.status].push(p);
      }
    }
    return map;
  }, [visibleProspects, sortKey]);

  // Step-based view: active only when a specific campaign is selected and it
  // has configured multi_touch_steps. Otherwise fall back to status kanban.
  const stepColumns: MultiTouchStep[] =
    selectedCampaignId !== null && selectedCampaignDetail
      ? selectedCampaignDetail.multi_touch_steps ?? []
      : [];
  const isStepView = stepColumns.length > 0;

  const prospectsByStep = useMemo(() => {
    const map: Record<number, CallProspect[]> = {};
    for (const s of stepColumns) map[s.step_number] = [];
    if (stepColumns.length === 0) return map;
    const sorted = sortProspects(visibleProspects, sortKey);
    for (const p of sorted) {
      const step = p.current_step ?? 1;
      if (map[step] !== undefined) {
        map[step].push(p);
      } else {
        // Out-of-range step: bucket into the first column rather than dropping.
        map[stepColumns[0].step_number].push(p);
      }
    }
    return map;
  }, [visibleProspects, stepColumns, sortKey]);

  const dueCount = useMemo(() => {
    let count = 0;
    for (const p of prospects) {
      if (p.callback_at && isDueByEndOfToday(parseBackendDatetime(p.callback_at), now)) {
        count += 1;
      }
    }
    return count;
  }, [prospects, now]);

  const stats: HubStat[] = [
    {
      icon: Circle,
      label: 'New',
      value: prospectsByStatus[CallStatus.NEW].length,
      accent: 'blue',
    },
    {
      icon: PhoneOutgoing,
      label: 'Attempted',
      value: prospectsByStatus[CallStatus.ATTEMPTED].length,
      accent: 'amber',
    },
    {
      icon: CheckCircle2,
      label: 'Connected',
      value: prospectsByStatus[CallStatus.CONNECTED].length,
      accent: 'emerald',
    },
    {
      icon: XCircle,
      label: 'Dead',
      value: prospectsByStatus[CallStatus.DEAD].length,
      accent: 'rose',
    },
    {
      icon: PhoneCall,
      label: 'Callbacks Due',
      value: dueCount,
      accent: 'orange',
      active: callbackFilterActive,
      onClick: () => {
        setCallbackFilterActive((prev) => {
          const next = !prev;
          // Turning ON the filter flips to callback_asc by default so the
          // user sees soonest-due first. Leave the dropdown alone on OFF so
          // the user's last-chosen sort sticks.
          if (next) setSortKey('callback_asc');
          return next;
        });
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Campaign selector row */}
      <div className="flex items-center justify-between">
        <CampaignSelector
          campaignTypes={[CampaignType.COLD_CALLS]}
          campaigns={campaigns}
          selectedId={selectedCampaignId}
          onSelect={setSelectedCampaignId}
          onNewClick={() => {
            setEditingCampaign(null);
            setIsNewCampaignOpen(true);
          }}
          onEditClick={handleEditCampaign}
          onDeleteClick={handleDeleteCampaign}
          isLoading={isCampaignsLoading}
        />
      </div>

      {/* Stats bar */}
      <HubStatsBar stats={stats} />

      {/* Kanban */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[--exec-text]">
            {isStepView ? 'Call Sequence' : 'Call Pipeline'}
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-[--exec-text-muted]">
              <span>Sort:</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className={cn(
                  'min-w-[180px] max-w-[220px] px-3 py-1.5 rounded-lg text-xs',
                  'bg-stone-800/50 border border-stone-600/40',
                  'text-[--exec-text]',
                  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                  'cursor-pointer appearance-none',
                )}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => setIsAddOpen(true)}
              className={smallPrimaryButtonClasses}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>
            <button
              onClick={() => setIsImportOpen(true)}
              className={smallPrimaryButtonClasses}
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-[--exec-text-muted]">
            Loading prospects...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-64 text-red-400">
            Failed to load prospects. Refresh to retry.
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div
              ref={kanbanScrollRef}
              className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 h-[calc(100vh-22rem)] min-h-[480px]"
            >
              {isStepView
                ? stepColumns.map((step) => (
                    <StepColumn
                      key={step.step_number}
                      step={step}
                      prospects={prospectsByStep[step.step_number] ?? []}
                      onCardClick={setSelectedProspect}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      now={now}
                    />
                  ))
                : COLUMNS.map((col) => (
                    <Column
                      key={col.status}
                      column={col}
                      prospects={prospectsByStatus[col.status]}
                      onCardClick={setSelectedProspect}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      now={now}
                    />
                  ))}
            </div>
          </DragDropContext>
        )}
      </div>

      {selectedProspect && (
        <CallProspectDetailModal
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
        />
      )}

      <ColdCallCsvImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        campaignId={selectedCampaignId}
      />

      <AddColdLeadModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        campaignId={selectedCampaignId}
      />

      <NewCampaignModal
        isOpen={isNewCampaignOpen}
        onClose={handleCloseCampaignModal}
        onCreated={(campaignId) => {
          if (!editingCampaign) setSelectedCampaignId(campaignId);
          handleCloseCampaignModal();
        }}
        defaultCampaignType={editingCampaign?.campaign_type ?? CampaignType.COLD_CALLS}
        editCampaign={editingCampaign}
      />

      {/* Floating Action Bar — appears when ≥1 prospect selected */}
      {selectedIds.size > 0 && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-200">
          {isLabelPopoverOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-stone-800 border border-stone-500/70 rounded-xl shadow-2xl shadow-black/60 ring-1 ring-black/40 p-3">
              <label className="block text-xs font-medium text-[--exec-text-secondary] mb-1.5">
                Label {selectedIds.size} prospect{selectedIds.size === 1 ? '' : 's'}
              </label>
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Script A"
                maxLength={50}
                autoFocus
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    labelInput.trim() &&
                    !bulkUpdateLabelMutation.isPending
                  ) {
                    e.preventDefault();
                    bulkUpdateLabelMutation.mutate({
                      ids: Array.from(selectedIds),
                      label: labelInput,
                    });
                  }
                  if (e.key === 'Escape') {
                    setIsLabelPopoverOpen(false);
                    setLabelInput('');
                  }
                }}
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-stone-900/60 border border-stone-600/40',
                  'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                )}
              />
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!labelInput.trim() || bulkUpdateLabelMutation.isPending) return;
                    bulkUpdateLabelMutation.mutate({
                      ids: Array.from(selectedIds),
                      label: labelInput,
                    });
                  }}
                  disabled={!labelInput.trim() || bulkUpdateLabelMutation.isPending}
                  className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-[--exec-accent] hover:bg-[--exec-accent-dark] rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (bulkUpdateLabelMutation.isPending) return;
                    bulkUpdateLabelMutation.mutate({
                      ids: Array.from(selectedIds),
                      label: null,
                    });
                  }}
                  disabled={bulkUpdateLabelMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors disabled:opacity-50"
                >
                  Clear label
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLabelPopoverOpen(false);
                    setLabelInput('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-[--exec-text-muted] hover:text-[--exec-text] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {isTierPopoverOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-stone-800 border border-stone-500/70 rounded-xl shadow-2xl shadow-black/60 ring-1 ring-black/40 p-3">
              <label className="block text-xs font-medium text-[--exec-text-secondary] mb-2">
                Set tier on {selectedIds.size} prospect{selectedIds.size === 1 ? '' : 's'}
              </label>
              <div className="space-y-1.5">
                {TIER_ORDER.map((t) => {
                  const meta = TIER_META[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        if (bulkUpdateTierMutation.isPending) return;
                        bulkUpdateTierMutation.mutate({
                          ids: Array.from(selectedIds),
                          tier: t,
                        });
                      }}
                      disabled={bulkUpdateTierMutation.isPending}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left',
                        'bg-stone-900/60 hover:bg-stone-700/60 disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      <span className="text-sm text-[--exec-text]">{meta.fullLabel}</span>
                      <span
                        className={cn(
                          'text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md',
                          meta.pillClasses,
                        )}
                      >
                        {meta.pillLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-stone-700/40">
                <button
                  type="button"
                  onClick={() => {
                    if (bulkUpdateTierMutation.isPending) return;
                    bulkUpdateTierMutation.mutate({
                      ids: Array.from(selectedIds),
                      tier: null,
                    });
                  }}
                  disabled={bulkUpdateTierMutation.isPending}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors disabled:opacity-50"
                >
                  Clear tier
                </button>
                <button
                  type="button"
                  onClick={() => setIsTierPopoverOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[--exec-text-muted] hover:text-[--exec-text] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 bg-stone-800 border border-stone-500/70 rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-black/40">
            <span className="text-sm font-semibold text-[--exec-text] px-2">
              {selectedIds.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
            <button
              onClick={() => {
                setIsTierPopoverOpen(false);
                setIsLabelPopoverOpen((v) => !v);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
              Set label
            </button>
            <button
              onClick={() => {
                setIsLabelPopoverOpen(false);
                setIsTierPopoverOpen((v) => !v);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/70 hover:bg-stone-600/70 rounded-lg transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              Set tier
            </button>
            <button
              onClick={() => setIsConfirmDeleteOpen(true)}
              disabled={bulkDeleteMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Delete Confirmation Modal — Pattern A */}
      {isConfirmDeleteOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={() => !bulkDeleteMutation.isPending && setIsConfirmDeleteOpen(false)}
        >
          <div
            className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-[--exec-text]">
                    Delete {selectedIds.size} prospect{selectedIds.size === 1 ? '' : 's'}?
                  </h2>
                  <p className="text-sm text-[--exec-text-muted] mt-1">
                    This permanently removes them from your pipeline. Cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(false)}
                  disabled={bulkDeleteMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                  disabled={bulkDeleteMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkDeleteMutation.isPending ? 'Deleting…' : `Delete ${selectedIds.size}`}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
