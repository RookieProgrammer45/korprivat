import { renderRobotsTxt } from '@/lib/robots-txt';

export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(renderRobotsTxt(), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
