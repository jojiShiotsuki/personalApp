import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactApi } from '@/lib/api';
import type { Contact, ContactCreate } from '@/types';
import { ContactStatus } from '@/types';
import { Plus, Search, User, Mail, Phone, Building2, X } from 'lucide-react';
import ContactDetailModal from '@/components/ContactDetailModal';
import AddInteractionModal from '@/components/AddInteractionModal';

export default function Contacts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isAddInteractionOpen, setIsAddInteractionOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', searchTerm],
    queryFn: () => contactApi.getAll(searchTerm || undefined),
  });

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: ContactCreate = {
      name: formData.get('name') as string,
      email: formData.get('email') as string || undefined,
      phone: formData.get('phone') as string || undefined,
      company: formData.get('company') as string || undefined,
      status: (formData.get('status') as ContactStatus) || ContactStatus.LEAD,
      notes: formData.get('notes') as string || undefined,
    };

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your contacts and relationships
            </p>
          </div>
          <button
            onClick={handleNewContact}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Contact
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border-b px-8 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : contacts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {contact.name}
                      </h3>
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded mt-1 ${
                          contact.status === ContactStatus.CLIENT
                            ? 'bg-green-100 text-green-700'
                            : contact.status === ContactStatus.PROSPECT
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {contact.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {contact.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="w-4 h-4 mr-2" />
                      {contact.email}
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="w-4 h-4 mr-2" />
                      {contact.phone}
                    </div>
                  )}
                  {contact.company && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Building2 className="w-4 h-4 mr-2" />
                      {contact.company}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => setSelectedContact(contact)}
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleEdit(contact)}
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this contact?')) {
                        deleteMutation.mutate(contact.id);
                      }
                    }}
                    className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <User className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-gray-500">No contacts found</p>
            <p className="text-sm text-gray-400 mt-2">
              Create your first contact to get started
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingContact ? 'Edit Contact' : 'New Contact'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingContact(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingContact?.name}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingContact?.email}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editingContact?.phone}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  name="company"
                  defaultValue={editingContact?.company}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue={editingContact?.status || ContactStatus.LEAD}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={ContactStatus.LEAD}>Lead</option>
                  <option value={ContactStatus.PROSPECT}>Prospect</option>
                  <option value={ContactStatus.CLIENT}>Client</option>
                  <option value={ContactStatus.INACTIVE}>Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  defaultValue={editingContact?.notes}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingContact(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingContact
                    ? 'Update'
                    : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
  );
}
