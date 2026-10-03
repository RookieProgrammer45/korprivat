// @vitest-environment node

import './_setup/env';
import './_setup/auth-mock';
import './_setup/email-mock';
import './_setup/blob-mock';
import './_setup/prisma-mock';
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET as onboardingGET } from '@/app/api/instructors/onboarding/route';
import { POST as photoPOST } from '@/app/api/instructors/photo/route';
import { POST as instructorPOST } from '@/app/api/instructors/route';
import { InstructorPhotoUploaded } from '@/lib/contracts/instructor-photo';
import { instructorProfileLiveEmail } from '@/lib/email/templates';
import { authMock } from './_setup/auth-mock';
import type { ContactsMockFixture } from './_setup/contacts-mock';
import { installContactsProxy } from './_setup/contacts-mock';
import { blobPutMock, resetBlobMock } from './_setup/blob-mock';
import { resetEmailMock, sendEmailMock } from './_setup/email-mock';
import { prismaMock, resetPrisma } from './_setup/prisma-mock';

const USER = {
  id: 'user_teacher',
  email: 'teacher@example.test',
  name: 'Lina',
  role: 'user' as const,
};

function setOnce(method: unknown, value: unknown): void {
  (method as unknown as { mockResolvedValueOnce: (next: unknown) => void }).mockResolvedValueOnce(
    value,
  );
}

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/instructors', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function multipartRequest(file: File): Request {
  const form = new FormData();
  form.append('photo', file, file.name);
  return new Request('http://localhost/api/instructors/photo', { method: 'POST', body: form });
}

const validBody = {
  name: 'Lina Andersson',
  city: 'Stockholm',
  categories: ['B'],
  hourlyRateSek: 550,
  bio: 'Experienced driving instructor.',
  photoUrl: 'https://cdn.polsia.com/mock/lina.png',
  email: USER.email,
  providerRole: 'HANDLEDARE',
  locale: 'en',
};

let contacts: ContactsMockFixture | null = null;

beforeEach(() => {
  resetPrisma();
  resetBlobMock();
  resetEmailMock();
  authMock.reset();
  process.env.BLOB_READ_WRITE_TOKEN = 'blob_test_token';
  contacts = installContactsProxy();
});

afterEach(() => {
  contacts?.restore();
  contacts = null;
});

describe('instructor onboarding context and photo upload', () => {
  it('requires authentication for context and photo upload', async () => {
    expect(
      (await onboardingGET(new Request('http://localhost/api/instructors/onboarding'))).status,
    ).toBe(401);
    expect(
      (await photoPOST(new Request('http://localhost/api/instructors/photo', { method: 'POST' })))
        .status,
    ).toBe(401);
    expect(blobPutMock).not.toHaveBeenCalled();
  });

  it('returns the signed-in marketplace role and accepts a supported image', async () => {
    authMock.setUser(USER);
    setOnce(prismaMock.userProfile.findUnique, { role: 'HANDLEDARE' });
    // Photo route re-reads profile for the role gate.
    setOnce(prismaMock.userProfile.findUnique, { role: 'HANDLEDARE' });

    const context = await onboardingGET(new Request('http://localhost/api/instructors/onboarding'));
    expect(await context.json()).toEqual({ role: 'HANDLEDARE' });

    const response = await photoPOST(
      multipartRequest(new File(['png'], 'portrait.png', { type: 'image/png' })),
    );
    expect(response.status).toBe(201);
    expect(InstructorPhotoUploaded.parse(await response.json()).imageUrl).toContain(
      'cdn.polsia.com',
    );
  });

  it.each([
    [
      'unsupported MIME',
      new File(['text'], 'portrait.txt', { type: 'text/plain' }),
      'unsupported_image_format',
    ],
    [
      'HEIC extension',
      new File(['image'], 'portrait.heic', { type: '' }),
      'unsupported_image_format',
    ],
    [
      'oversize',
      new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'portrait.png', { type: 'image/png' }),
      'file_too_large',
    ],
  ])('rejects %s before R2 upload', async (_label, file, code) => {
    authMock.setUser(USER);
    setOnce(prismaMock.userProfile.findUnique, { role: 'INSTRUCTOR' });
    const response = await photoPOST(multipartRequest(file));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ errors: { photo: code } });
    expect(blobPutMock).not.toHaveBeenCalled();
  });

  it('preserves blob upload error code and message', async () => {
    authMock.setUser(USER);
    setOnce(prismaMock.userProfile.findUnique, { role: 'INSTRUCTOR' });
    blobPutMock.mockRejectedValueOnce(new Error('Use JPG'));
    const response = await photoPOST(
      multipartRequest(new File(['png'], 'portrait.png', { type: 'image/png' })),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: { code: 'upload_failed', message: 'Use JPG' },
    });
  });
});

