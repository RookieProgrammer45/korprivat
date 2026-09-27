'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { type MessageReportReason, MessageReportResult } from '@/lib/contracts/messaging';

export function MessageReportDialog({ conversationId }: { conversationId: string }) {
  const t = useTranslations('messaging');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<MessageReportReason>('safety');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await apiFetch(`/api/conversations/${encodeURIComponent(conversationId)}/report`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          details: details.trim() || undefined,
        }),
        schema: MessageReportResult,
      });
      toast.success(t('reportSuccess'));
      setOpen(false);
      setDetails('');
    } catch {
      toast.error(t('reportError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
          {t('report')}
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby="message-report-description">
        <DialogHeader>
          <DialogTitle>{t('reportTitle')}</DialogTitle>
          <DialogDescription id="message-report-description">
            {t('reportDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-2 text-small font-medium" htmlFor="message-report-reason">
            {t('reasonLabel')}
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as MessageReportReason)}
            >
              <SelectTrigger id="message-report-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="safety">{t('reasons.safety')}</SelectItem>
                <SelectItem value="harassment">{t('reasons.harassment')}</SelectItem>
                <SelectItem value="off_platform_request">
                  {t('reasons.off_platform_request')}
                </SelectItem>
                <SelectItem value="other">{t('reasons.other')}</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-2 text-small font-medium" htmlFor="message-report-details">
            {t('detailsLabel')}
            <Textarea
              id="message-report-details"
              value={details}
              maxLength={500}
              onChange={(event) => setDetails(event.target.value)}
              placeholder={t('detailsPlaceholder')}
              rows={4}
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? t('reporting') : t('submitReport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
