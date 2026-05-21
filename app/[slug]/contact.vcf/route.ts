import { NextResponse } from 'next/server';
import { getCard } from '@/data/cards';
import { buildVCard } from '@/lib/vcard';

export const dynamic = 'force-static';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const card = getCard(slug);
  if (!card) return new NextResponse('Not found', { status: 404 });

  const body = buildVCard(card);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${card.slug}.vcf"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
