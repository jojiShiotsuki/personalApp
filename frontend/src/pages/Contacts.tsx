import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactApi } from '@/lib/api';
import type { Contact, ContactCreate } from '@/types';
import { ContactStatus } from '@/types';
import { Plus, Search, User, Mail, Phone, Building2, MoreHorizontal, Trash2, Edit2, ExternalLink } from 'lucide-react';
import ContactDetailModal from '@/components/ContactDetailModal';
import ContactModal from '@/components/ContactModal';
import AddInteractionModal from '@/components/AddInteractionModal';
import ConfirmModal from '@/components/ConfirmModal';
import AIChatPanel from '@/components/AIChatPanel';
import { cn } from '@/lib/utils';

export default function Contacts() {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isAddInteractionOpen, setIsAddInteractionOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<number | null>(null);
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
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ContactCreate> }) =>
      contactApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsModalOpen(false);
      setEditingContact(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => contactApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
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

  

  return (
    <div className="flex h-full bg-gray-50">
      <div className="flex-1 h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200/60 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contacts</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your contacts and relationships
            </p>
          </div>
          <button
            onClick={handleNewContact}
            className="group flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5 mr-2 transition-transform duration-200 group-hover:rotate-90" />
            New Contact
          </button>
        </div>

        {/* Search */}
        <div className="mt-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
          />
        </div>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
          </div>
        ) : contacts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
            {contacts.map((contact) => {
              return (
              <div
                key={contact.id}
                className="group bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5 hover:shadow-xl hover:shadow-gray-200/50 hover:border-gray-300 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm",
                      getRandomColor(contact.name)
                    )}>
                      {getInitials(contact.name)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 line-clamp-1">
                        {contact.name}
                      </h3>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide mt-1",
                          contact.status === ContactStatus.CLIENT
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : contact.status === ContactStatus.PROSPECT
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        )}
                      >
                        {contact.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedContact(contact)}
                    className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2.5 mb-5">
                  {contact.company && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Building2 className="w-4 h-4 mr-2.5 text-gray-400" />
                      <span className="truncate">{contact.company}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="w-4 h-4 mr-2.5 text-gray-400" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="w-4 h-4 mr-2.5 text-gray-400" />
                      <span className="truncate">{contact.phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={() => setSelectedContact(contact)}
                    className="flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    View
                  </button>
                  <button
                    onClick={() => handleEdit(contact)}
                    className="flex items-center justify-center p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setContactToDelete(contact.id)}
                    className="flex items-center justify-center p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No contacts found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              {searchTerm ? `No contacts match "${searchTerm}"` : "Get started by adding your first contact to manage your relationships."}
            </p>
            {!searchTerm && (
              <button
                onClick={handleNewContact}
                className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
              >
                Add Contact
              </button>
            )}
          </div>
        )}
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
      <AIChatPanel />
    </div>
  );
}