describe('instructor creation confirmation', () => {
  it('derives the role, persists the uploaded URL, registers first, and localizes email', async () => {
    authMock.setUser(USER);
    setOnce(prismaMock.userProfile.findUnique, { role: 'INSTRUCTOR' });
    setOnce(prismaMock.instructorLicense.findUnique, { status: 'VERIFIED' });
    setOnce(prismaMock.userProfile.findUnique, {
      role: 'INSTRUCTOR',
      signupPath: 'INSTRUCTOR',
      city: null,
      schoolName: null,
    });
    setOnce(prismaMock.photoVerification.findUnique, {
      stagedUrl: validBody.photoUrl,
      status: 'CONFIRMED',
    });
    setOnce(prismaMock.user.findUnique, { image: validBody.photoUrl });
    setOnce(prismaMock.instructor.create, {
      id: 'instructor_lina',
      name: validBody.name,
      photoUrl: validBody.photoUrl,
    });
    const events: string[] = [];
    sendEmailMock.mockImplementationOnce(async () => {
      events.push('email');
      return { id: 'email_1' };
    });

    const response = await instructorPOST(jsonRequest(validBody));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'instructor_lina', emailSent: true });
    expect(prismaMock.instructor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ photoUrl: validBody.photoUrl, providerRole: 'INSTRUCTOR' }),
      }),
    );
    expect(events).toEqual(['email']);
    expect(sendEmailMock.mock.calls[0]?.[0]).toMatchObject({
      subject: 'Your school listing is live',
      html: expect.stringContaining('Your school listing is live'),
    });
  });

  it('rejects a student role and keeps creation successful when email fails', async () => {
    authMock.setUser(USER);
    setOnce(prismaMock.userProfile.findUnique, { role: 'STUDENT' });
    const forbidden = await instructorPOST(jsonRequest(validBody));
    expect(forbidden.status).toBe(403);
    expect(prismaMock.instructor.create).not.toHaveBeenCalled();

    resetPrisma();
    setOnce(prismaMock.userProfile.findUnique, { role: 'INSTRUCTOR' });
    setOnce(prismaMock.instructorLicense.findUnique, { status: 'VERIFIED' });
    setOnce(prismaMock.userProfile.findUnique, {
      role: 'INSTRUCTOR',
      signupPath: 'INSTRUCTOR',
      city: null,
      schoolName: null,
    });
    setOnce(prismaMock.photoVerification.findUnique, {
      stagedUrl: validBody.photoUrl,
      status: 'CONFIRMED',
    });
    setOnce(prismaMock.user.findUnique, { image: validBody.photoUrl });
    setOnce(prismaMock.instructor.create, {
      id: 'instructor_email_failure',
      name: validBody.name,
      photoUrl: validBody.photoUrl,
    });
    sendEmailMock.mockRejectedValueOnce(new Error('proxy unavailable'));
    const response = await instructorPOST(jsonRequest(validBody));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'instructor_email_failure', emailSent: false });
  });
});

describe('localized instructor profile email', () => {
  it('renders Swedish copy and keeps the escaped avatar and CTA', () => {
    const email = instructorProfileLiveEmail({
      name: 'Åsa <teacher>',
      profileUrl: 'https://example.test/instructors/1?a=1&b=2',
      imageUrl: 'https://cdn.polsia.com/avatar.png?a=1&b=2',
      locale: 'sv',
    });
    expect(email.subject).toBe('Din skolprofil är live');
    expect(email.html).toContain('Din skolprofil är live');
    expect(email.html).toContain('avatar.png?a=1&amp;b=2');
    expect(email.text).toContain('Visa skolprofilen');
  });
});
