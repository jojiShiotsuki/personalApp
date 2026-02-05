import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Contact } from '@/types';
import { InteractionType, ContactStatus } from '@/types';
import { interactionApi } from '@/lib/api';
import { X, Mail, Phone, Building2, User, Calendar, Phone as PhoneIcon, FileText, Edit, Share2, Trash2, Globe, MapPin, Gauge, Wrench, AlertTriangle, Linkedin, Video, CalendarClock, ExternalLink, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, parseISO } from 'date-fns';
import ConfirmModal from './ConfirmModal';
import SendDMPanel, { type SendDMSource } from '@/components/outreach/SendDMPanel';
import { cn } from '@/lib/utils';

interface ContactDetailModalProps {
  contact: Contact;
  onClose: () => void;
  onAddInteraction: () => void;
  onEditContact: () => void;
}

// Icon mapping for interaction types
const interactionIcons = {
  [InteractionType.MEETING]: {
    icon: Calendar,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20'
  },
  [InteractionType.EMAIL]: {
    icon: Mail,
    color: 'text-green-400',
    bg: 'bg-green-500/20'
  },
  [InteractionType.CALL]: {
    icon: PhoneIcon,
    color: 'text-orange-400',
    bg: 'bg-orange-500/20'
  },
  [InteractionType.NOTE]: {
    icon: FileText,
    color: 'text-stone-400',
    bg: 'bg-stone-500/20'
  },
  [InteractionType.SOCIAL_MEDIA]: {
    icon: Share2,
    color: 'text-purple-400',
    bg: 'bg-purple-500/20'
  },
  [InteractionType.FOLLOW_UP_EMAIL]: {
    icon: Mail,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20'
  },
};

// Format interaction date with relative time
const formatInteractionDate = (date: string): string => {
  const d = parseISO(date);
  if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true });
  if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, yyyy');
};

