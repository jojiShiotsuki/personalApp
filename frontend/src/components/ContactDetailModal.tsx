import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Contact } from '@/types';
import { InteractionType } from '@/types';
import { interactionApi } from '@/lib/api';
import { X, Mail, Phone, Building2, User, Calendar, Phone as PhoneIcon, FileText, Edit, Share2, Trash2 } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, parseISO } from 'date-fns';

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
    color: 'text-blue-600',
    bg: 'bg-blue-100'
  },
  [InteractionType.EMAIL]: {
    icon: Mail,
    color: 'text-green-600',
    bg: 'bg-green-100'
  },
  [InteractionType.CALL]: {
    icon: PhoneIcon,
    color: 'text-orange-600',
    bg: 'bg-orange-100'
  },
  [InteractionType.NOTE]: {
    icon: FileText,
    color: 'text-gray-600',
    bg: 'bg-gray-100'
  },
  [InteractionType.SOCIAL_MEDIA]: {
    icon: Share2,
    color: 'text-purple-600',
    bg: 'bg-purple-100'
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

  const handleDelete = (interactionId: number, subject: string) => {
    if (confirm(`Delete interaction "${subject || 'this interaction'}"?`)) {
      deleteMutation.mutate(interactionId);
    }
  };

  // Sort interactions by date (newest first)
  const sortedInteractions = [...interactions].sort((a, b) =>
    new Date(b.interaction_date).getTime() - new Date(a.interaction_date).getTime()
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Contact Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body - Two Column Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column - Contact Info */}
          <div className="w-80 border-r border-gray-200 p-6 overflow-y-auto">
            {/* Contact Summary Card */}
            <div className="flex items-start mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-xl font-semibold text-gray-900">
                  {contact.name}
                </h3>
                <span
                  className={`inline-block px-2 py-1 text-xs rounded mt-2 ${
                    contact.status === 'client'
                      ? 'bg-green-100 text-green-700'
                      : contact.status === 'prospect'
                      ? 'bg-blue-100 text-blue-700'
                      : contact.status === 'lead'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {contact.status}
                </span>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-4 mb-6">
              {contact.email && (
                <div className="flex items-start">
                  <Mail className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-sm text-blue-600 hover:underline break-all"
                    >
                      {contact.email}
                    </a>
                  </div>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-start">
                  <Phone className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Phone</p>
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-sm text-gray-900 hover:underline"
                    >
                      {contact.phone}
                    </a>
                  </div>
                </div>
              )}

              {contact.company && (
                <div className="flex items-start">
                  <Building2 className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Company</p>
                    <p className="text-sm text-gray-900">{contact.company}</p>
                  </div>
                </div>
              )}

              {contact.source && (
                <div className="flex items-start">
                  <FileText className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Source</p>
                    <p className="text-sm text-gray-900">{contact.source}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes Section */}
            {contact.notes && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {contact.notes}
                </p>
              </div>
            )}

            {/* Edit Contact Button */}
            <button
              onClick={onEditContact}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Contact
            </button>
          </div>

          {/* Right Column - Interaction Timeline */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Timeline Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Interaction History
              </h3>
              <button
                onClick={onAddInteraction}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Interaction
              </button>
            </div>

            {/* Timeline Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : sortedInteractions.length > 0 ? (
                <div className="space-y-4">
                  {sortedInteractions.map((interaction, index) => {
                    const iconConfig = interactionIcons[interaction.type];
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
                            <div className="w-0.5 bg-gray-200 flex-1 min-h-[40px]"></div>
                          )}
                        </div>

                        {/* Interaction Content */}
                        <div className="flex-1 pb-6">
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">
                                  {interaction.subject || `${interaction.type.charAt(0).toUpperCase() + interaction.type.slice(1)}`}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">
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
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete interaction"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {interaction.notes && (
                              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
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
                  <FileText className="w-16 h-16 text-gray-400 mb-4" />
                  <p className="text-gray-500 font-medium">No interactions yet</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Add your first interaction to track this relationship.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
