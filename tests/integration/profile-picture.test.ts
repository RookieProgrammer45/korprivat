// @polsia:user-owned — POST /api/profile/picture integration coverage.
//
// Six end-to-end paths for the new picture upload route:
//   1. unauthenticated → 401 (requireAuth short-circuits)
//   2. authenticated but wrong MIME (text/plain) → 400 { errors: { picture: 'pictureWrongType' } }
//   3. authenticated with no `file` field → 400 with the i18n key
//   4. authenticated with a valid image → 201, User.image set, profileCompletedAt stamped
//      AND the picture-aware welcome email ships with the avatar embed
//      AND the contact-register fires with source: 'signup'
//   5. R2 reports a non-success body → 502 (no DB persistence)
//   6. R2 throws → 502 (no DB persistence)
//
// The R2 proxy is mocked by tests/integration/_setup/r2-mock.ts (vi.mock of
// `node-fetch`); the returned URL is the canned `https://cdn.polsia.com/mock/
// key.png` so a real fetch never leaves the test runtime.
//
// biome: this file is OUTSIDE the overrides' src/** glob so biome's default
// rule set applies; mock helpers + route handler imports are FIRST so vi.mock
// hoists above everything else.
//
// Multipart bodies need the `node` runtime — jsdom's `Request.body` parser
// doesn't handle binary multipart/form-data, and `await req.formData()`
// would hang.
//
// @vitest-environment node

import './_setup/env';
import './_setup/auth-mock';
import './_setup/email-mock';
import './_setup/r2-mock';
import './_setup/prisma-mock';
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as picturePOST } from '@/app/api/profile/picture/route';
import { authMock } from './_setup/auth-mock';
import type { ContactsMockFixture } from './_setup/contacts-mock';
import { installContactsProxy } from './_setup/contacts-mock';
import { resetEmailMock, sendEmailMock } from './_setup/email-mock';
import { prismaMock, resetPrisma } from './_setup/prisma-mock';
import { r2UploadMock, resetR2Mock } from './_setup/r2-mock';

const SESSION_USER = {
  id: 'user_alice',
  email: 'alice@example.test',
  name: 'Alice',
  role: 'user' as const,
};

function multipartImageRequest(file: File): Request {
  const fd = new FormData();
  fd.append('file', file, 'avatar.png');
  return new Request('http://localhost/api/profile/picture', {
    method: 'POST',
    body: fd,
  });
}

function multipartTextRequest(): Request {
  const fd = new FormData();
  fd.append('file', new File(['not really an image'], 'note.txt', { type: 'text/plain' }));
  return new Request('http://localhost/api/profile/picture', {
    method: 'POST',
    body: fd,
  });
}

function multipartMissingField(): Request {
  const fd = new FormData();
  fd.append('something_else', 'value');
  return new Request('http://localhost/api/profile/picture', {
    method: 'POST',
    body: fd,
  });
}

let contactsMock: ContactsMockFixture | null = null;

beforeEach(() => {
  resetPrisma();
  resetR2Mock();
  authMock.reset();
  resetEmailMock();
  contactsMock = installContactsProxy();
});

afterEach(() => {
  contactsMock?.restore();
  contactsMock = null;
});

