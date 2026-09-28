'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  organizationId: string;
  readOnly: boolean;
  initial: {
    name: string;
    organizationNumber: string;
    address: string;
    postcode: string;
    city: string;
    contactEmail: string;
    contactPhone: string;
  };
};

export function SchoolSettingsForm({ organizationId, readOnly, initial }: Props) {
  const t = useTranslations('schoolSettings');
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [postcode, setPostcode] = useState(initial.postcode);
  const [city, setCity] = useState(initial.city);
  const [contactEmail, setContactEmail] = useState(initial.contactEmail);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${organizationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address: address || null,
          postcode: postcode || null,
          city: city || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
        }),
      });
      if (!res.ok) {
        setError(t('errorGeneric'));
        return;
      }
      toast.success(t('saved'));
      router.refresh();
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-lg gap-4">
      <div className="grid gap-2">
        <Label htmlFor="school-name">{t('name')}</Label>
        <Input
          id="school-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={readOnly}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="org-number">{t('orgNumber')}</Label>
        <Input id="org-number" value={initial.organizationNumber} disabled readOnly />
        <p className="text-small text-muted-foreground">{t('orgNumberLocked')}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address">{t('address')}</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={readOnly}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="grid gap-2">
          <Label htmlFor="postcode">{t('postcode')}</Label>
          <Input
            id="postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            disabled={readOnly}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="city">{t('city')}</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={readOnly}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact-email">{t('contactEmail')}</Label>
        <Input
          id="contact-email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          disabled={readOnly}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact-phone">{t('contactPhone')}</Label>
        <Input
          id="contact-phone"
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          disabled={readOnly}
        />
      </div>
      {error ? <p className="text-small text-destructive">{error}</p> : null}
      {!readOnly ? (
        <Button type="submit" disabled={saving} className="w-fit">
          {t('save')}
        </Button>
      ) : null}
    </form>
  );
}
