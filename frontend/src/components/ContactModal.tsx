import { useState, useEffect } from 'react';
import { X, Globe, MapPin, Gauge, Mail, Linkedin, Video, CalendarClock } from 'lucide-react';
import { Contact, ContactCreate, ContactStatus } from '@/types';
import { cn } from '@/lib/utils';

// Email outreach stages
const EMAIL_STAGES = [
  { value: '', label: 'Not Sent' },
  { value: 'email_1', label: 'Email 1 Sent' },
  { value: 'follow_up', label: 'Follow-up Sent' },
  { value: 'break_up', label: 'Break-up Sent' },
  { value: 'replied', label: 'Replied' },
];

// LinkedIn outreach stages
const LINKEDIN_STAGES = [
  { value: '', label: 'Not Connected' },
  { value: 'requested', label: 'Connection Requested' },
  { value: 'connected', label: 'Connected' },
  { value: 'message_1', label: 'Message 1 Sent' },
  { value: 'message_2', label: 'Message 2 Sent' },
  { value: 'replied', label: 'Replied' },
];

// Website issues options
const WEBSITE_ISSUES = [
  { id: 'slow_loading', label: 'Slow Loading (>3s)' },
  { id: 'not_mobile_friendly', label: 'Not Mobile Friendly' },
  { id: 'no_ssl', label: 'No SSL/HTTPS' },
  { id: 'outdated_design', label: 'Outdated Design' },
  { id: 'no_cta', label: 'No Clear Call-to-Action' },
  { id: 'hard_to_find_contact', label: 'Hard to Find Contact Info' },
  { id: 'no_reviews', label: 'No Reviews/Testimonials' },
  { id: 'stock_photos', label: 'Uses Stock Photos' },
  { id: 'no_service_area', label: 'No Service Area Listed' },
];

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ContactCreate) => void;
  contact?: Contact | null;
  isLoading?: boolean;
}

