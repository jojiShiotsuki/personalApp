#!/usr/bin/env python3
"""
Script to update DealCard.tsx with NextFollowUpBadge and snooze functionality
"""

# Read the file
with open('src/components/DealCard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports after existing imports (after line 5)
old_imports = """import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import FollowUpBadge from './FollowUpBadge';"""

new_imports = """import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import FollowUpBadge from './FollowUpBadge';
import NextFollowUpBadge from './NextFollowUpBadge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dealApi } from '@/lib/api';
import { Timer } from 'lucide-react';"""

content = content.replace(old_imports, new_imports)

# Add snooze mutation after daysInStage (after line 25)
old_component_start = """export default function DealCard({ deal, index, contacts, onEdit, onDelete, onAddInteraction }: DealCardProps) {
  const daysInStage = getDaysInStage(deal.updated_at);

  return ("""

new_component_start = """export default function DealCard({ deal, index, contacts, onEdit, onDelete, onAddInteraction }: DealCardProps) {
  const daysInStage = getDaysInStage(deal.updated_at);
  const queryClient = useQueryClient();

  const snoozeMutation = useMutation({
    mutationFn: (id: number) => dealApi.snooze(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  return ("""

content = content.replace(old_component_start, new_component_start)

# Update the follow-up badge section (lines 91-107)
old_badge_section = """          {/* Follow-up badge with add button */}
          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
            <FollowUpBadge count={deal.followup_count} />
            {onAddInteraction && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddInteraction(deal.contact_id);
                }}
                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded flex items-center gap-1 transition-colors"
                title="Add follow-up"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>"""

new_badge_section = """          {/* Follow-up badges with actions */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FollowUpBadge count={deal.followup_count} />
                <NextFollowUpBadge date={deal.next_followup_date} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onAddInteraction && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddInteraction(deal.contact_id);
                  }}
                  className="flex-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded flex items-center justify-center gap-1 transition-colors"
                  title="Add follow-up interaction"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  snoozeMutation.mutate(deal.id);
                }}
                disabled={snoozeMutation.isPending}
                className="flex-1 px-2 py-1 text-xs bg-gray-50 text-gray-600 hover:bg-gray-100 rounded flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                title="Snooze 3 days"
              >
                <Timer className="w-3 h-3" />
                +3d
              </button>
            </div>
          </div>"""

content = content.replace(old_badge_section, new_badge_section)

# Write back
with open('src/components/DealCard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Updated DealCard.tsx with NextFollowUpBadge and snooze button")
