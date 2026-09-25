// @polsia:user-owned — /profile photo edit island.
//
// Renders the "Edit photo" / "Add photo" button in the profile header. On
// click opens a Dialog hosting <PhotoPromptStep/> wired to
// /api/profile/picture. On upload success the parent re-fetches /api/profile
// so the avatar refreshes. Per-role copy is pulled from
// `auth.signUp.segments.<role>.pictureUpload.*` so the recognition sentence
// matches the signup flow exactly (instructor → "helps students recognize
// you", learner → "helps instructors recognize you").

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { PhotoPromptStep } from '@/components/custom/photo-prompt-step';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Role = 'STUDENT' | 'INSTRUCTOR' | 'HANDLEDARE';

export function ProfilePhotoEditor({
  role,
  name,
  hasImage,
  stagedImage,
  onUploaded,
}: {
  role: Role;
  name: string;
  hasImage: boolean;
  stagedImage: string | null;
  onUploaded: () => void;
}) {
  const tProfile = useTranslations('profile.pictureUpload');
  // Per-role recognition copy lives under auth.signUp.segments.<role>.pictureUpload
  // — same keys as the signup photo step, so the sentence matches exactly.
  const tSegment = useTranslations(`auth.signUp.segments.${role}.pictureUpload`);
  const tDefault = useTranslations('auth.signUp.pictureUpload');
  const [open, setOpen] = useState(false);

  const copy = {
    eyebrow: tSegment('stepEyebrow'),
    title: tSegment('stepTitle'),
    lead: tSegment('stepLead'),
    placeholderAria: tSegment('placeholderAria'),
    chooseButton: tSegment('chooseButton'),
    dragHint: tSegment('dragHint'),
    submit: tProfile('submit'),
    submitting: tProfile('submitting'),
    confirm: tProfile('confirm'),
    confirming: tProfile('confirming'),
    confirmationLabel: tProfile('confirmationLabel'),
    staged: tProfile('staged'),
    back: tProfile('cancel'),
    whyWeAsk: tSegment('whyWeAsk'),
    errors: {
      pictureRequired: tDefault('errors.pictureRequired'),
      pictureWrongType: tSegment('errors.pictureWrongType'),
      pictureTooLarge: tSegment('errors.pictureTooLarge'),
      pictureUploadFailed: tSegment('errors.pictureUploadFailed'),
    },
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {hasImage ? tProfile('editButton') : tProfile('editButtonAlt')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tSegment('stepTitle')}</DialogTitle>
            <DialogDescription>{tSegment('stepLead')}</DialogDescription>
          </DialogHeader>
          <PhotoPromptStep
            endpoint="/api/profile/picture"
            fieldName="file"
            initialName={name}
            initialStagedUrl={stagedImage}
            onConfirmed={() => {
              setOpen(false);
              toast.success(tProfile('successToast'));
              onUploaded();
            }}
            onBack={() => setOpen(false)}
            copy={copy}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
