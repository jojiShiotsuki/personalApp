import { ProspectStatus } from '@/types';
import { cn } from '@/lib/utils';
import { PROSPECT_STATUS_CONFIG, LINKEDIN_STATUS_OVERRIDES } from '@/lib/outreachConstants';

interface ProspectStatusBadgeProps {
  status: ProspectStatus;
  variant?: 'email' | 'linkedin';
}

export default function ProspectStatusBadge({ status, variant = 'email' }: ProspectStatusBadgeProps) {
  const overrides = variant === 'linkedin' ? LINKEDIN_STATUS_OVERRIDES : {};
  const config = overrides[status] || PROSPECT_STATUS_CONFIG[status] || PROSPECT_STATUS_CONFIG[ProspectStatus.QUEUED];
  const { bg, text, label } = config;

  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      {label}
    </span>
  );
}