export default function ContactModal({
  isOpen,
  onClose,
  onSubmit,
  contact,
  isLoading = false,
}: ContactModalProps) {
  const [formData, setFormData] = useState<ContactCreate>({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: '',
    status: ContactStatus.LEAD,
    notes: '',
    industry: undefined,
    suburb: '',
    city: '',
    website_url: '',
    website_issues: '',
    website_speed_score: undefined,
    // Outreach tracking
    email_stage: '',
    email_last_sent: '',
    linkedin_stage: '',
    linkedin_last_action: '',
    loom_audit_sent: false,
    loom_audit_url: '',
    next_followup_date: '',
  });

  // Parse website issues from JSON string to array
  const getSelectedIssues = (): string[] => {
    if (!formData.website_issues) return [];
    try {
      return JSON.parse(formData.website_issues);
    } catch {
      return [];
    }
  };

  // Toggle a website issue
  const toggleIssue = (issueId: string) => {
    const current = getSelectedIssues();
    const updated = current.includes(issueId)
      ? current.filter(id => id !== issueId)
      : [...current, issueId];
    setFormData({ ...formData, website_issues: JSON.stringify(updated) });
  };

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name,
        email: contact.email || '',
        phone: contact.phone || '',
        company: contact.company || '',
        source: contact.source || '',
        status: contact.status,
        notes: contact.notes || '',
        industry: contact.industry,
        suburb: contact.suburb || '',
        city: contact.city || '',
        website_url: contact.website_url || '',
        website_issues: contact.website_issues || '',
        website_speed_score: contact.website_speed_score,
        // Outreach tracking
        email_stage: contact.email_stage || '',
        email_last_sent: contact.email_last_sent || '',
        linkedin_stage: contact.linkedin_stage || '',
        linkedin_last_action: contact.linkedin_last_action || '',
        loom_audit_sent: contact.loom_audit_sent || false,
        loom_audit_url: contact.loom_audit_url || '',
        next_followup_date: contact.next_followup_date || '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        source: '',
        status: ContactStatus.LEAD,
        notes: '',
        industry: undefined,
        suburb: '',
        city: '',
        website_url: '',
        website_issues: '',
        website_speed_score: undefined,
        // Outreach tracking
        email_stage: '',
        email_last_sent: '',
        linkedin_stage: '',
        linkedin_last_action: '',
        loom_audit_sent: false,
        loom_audit_url: '',
        next_followup_date: '',
      });
    }
  }, [contact, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    // Clean up empty strings to undefined for optional fields
    const cleanedData: ContactCreate = {
      name: formData.name.trim(),
      email: formData.email?.trim() || undefined,
      phone: formData.phone?.trim() || undefined,
      company: formData.company?.trim() || undefined,
      source: formData.source?.trim() || undefined,
      status: formData.status,
      notes: formData.notes?.trim() || undefined,
      // Tradie-specific fields
      industry: formData.industry || undefined,
      suburb: formData.suburb?.trim() || undefined,
      city: formData.city?.trim() || undefined,
      website_url: formData.website_url?.trim() || undefined,
      website_issues: formData.website_issues || undefined,
      website_speed_score: formData.website_speed_score ?? undefined,
      // Outreach tracking fields
      email_stage: formData.email_stage || undefined,
      email_last_sent: formData.email_last_sent || undefined,
      linkedin_stage: formData.linkedin_stage || undefined,
      linkedin_last_action: formData.linkedin_last_action || undefined,
      loom_audit_sent: formData.loom_audit_sent || undefined,
      loom_audit_url: formData.loom_audit_url?.trim() || undefined,
      next_followup_date: formData.next_followup_date || undefined,
    };
    onSubmit(cleanedData);
  };

  if (!isOpen) return null;

  const inputClasses = cn(
    "w-full px-4 py-2.5 rounded-lg",
    "bg-stone-800/50 border border-stone-600/40",
    "text-[--exec-text] placeholder:text-[--exec-text-muted]",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all text-sm"
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">
                {contact ? 'Edit Contact' : 'New Contact'}
              </h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                {contact ? 'Update contact details' : 'Add a new person to your network'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClasses}
                placeholder="e.g., Jane Doe"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputClasses}
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={inputClasses}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Company
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className={inputClasses}
                  placeholder="Acme Inc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Source
                </label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className={inputClasses}
                  placeholder="Referral, LinkedIn..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ContactStatus })}
                  className={inputClasses}
                >
                  <option value={ContactStatus.LEAD}>Lead</option>
                  <option value={ContactStatus.PROSPECT}>Prospect</option>
                  <option value={ContactStatus.CLIENT}>Client</option>
                  <option value={ContactStatus.INACTIVE}>Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Industry
                </label>
                <select
                  value={formData.industry || ''}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value || undefined })}
                  className={inputClasses}
                >
                  <option value="">Select Industry...</option>
                  <option value="roofer">Roofer</option>
                  <option value="plumber">Plumber</option>
                  <option value="electrician">Electrician (Sparky)</option>
                  <option value="builder">Builder</option>
                  <option value="hvac">HVAC / Air Con</option>
                  <option value="landscaper">Landscaper</option>
                  <option value="painter">Painter</option>
                  <option value="carpenter">Carpenter</option>
                  <option value="tiler">Tiler</option>
                  <option value="concreter">Concreter</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Location Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  <MapPin className="w-3.5 h-3.5 inline mr-1" />
                  Suburb
                </label>
                <input
                  type="text"
                  value={formData.suburb}
                  onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                  className={inputClasses}
                  placeholder="e.g., Paddington"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  City
                </label>
                <select
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className={inputClasses}
                >
                  <option value="">Select City...</option>
                  <option value="Brisbane">Brisbane</option>
                  <option value="Perth">Perth</option>
                  <option value="Adelaide">Adelaide</option>
                  <option value="Gold Coast">Gold Coast</option>
                  <option value="Sydney">Sydney</option>
                  <option value="Melbourne">Melbourne</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Website Fields */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                <Globe className="w-3.5 h-3.5 inline mr-1" />
                Website URL
              </label>
              <input
                type="url"
                value={formData.website_url}
                onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                className={inputClasses}
                placeholder="https://example.com.au"
              />
            </div>

            {formData.website_url && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    <Gauge className="w-3.5 h-3.5 inline mr-1" />
                    Website Speed Score (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.website_speed_score ?? ''}
                    onChange={(e) => setFormData({ ...formData, website_speed_score: e.target.value ? parseInt(e.target.value) : undefined })}
                    className={inputClasses}
                    placeholder="Enter speed score from GTmetrix..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                    Website Issues
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WEBSITE_ISSUES.map((issue) => {
                      const isSelected = getSelectedIssues().includes(issue.id);
                      return (
                        <button
                          key={issue.id}
                          type="button"
                          onClick={() => toggleIssue(issue.id)}
                          className={cn(
                            "px-2.5 py-1 text-xs rounded-lg border transition-all",
                            isSelected
                              ? "bg-red-500/20 border-red-500/50 text-red-400"
                              : "bg-stone-700/30 border-stone-600/40 text-[--exec-text-muted] hover:border-stone-500/50"
                          )}
                        >
                          {issue.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Outreach Tracking Section */}
            <div className="pt-4 border-t border-stone-700/30">
              <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center">
                <Mail className="w-4 h-4 mr-2 text-[--exec-accent]" />
                Outreach Tracking
              </h3>

              {/* Email & LinkedIn Stage */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    <Mail className="w-3.5 h-3.5 inline mr-1" />
                    Email Stage
                  </label>
                  <select
                    value={formData.email_stage || ''}
                    onChange={(e) => setFormData({ ...formData, email_stage: e.target.value })}
                    className={inputClasses}
                  >
                    {EMAIL_STAGES.map((stage) => (
                      <option key={stage.value} value={stage.value}>{stage.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Email Last Sent
                  </label>
                  <input
                    type="date"
                    value={formData.email_last_sent || ''}
                    onChange={(e) => setFormData({ ...formData, email_last_sent: e.target.value })}
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    <Linkedin className="w-3.5 h-3.5 inline mr-1" />
                    LinkedIn Stage
                  </label>
                  <select
                    value={formData.linkedin_stage || ''}
                    onChange={(e) => setFormData({ ...formData, linkedin_stage: e.target.value })}
                    className={inputClasses}
                  >
                    {LINKEDIN_STAGES.map((stage) => (
                      <option key={stage.value} value={stage.value}>{stage.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    LinkedIn Last Action
                  </label>
                  <input
                    type="date"
                    value={formData.linkedin_last_action || ''}
                    onChange={(e) => setFormData({ ...formData, linkedin_last_action: e.target.value })}
                    className={inputClasses}
                  />
                </div>
              </div>

              {/* Loom Audit */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.loom_audit_sent || false}
                      onChange={(e) => setFormData({ ...formData, loom_audit_sent: e.target.checked })}
                      className="w-4 h-4 rounded border-stone-600 bg-stone-700 text-[--exec-accent] focus:ring-[--exec-accent]/20"
                    />
                    <span className="text-sm text-[--exec-text-secondary]">
                      <Video className="w-3.5 h-3.5 inline mr-1" />
                      Loom Audit Sent
                    </span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    <CalendarClock className="w-3.5 h-3.5 inline mr-1" />
                    Next Follow-up
                  </label>
                  <input
                    type="date"
                    value={formData.next_followup_date || ''}
                    onChange={(e) => setFormData({ ...formData, next_followup_date: e.target.value })}
                    className={inputClasses}
                  />
                </div>
              </div>

              {formData.loom_audit_sent && (
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Loom Video URL
                  </label>
                  <input
                    type="url"
                    value={formData.loom_audit_url || ''}
                    onChange={(e) => setFormData({ ...formData, loom_audit_url: e.target.value })}
                    className={inputClasses}
                    placeholder="https://www.loom.com/share/..."
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className={cn(inputClasses, "resize-none")}
                rows={3}
                placeholder="Any additional details..."
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : contact ? 'Save Changes' : 'Create Contact'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
