'use client';
import type { Card } from '@/data/cards/_types';
import { ActionButton } from '@/components/ActionButton';
import { Photo } from '@/components/Photo';
import { SocialIconRow } from '@/components/SocialIconRow';
import { LocaleToggle } from '@/components/LocaleToggle';
import { ShareButton } from '@/components/ShareButton';
import { QRModal } from '@/components/QRModal';
import { FalconF } from '@/components/FalconF';
import { PhoneIcon, WhatsAppIcon, MailIcon, SMSIcon, DownloadIcon } from '@/components/icons';
import { t, type StringKey } from '@/lib/i18n';
import { useLocale } from '@/lib/locale-context';

const ORANGE = '#FF7700';
const CREAM  = '#ECECEC';
const WINE   = '#2D1418';

const BRAND_LABEL: Record<string, { wordmark: string; footerOrg: string; byKey: StringKey }> = {
  'force-ai':    { wordmark: 'FORCE AI',    footerOrg: 'Force AI · Kuwait',    byKey: 'BY_FORCE_AI' },
  'force-media': { wordmark: 'FORCE MEDIA', footerOrg: 'Force Media · Kuwait', byKey: 'BY_FORCE_MEDIA' },
};

type Props = { card: Card; url: string };

export function ForceBrand({ card, url }: Props) {
  if (!card.brand) throw new Error(`ForceBrand template requires card.brand; slug=${card.slug}`);
  const { locale } = useLocale();
  const c = card[locale];
  const brand = BRAND_LABEL[card.brand];
  const tel = card.contact.phone ?? '';
  const wa  = card.contact.whatsapp ?? card.contact.phone ?? '';
  const email = card.contact.emails[0] ?? '';

  return (
    <div className="bg-wine min-h-screen" style={{ animation: 'card-fade-in 320ms ease-out' }}>
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] h-16 bg-wine flex justify-end items-center px-4 z-50">
        <LocaleToggle activeColor={CREAM} inactiveColor="rgba(236,236,236,0.5)" />
      </header>

      <main className="max-w-[420px] mx-auto px-4 pt-24 pb-16 flex flex-col items-center">
        <div className="flex flex-col items-center gap-1 mb-8">
          <FalconF size={28} color={ORANGE} />
          <span className="text-[12px] font-semibold uppercase tracking-wider-15" style={{ color: ORANGE }}>
            {brand.wordmark}
          </span>
        </div>

        <div className="relative w-24 h-24 mb-6 rounded-[12px] overflow-hidden flex items-center justify-center" style={{ border: `2px solid ${ORANGE}` }}>
          <Photo src={card.photo} alt={c.name} size={96} rounded="rounded" />
        </div>

        <h1 className="font-sans font-bold text-[36px] leading-[1.05] tracking-[-0.01em] mb-2 text-center" style={{ color: CREAM }}>
          {c.name}
        </h1>
        <p className="font-medium text-[14px] uppercase mb-8 text-center" style={{ color: ORANGE, letterSpacing: '0.1em' }}>
          {c.title}
        </p>

        <div className="w-full mb-3">
          <ActionButton
            variant="primary"
            template="force"
            label={t('SAVE_TO_CONTACTS', locale)}
            ariaLabel={`Download contact card for ${c.name}`}
            icon={<DownloadIcon color={WINE} />}
            href={`/${card.slug}/contact.vcf`}
          />
        </div>

        <div className="w-full flex flex-col gap-3 mb-10">
          {tel && (
            <ActionButton variant="secondary" template="force"
              label={`${t('CALL', locale)} ${card.contact.phoneDisplay ?? tel}`}
              icon={<PhoneIcon color={ORANGE} />}
              href={`tel:${tel}`} />
          )}
          {wa && (
            <ActionButton variant="secondary" template="force"
              label={t('WHATSAPP', locale)}
              icon={<WhatsAppIcon color={ORANGE} />}
              href={`https://wa.me/${wa.replace(/\D/g, '')}`} />
          )}
          {email && (
            <ActionButton variant="secondary" template="force"
              label={email}
              icon={<MailIcon color={ORANGE} />}
              href={`mailto:${email}`} />
          )}
          {tel && (
            <ActionButton variant="secondary" template="force"
              label={t('SEND_SMS', locale)}
              icon={<SMSIcon color={ORANGE} />}
              href={`sms:${tel}`} />
          )}
        </div>

        <hr className="w-[88%] border-0 h-px mb-8" style={{ backgroundColor: 'rgba(236,236,236,0.30)' }} />

        <div className="mb-10">
          <SocialIconRow socials={card.socials} color={CREAM} />
        </div>

        <div className="w-full grid grid-cols-2 gap-3 mb-12">
          <ShareButton url={url} title={c.name} template="force" label={t('SHARE', locale)} />
          <QRModal url={url} template="force" label={t('QR_CODE', locale)} />
        </div>

        <footer className="flex flex-col items-center gap-1 text-[11px] text-center" style={{ color: 'rgba(236,236,236,0.6)' }}>
          <span>© {card.copyrightYear} {brand.footerOrg}</span>
          <span className="text-[10px] font-medium uppercase tracking-wider-15">{t(brand.byKey, locale)}</span>
        </footer>
      </main>
    </div>
  );
}