export default function ContactDetailModal({
  contact,
  onClose,
  onAddInteraction,
  onEditContact,
}: ContactDetailModalProps) {
  const queryClient = useQueryClient();

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ['interactions', contact.id],
    queryFn: () => interactionApi.getAll(contact.id),
  });

  const deleteMutation = useMutation({
    mutationFn: (interactionId: number) => interactionApi.delete(interactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions', contact.id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const [interactionToDelete, setInteractionToDelete] = useState<{id: number, subject: string} | null>(null);
  const [isSendDMPanelOpen, setIsSendDMPanelOpen] = useState(false);

  const handleDelete = (interactionId: number, subject: string) => {
    setInteractionToDelete({ id: interactionId, subject });
  };

  // Convert contact to SendDMSource
  const getContactAsDMSource = (): SendDMSource => {
    // Parse website_issues if it exists
    let websiteIssues: string[] = [];
    if (contact.website_issues) {
      try {
        if (typeof contact.website_issues === 'string') {
          websiteIssues = JSON.parse(contact.website_issues);
        } else if (Array.isArray(contact.website_issues)) {
          websiteIssues = contact.website_issues;
        }
      } catch {
        // If parsing fails, ignore
      }
    }

    return {
      type: 'contact',
      id: contact.id,
      name: contact.name,
      company: contact.company || '',
      city: contact.city || contact.suburb || undefined,
      niche: contact.industry || undefined,
      website: contact.website_url || undefined,
      websiteIssues: websiteIssues.length > 0 ? websiteIssues : undefined,
      email: contact.email || undefined,
      emailStage: contact.email_stage || undefined,
      linkedinStage: contact.linkedin_stage || undefined,
    };
  };

  // Sort interactions by date (newest first)
  const sortedInteractions = [...interactions].sort((a, b) =>
    new Date(b.interaction_date).getTime() - new Date(a.interaction_date).getTime()
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-700/30">
          <h2 className="text-xl font-bold text-[--exec-text]">Contact Details</h2>
          <button
            onClick={onClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body - Two Column Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column - Contact Info */}
          <div className="w-80 border-r border-stone-700/30 p-6 overflow-y-auto">
            {/* Contact Summary Card */}
            <div className="flex items-start mb-6">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8 text-blue-400" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-xl font-semibold text-[--exec-text]">
                  {contact.name}
                </h3>
                <span
                  className={cn(
                    "inline-block px-2 py-1 text-xs rounded mt-2",
                    contact.status === ContactStatus.CLIENT
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : contact.status === ContactStatus.PROSPECT
                      ? 'bg-sky-500/20 text-sky-400'
                      : contact.status === ContactStatus.LEAD
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-stone-600/50 text-stone-400'
                  )}
                >
                  {contact.status}
                </span>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-4 mb-6">
              {contact.email && (
                <div className="flex items-start">
                  <Mail className="w-5 h-5 text-[--exec-text-muted] mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[--exec-text-muted] mb-1">Email</p>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-sm text-[--exec-accent] hover:underline break-all"
                    >
                      {contact.email}
                    </a>
                  </div>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-start">
                  <Phone className="w-5 h-5 text-[--exec-text-muted] mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[--exec-text-muted] mb-1">Phone</p>
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-sm text-[--exec-text] hover:underline"
                    >
                      {contact.phone}
                    </a>
                  </div>
                </div>
              )}

              {contact.company && (
                <div className="flex items-start">
                  <Building2 className="w-5 h-5 text-[--exec-text-muted] mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[--exec-text-muted] mb-1">Company</p>
                    <p className="text-sm text-[--exec-text]">{contact.company}</p>
                  </div>
                </div>
              )}

              {contact.source && (
                <div className="flex items-start">
                  <FileText className="w-5 h-5 text-[--exec-text-muted] mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[--exec-text-muted] mb-1">Source</p>
                    <p className="text-sm text-[--exec-text]">{contact.source}</p>
                  </div>
                </div>
              )}

              {contact.industry && (
                <div className="flex items-start">
                  <Wrench className="w-5 h-5 text-[--exec-text-muted] mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[--exec-text-muted] mb-1">Industry</p>
                    <p className="text-sm text-[--exec-text] capitalize">{contact.industry}</p>
                  </div>
                </div>
              )}

              {(contact.suburb || contact.city) && (
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-[--exec-text-muted] mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[--exec-text-muted] mb-1">Location</p>
                    <p className="text-sm text-[--exec-text]">
                      {[contact.suburb, contact.city].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {contact.website_url && (
                <div className="flex items-start">
                  <Globe className="w-5 h-5 text-[--exec-text-muted] mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[--exec-text-muted] mb-1">Website</p>
                    <a
                      href={contact.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[--exec-accent] hover:underline break-all"
                    >
                      {contact.website_url.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                </div>
              )}

              {contact.website_speed_score !== undefined && contact.website_speed_score !== null && (
                <div className="flex items-start">
                  <Gauge className="w-5 h-5 text-[--exec-text-muted] mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[--exec-text-muted] mb-1">Speed Score</p>
                    <p className={cn(
                      "text-sm font-medium",
                      contact.website_speed_score >= 90 ? "text-green-400" :
                      contact.website_speed_score >= 50 ? "text-yellow-400" :
                      "text-red-400"
                    )}>
                      {contact.website_speed_score}/100
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Website Issues Section */}
            {contact.website_issues && (() => {
              try {
                const issues = JSON.parse(contact.website_issues);
                if (issues.length > 0) {
                  const issueLabels: Record<string, string> = {
                    slow_loading: 'Slow Loading',
                    not_mobile_friendly: 'Not Mobile Friendly',
                    no_ssl: 'No SSL/HTTPS',
                    outdated_design: 'Outdated Design',
                    no_cta: 'No Clear CTA',
                    hard_to_find_contact: 'Hard to Find Contact',
                    no_reviews: 'No Reviews',
                    stock_photos: 'Stock Photos',
                    no_service_area: 'No Service Area',
                  };
                  return (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-[--exec-text-secondary] mb-2 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-1.5 text-red-400" />
                        Website Issues
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {issues.map((issue: string) => (
                          <span
                            key={issue}
                            className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded"
                          >
                            {issueLabels[issue] || issue}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              } catch {
                return null;
              }
            })()}

            {/* Outreach Tracking Section */}
            {(contact.email_stage || contact.linkedin_stage || contact.loom_audit_sent || contact.next_followup_date) && (
              <div className="mb-6 pt-4 border-t border-stone-700/30">
                <h4 className="text-sm font-semibold text-[--exec-text-secondary] mb-3 flex items-center">
                  <Mail className="w-4 h-4 mr-1.5 text-[--exec-accent]" />
                  Outreach Status
                </h4>
                <div className="space-y-2">
                  {/* Email Stage */}
                  {contact.email_stage && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[--exec-text-muted] flex items-center">
                        <Mail className="w-3.5 h-3.5 mr-1.5" />
                        Email
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 text-xs rounded",
                          contact.email_stage === 'replied' ? "bg-green-500/20 text-green-400" :
                          contact.email_stage === 'break_up' ? "bg-orange-500/20 text-orange-400" :
                          "bg-blue-500/20 text-blue-400"
                        )}>
                          {contact.email_stage === 'email_1' ? 'Email 1' :
                           contact.email_stage === 'follow_up' ? 'Follow-up' :
                           contact.email_stage === 'break_up' ? 'Break-up' :
                           contact.email_stage === 'replied' ? 'Replied' :
                           contact.email_stage}
                        </span>
                        {contact.email_last_sent && (
                          <span className="text-xs text-[--exec-text-muted]">
                            {format(parseISO(contact.email_last_sent), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* LinkedIn Stage */}
                  {contact.linkedin_stage && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[--exec-text-muted] flex items-center">
                        <Linkedin className="w-3.5 h-3.5 mr-1.5" />
                        LinkedIn
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 text-xs rounded",
                          contact.linkedin_stage === 'replied' ? "bg-green-500/20 text-green-400" :
                          contact.linkedin_stage === 'connected' ? "bg-blue-500/20 text-blue-400" :
                          "bg-purple-500/20 text-purple-400"
                        )}>
                          {contact.linkedin_stage === 'requested' ? 'Requested' :
                           contact.linkedin_stage === 'connected' ? 'Connected' :
                           contact.linkedin_stage === 'message_1' ? 'Msg 1' :
                           contact.linkedin_stage === 'message_2' ? 'Msg 2' :
                           contact.linkedin_stage === 'replied' ? 'Replied' :
                           contact.linkedin_stage}
                        </span>
                        {contact.linkedin_last_action && (
                          <span className="text-xs text-[--exec-text-muted]">
                            {format(parseISO(contact.linkedin_last_action), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Loom Audit */}
                  {contact.loom_audit_sent && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[--exec-text-muted] flex items-center">
                        <Video className="w-3.5 h-3.5 mr-1.5" />
                        Loom Audit
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">
                          Sent
                        </span>
                        {contact.loom_audit_url && (
                          <a
                            href={contact.loom_audit_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[--exec-accent] hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Next Follow-up */}
                  {contact.next_followup_date && (
                    <div className="flex items-center justify-between pt-2 border-t border-stone-700/20">
                      <span className="text-xs text-[--exec-text-muted] flex items-center">
                        <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                        Next Follow-up
                      </span>
                      <span className={cn(
                        "text-xs font-medium",
                        new Date(contact.next_followup_date) <= new Date() ? "text-red-400" : "text-[--exec-text]"
                      )}>
                        {format(parseISO(contact.next_followup_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes Section */}
            {contact.notes && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[--exec-text-secondary] mb-2">Notes</h4>
                <p className="text-sm text-[--exec-text-muted] whitespace-pre-wrap">
                  {contact.notes}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => setIsSendDMPanelOpen(true)}
                className="w-full flex items-center justify-center px-4 py-2 bg-[--exec-accent] text-white rounded-lg hover:bg-[--exec-accent-dark] transition-colors"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Send DM
              </button>
              <button
                onClick={onEditContact}
                className="w-full flex items-center justify-center px-4 py-2 bg-stone-700/50 text-[--exec-text-secondary] rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Contact
              </button>
            </div>
          </div>

          {/* Right Column - Interaction Timeline */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Timeline Header */}
            <div className="px-6 py-4 border-b border-stone-700/30 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[--exec-text]">
                Interaction History
              </h3>
              <button
                onClick={onAddInteraction}
                className="px-4 py-2 bg-[--exec-accent] text-white rounded-lg hover:bg-[--exec-accent-dark] transition-colors text-sm font-medium"
              >
                Add Interaction
              </button>
            </div>

            {/* Timeline Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[--exec-accent]"></div>
                </div>
              ) : sortedInteractions.length > 0 ? (
                <div className="space-y-4">
                  {sortedInteractions.map((interaction, index) => {
                    const iconConfig = interactionIcons[interaction.type] || interactionIcons[InteractionType.NOTE];
                    const IconComponent = iconConfig.icon;

                    return (
                      <div key={interaction.id} className="flex">
                        {/* Timeline Line */}
                        <div className="flex flex-col items-center mr-4">
                          <div
                            className={`w-10 h-10 rounded-full ${iconConfig.bg} flex items-center justify-center flex-shrink-0`}
                          >
                            <IconComponent className={`w-5 h-5 ${iconConfig.color}`} />
                          </div>
                          {index < sortedInteractions.length - 1 && (
                            <div className="w-0.5 bg-stone-700/50 flex-1 min-h-[40px]"></div>
                          )}
                        </div>

                        {/* Interaction Content */}
                        <div className="flex-1 pb-6">
                          <div className="bg-stone-800/40 border border-stone-600/40 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold text-[--exec-text]">
                                  {interaction.subject || `${interaction.type.charAt(0).toUpperCase() + interaction.type.slice(1)}`}
                                </h4>
                                <p className="text-xs text-[--exec-text-muted] mt-1">
                                  {formatInteractionDate(interaction.interaction_date)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 text-xs rounded ${iconConfig.bg} ${iconConfig.color}`}
                                >
                                  {interaction.type}
                                </span>
                                <button
                                  onClick={() => handleDelete(interaction.id, interaction.subject || "Interaction")}
                                  className="p-1 text-[--exec-text-muted] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                  title="Delete interaction"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {interaction.notes && (
                              <p className="text-sm text-[--exec-text-secondary] mt-2 whitespace-pre-wrap">
                                {interaction.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-16 h-16 text-[--exec-text-muted] mb-4" />
                  <p className="text-[--exec-text-secondary] font-medium">No interactions yet</p>
                  <p className="text-sm text-[--exec-text-muted] mt-2">
                    Add your first interaction to track this relationship.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={interactionToDelete !== null}
        onClose={() => setInteractionToDelete(null)}
        onConfirm={() => {
          if (interactionToDelete) {
            deleteMutation.mutate(interactionToDelete.id);
          }
          setInteractionToDelete(null);
        }}
        title="Delete Interaction"
        message={`Are you sure you want to delete "${interactionToDelete?.subject || 'this interaction'}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Send DM Panel */}
      <SendDMPanel
        isOpen={isSendDMPanelOpen}
        onClose={() => setIsSendDMPanelOpen(false)}
        source={isSendDMPanelOpen ? getContactAsDMSource() : null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        }}
      />
    </div>
  );
}
