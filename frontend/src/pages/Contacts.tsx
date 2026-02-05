import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactApi } from '@/lib/api';
import type { Contact, ContactCreate } from '@/types';
import { ContactStatus } from '@/types';
import { Plus, Search, User, Mail, Phone, Building2, MoreHorizontal, Trash2, Edit2, ExternalLink, MapPin, Wrench, Globe, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import ContactDetailModal from '@/components/ContactDetailModal';
import ContactModal from '@/components/ContactModal';
import AddInteractionModal from '@/components/AddInteractionModal';
import ConfirmModal from '@/components/ConfirmModal';
import SendDMPanel, { type SendDMSource } from '@/components/outreach/SendDMPanel';
import { cn } from '@/lib/utils';

export default function Contacts() {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isAddInteractionOpen, setIsAddInteractionOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<number | null>(null);
  const [isSendDMPanelOpen, setIsSendDMPanelOpen] = useState(false);
  const [selectedContactForDM, setSelectedContactForDM] = useState<SendDMSource | null>(null);
  const queryClient = useQueryClient();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRandomColor = (name: string) => {
    const colors = [
      'bg-red-100 text-red-700',
      'bg-orange-100 text-orange-700',
      'bg-amber-100 text-amber-700',
      'bg-green-100 text-green-700',
      'bg-emerald-100 text-emerald-700',
      'bg-teal-100 text-teal-700',
      'bg-cyan-100 text-cyan-700',
      'bg-sky-100 text-sky-700',
      'bg-blue-100 text-blue-700',
      'bg-indigo-100 text-indigo-700',
      'bg-violet-100 text-violet-700',
      'bg-purple-100 text-purple-700',
      'bg-fuchsia-100 text-fuchsia-700',
      'bg-pink-100 text-pink-700',
      'bg-rose-100 text-rose-700',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', searchTerm],
    queryFn: () => contactApi.getAll(searchTerm || undefined),
  });

  // Handle navigation from deal follow-up warning modal
  useEffect(() => {
    const state = location.state as { contactId?: number; openInteraction?: boolean } | null;
    if (state?.contactId && state?.openInteraction && contacts.length > 0) {
      const contact = contacts.find(c => c.id === state.contactId);
      if (contact) {
        setSelectedContact(contact);
        setIsAddInteractionOpen(true);
        // Clear the state to prevent re-triggering on subsequent renders
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, contacts]);

  const createMutation = useMutation({
    mutationFn: (contact: ContactCreate) => contactApi.create(contact),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsModalOpen(false);
      setEditingContact(null);
      toast.success('Contact created successfully');
    },
    onError: () => {
      toast.error('Failed to create contact. Please try again.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ContactCreate> }) =>
      contactApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsModalOpen(false);
      setEditingContact(null);
      toast.success('Contact updated successfully');
    },
    onError: () => {
      toast.error('Failed to update contact. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => contactApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact deleted');
    },
    onError: () => {
      toast.error('Failed to delete contact. Please try again.');
    },
  });

  const handleSubmit = (data: ContactCreate) => {
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setIsModalOpen(true);
  };

  const handleNewContact = () => {
    setEditingContact(null);
    setIsModalOpen(true);
  };

  // Open Send DM panel for a contact
  const openSendDMPanel = (contact: Contact) => {
    // Parse website_issues if it exists (stored as JSON string or array)
    let websiteIssues: string[] = [];
    if (contact.website_issues) {
      try {
        if (typeof contact.website_issues === 'string') {
          websiteIssues = JSON.parse(contact.website_issues);
        } else if (Array.isArray(contact.website_issues)) {
          websiteIssues = contact.website_issues;
        }
      } catch {
        // If parsing fails, treat as single issue
        websiteIssues = [String(contact.website_issues)];
      }
    }

    setSelectedContactForDM({
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
    });
    setIsSendDMPanelOpen(true);
  };



  return (
    <div className="flex h-full bg-[--exec-bg]">
      <div className="flex-1 h-full flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="px-8 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[--exec-text] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Contacts</h1>
            <p className="mt-1 text-sm text-[--exec-text-muted]">
              Manage your contacts and relationships
            </p>
          </div>
          <button
            onClick={handleNewContact}
            className={cn(
              'group flex items-center',
              'px-4 py-2',
              'bg-[--exec-accent] text-white',
              'rounded-xl',
              'hover:bg-[--exec-accent-dark]',
              'transition-all duration-200',
              'shadow-sm hover:shadow-md',
              'text-sm font-medium'
            )}
          >
            <Plus className="w-5 h-5 mr-2 transition-transform duration-200 group-hover:rotate-90" />
            New Contact
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="flex-1 overflow-hidden px-8 pb-6">
        <div className="bento-card-static h-full flex flex-col overflow-hidden">
          {/* Search Row */}
          <div className="px-6 py-4 border-b border-[--exec-border]/30">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[--exec-text-muted]" />
              <input
                type="text"
                placeholder="Search contacts by name, email, or company..."
                aria-label="Search contacts"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  'w-full px-4 py-2 pl-10',
                  'bg-[--exec-surface-alt] border-0 rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20',
                  'transition-all duration-200',
                  'text-sm text-[--exec-text] placeholder-[--exec-text-muted]'
                )}
              />
            </div>
          </div>

          {/* Contact Grid */}
          <div className="flex-1 overflow-auto p-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[--exec-text-muted]"></div>
              </div>
            ) : contacts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-500">
                {contacts.map((contact) => {
                  return (
                  <div
                    key={contact.id}
                    className={cn(
                      "group rounded-xl p-4",
                      "bg-stone-800/40 border border-stone-600/40",
                      "hover:bg-stone-800/60 hover:border-stone-600/60",
                      "transition-all duration-300"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold",
                          getRandomColor(contact.name)
                        )}>
                          {getInitials(contact.name)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-[--exec-text] line-clamp-1 text-sm">
                            {contact.name}
                          </h3>
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide mt-1",
                              contact.status === ContactStatus.CLIENT
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : contact.status === ContactStatus.PROSPECT
                                ? 'bg-sky-500/20 text-sky-400'
                                : 'bg-stone-600/50 text-stone-400'
                            )}
                          >
                            {contact.status}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedContact(contact)}
                        className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 rounded-lg hover:bg-stone-700/50 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 mb-4">
                      {contact.company && (
                        <div className="flex items-center text-sm text-[--exec-text-secondary]">
                          <Building2 className="w-3.5 h-3.5 mr-2 text-[--exec-text-muted]" />
                          <span className="truncate">{contact.company}</span>
                        </div>
                      )}
                      {contact.industry && (
                        <div className="flex items-center text-sm text-[--exec-text-secondary]">
                          <Wrench className="w-3.5 h-3.5 mr-2 text-[--exec-text-muted]" />
                          <span className="truncate capitalize">{contact.industry}</span>
                        </div>
                      )}
                      {(contact.suburb || contact.city) && (
                        <div className="flex items-center text-sm text-[--exec-text-secondary]">
                          <MapPin className="w-3.5 h-3.5 mr-2 text-[--exec-text-muted]" />
                          <span className="truncate">
                            {[contact.suburb, contact.city].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center text-sm text-[--exec-text-secondary]">
                          <Mail className="w-3.5 h-3.5 mr-2 text-[--exec-text-muted]" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center text-sm text-[--exec-text-secondary]">
                          <Phone className="w-3.5 h-3.5 mr-2 text-[--exec-text-muted]" />
                          <span className="truncate">{contact.phone}</span>
                        </div>
                      )}
                      {contact.website_url && (
                        <div className="flex items-center text-sm text-[--exec-text-secondary]">
                          <Globe className="w-3.5 h-3.5 mr-2 text-[--exec-text-muted]" />
                          <a
                            href={contact.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-[--exec-accent] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {contact.website_url.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-stone-700/30 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => setSelectedContact(contact)}
                        className="flex-1 flex items-center justify-center px-3 py-1.5 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/50 hover:bg-stone-600/50 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 mr-1.5" />
                        View
                      </button>
                      <button
                        onClick={() => openSendDMPanel(contact)}
                        className="flex items-center justify-center p-1.5 text-[--exec-text-muted] hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                        title="Send DM"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleEdit(contact)}
                        className="flex items-center justify-center p-1.5 text-[--exec-text-muted] hover:text-[--exec-accent] hover:bg-[--exec-accent]/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setContactToDelete(contact.id)}
                        className="flex items-center justify-center p-1.5 text-[--exec-text-muted] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-stone-700/50 rounded-full flex items-center justify-center mb-4">
                  <User className="w-8 h-8 text-[--exec-text-muted]" />
                </div>
                <h3 className="text-lg font-semibold text-[--exec-text] mb-1">No contacts found</h3>
                <p className="text-[--exec-text-muted] text-sm max-w-sm mx-auto">
                  {searchTerm ? `No contacts match "${searchTerm}"` : "Get started by adding your first contact to manage your relationships."}
                </p>
                {!searchTerm && (
                  <button
                    onClick={handleNewContact}
                    className="mt-6 px-4 py-2 bg-[--exec-accent] text-white rounded-lg hover:bg-[--exec-accent-dark] transition-colors shadow-sm text-sm font-medium"
                  >
                    Add Contact
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <ContactModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingContact(null);
        }}
        onSubmit={handleSubmit}
        contact={editingContact}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onAddInteraction={() => setIsAddInteractionOpen(true)}
          onEditContact={() => {
            setSelectedContact(null);
            handleEdit(selectedContact);
          }}
        />
      )}

      {/* Add Interaction Modal */}
      {isAddInteractionOpen && selectedContact && (
        <AddInteractionModal
          contactId={selectedContact.id}
          onClose={() => setIsAddInteractionOpen(false)}
        />
      )}
      </div>

      <ConfirmModal
        isOpen={contactToDelete !== null}
        onClose={() => setContactToDelete(null)}
        onConfirm={() => {
          if (contactToDelete !== null) {
            deleteMutation.mutate(contactToDelete);
          }
          setContactToDelete(null);
        }}
        title="Delete Contact"
        message="Are you sure you want to delete this contact? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      {/* Send DM Panel */}
      <SendDMPanel
        isOpen={isSendDMPanelOpen}
        onClose={() => setIsSendDMPanelOpen(false)}
        source={selectedContactForDM}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        }}
      />
    </div>
  );
}