describe('POST /api/profile/picture', () => {
  it('401 when no session', async () => {
    authMock.setUser(null);
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const file = new File([pngBytes], 'avatar.png', { type: 'image/png' });
    const res = await picturePOST(multipartImageRequest(file));
    expect(res.status).toBe(401);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.userProfile.upsert).not.toHaveBeenCalled();
    // requireAuth short-circuits — R2 must not be touched.
    expect(r2UploadMock).not.toHaveBeenCalled();
  });

  it('400 when MIME is not an image', async () => {
    authMock.setUser(SESSION_USER);
    const res = await picturePOST(multipartTextRequest());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errors?: { picture?: string } };
    expect(body.errors?.picture).toBe('pictureWrongType');
    expect(r2UploadMock).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('400 when the file field is absent', async () => {
    authMock.setUser(SESSION_USER);
    const res = await picturePOST(multipartMissingField());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errors?: { picture?: string } };
    expect(body.errors?.picture).toMatch(/No file|uploaded/i);
    expect(r2UploadMock).not.toHaveBeenCalled();
  });

  it('201 on a valid image — User.image + profileCompletedAt both set', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.user.update.mockResolvedValueOnce({ id: SESSION_USER.id });
    prismaMock.userProfile.upsert.mockResolvedValueOnce({});
    // The conditional welcome stamp matches one row → picture-aware welcome ships.
    prismaMock.userProfile.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.userProfile.findUnique.mockResolvedValueOnce({
      userId: SESSION_USER.id,
      role: 'STUDENT',
      welcomeSentAt: new Date(),
    });

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([pngBytes], 'avatar.png', { type: 'image/png' });
    const res = await picturePOST(multipartImageRequest(file));

    expect(res.status).toBe(201);
    const body = (await res.json()) as { imageUrl?: string; profileCompletedAt?: string };
    expect(body.imageUrl).toBe('https://cdn.polsia.com/mock/key.png');
    expect(typeof body.profileCompletedAt).toBe('string');
    expect(Number.isNaN(Date.parse(body.profileCompletedAt ?? ''))).toBe(false);

    // The R2 mock was hit exactly once, with the correct URL in the body
    // envelope that the route then unwraps.
    expect(r2UploadMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_USER.id },
        data: { image: 'https://cdn.polsia.com/mock/key.png' },
      }),
    );
    expect(prismaMock.userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: SESSION_USER.id },
        create: expect.objectContaining({ userId: SESSION_USER.id }) as object,
        update: expect.objectContaining({
          profileCompletedAt: expect.any(Date) as unknown as Date,
        }) as object,
      }),
    );
    // Welcome dispatch — the route stamps welcomeSentAt BEFORE sending the
    // email so a duplicate call from /api/auth/welcome is a safe no-op.
    expect(prismaMock.userProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: SESSION_USER.id, welcomeSentAt: null },
        data: { welcomeSentAt: expect.any(Date) as unknown as Date },
      }),
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const sent = sendEmailMock.mock.calls[0][0];
    expect(sent.to).toBe(SESSION_USER.email);
    expect(sent.subject).toBe('Your profile is set up — welcome to DriveLinkUp');
    expect(sent.html).toContain('cdn.polsia.com/mock/key.png');
    expect(sent.text).toContain('cdn.polsia.com/mock/key.png');
    expect(sent.html).toContain('Your profile is set up and you');
    // Contact-register fired with source:'signup'.
    const contactsCall = contactsMock?.calls.find((c) =>
      c.url.endsWith('/api/proxy/email/contacts'),
    );
    expect(contactsCall?.body).toMatchObject({
      email: SESSION_USER.email,
      source: 'signup',
    });
  });

  it('no second welcome when welcomeSentAt is already set', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.user.update.mockResolvedValueOnce({ id: SESSION_USER.id });
    prismaMock.userProfile.upsert.mockResolvedValueOnce({});
    // The conditional welcome stamp matches ZERO rows → picture-less
    // /api/auth/welcome has already shipped. The picture route is a no-op
    // for the email send, exactly mirroring the dedup there.
    prismaMock.userProfile.updateMany.mockResolvedValueOnce({ count: 0 });

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const file = new File([pngBytes], 'avatar.png', { type: 'image/png' });
    const res = await picturePOST(multipartImageRequest(file));

    expect(res.status).toBe(201);
    expect(prismaMock.user.update).toHaveBeenCalled(); // picture write still happens
    expect(prismaMock.userProfile.upsert).toHaveBeenCalled(); // profileCompletedAt stamped
    expect(sendEmailMock).not.toHaveBeenCalled();
    // No contacts call either — this branch fires neither.
    expect(contactsMock?.calls.some((c) => c.url.endsWith('/api/proxy/email/contacts'))).toBe(
      false,
    );
  });

  it('502 when the R2 proxy reports a non-success response', async () => {
    authMock.setUser(SESSION_USER);
    r2UploadMock.mockResolvedValueOnce({
      status: 502,
      ok: false,
      json: async () => ({ success: false, error: { message: 'upstream' } }),
      text: async () => '',
    });

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const file = new File([pngBytes], 'avatar.png', { type: 'image/png' });
    const res = await picturePOST(multipartImageRequest(file));

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe('upload_failed');
    // No persistence on a failed upload — User.image stays untouched.
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('502 when the R2 proxy throws', async () => {
    authMock.setUser(SESSION_USER);
    r2UploadMock.mockRejectedValueOnce(new Error('socket hang up'));

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const file = new File([pngBytes], 'avatar.png', { type: 'image/png' });
    const res = await picturePOST(multipartImageRequest(file));

    expect(res.status).toBe(502);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('201 for HANDLEDARE profile — does not 500 on role resolution (regression)', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.user.update.mockResolvedValueOnce({ id: SESSION_USER.id });
    prismaMock.userProfile.upsert.mockResolvedValueOnce({});
    // userProfile.findUnique returns role='HANDLEDARE' — the route must
    // resolve this without invoking RoleEnum.parse (which throws on
    // HANDLEDARE) and short-circuit to 201 with no welcome dispatch.
    prismaMock.userProfile.findUnique.mockResolvedValueOnce({
      userId: SESSION_USER.id,
      role: 'HANDLEDARE',
    });

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const file = new File([pngBytes], 'avatar.png', { type: 'image/png' });
    const res = await picturePOST(multipartImageRequest(file));

    expect(res.status).toBe(201);
    const body = (await res.json()) as { imageUrl?: string; profileCompletedAt?: string };
    expect(body.imageUrl).toBe('https://cdn.polsia.com/mock/key.png');
    // HANDLEDARE branch must NOT stamp welcomeSentAt or send the email.
    expect(prismaMock.userProfile.updateMany).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
