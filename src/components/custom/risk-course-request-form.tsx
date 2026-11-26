'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RiskCourseRequestForm({ sessionId }: { sessionId: string }) {
  const t = useTranslations('riskCourses');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const res = await fetch(`/api/risk-sessions/${sessionId}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: name, studentEmail: email }),
    });
    const json = (await res.json()) as { status?: string; error?: { code?: string } };
    setStatus(res.ok ? t('requestSaved') : t('requestError'));
    void json;
  }

  return (
    <form className="mt-3 grid gap-2" onSubmit={onSubmit}>
      <p className="text-xs text-muted-foreground">{t('recipient')}</p>
      <Label htmlFor={`${sessionId}-name`}>{t('name')}</Label>
      <Input
        id={`${sessionId}-name`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Label htmlFor={`${sessionId}-email`}>{t('email')}</Label>
      <Input
        id={`${sessionId}-email`}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Button type="submit" size="sm">
        {t('requestCta')}
      </Button>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </form>
  );
}
