// @polsia:user-owned
'use client';

import { Download, Loader2 } from 'lucide-react';
import type * as React from 'react';
import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import type { DocumentSpec } from '@/lib/pdf/schema';

type PdfDownloadButtonBaseProps = Omit<ButtonProps, 'onClick' | 'children'> & {
  fileName?: string;
  children?: React.ReactNode;
};

export type PdfDownloadButtonProps = PdfDownloadButtonBaseProps &
  (
    | { documentSpec: DocumentSpec; endpoint?: never; requestHeaders?: never }
    | { documentSpec?: never; endpoint: string; requestHeaders?: HeadersInit }
  );

export function PdfDownloadButton({
  documentSpec,
  endpoint,
  requestHeaders,
  fileName = 'document.pdf',
  children = 'Download PDF',
  disabled,
  ...props
}: PdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(endpoint ?? '/api/pdf/document', {
        method: 'POST',
        ...(endpoint
          ? requestHeaders
            ? { headers: requestHeaders }
            : {}
          : {
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(documentSpec),
            }),
      });
      if (!res.ok) {
        throw new Error(`PDF generation failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const responseFileName = res.headers
        .get('content-disposition')
        ?.match(/filename="([^"]+)"/)?.[1];
      link.download = fileName ?? responseFileName ?? 'document.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" onClick={handleDownload} disabled={disabled || loading} {...props}>
      {loading ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Download aria-hidden="true" className="size-4" />
      )}
      <span>{children}</span>
    </Button>
  );
}
