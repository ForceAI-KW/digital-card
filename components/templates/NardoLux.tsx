'use client';
import Image from 'next/image';
import type { Card } from '@/data/cards/_types';
import { ActionButton } from '@/components/ActionButton';
import { SocialIconRow } from '@/components/SocialIconRow';
import { LocaleToggle } from '@/components/LocaleToggle';
import { ShareButton } from '@/components/ShareButton';
import { QRModal } from '@/components/QRModal';
import { t } from '@/lib/i18n';
import { useLocale } from '@/lib/locale-context';
import { PhoneIcon, WhatsAppIcon, MailIcon, SMSIcon, DownloadIcon } from '@/components/icons';

const NARDO = '#686A6C';

type Props = { card: Card; url: string };

export function NardoLux({ card, url }: Props) {
  const { locale } = useLocale();
  const c = card[locale];
  const tel = card.contact.phone ?? '';
  const wa  = card.contact.whatsapp ?? card.contact.phone ?? '';
  const email = card.contact.emails[0] ?? '';

  return (
    <div className="bg-white min-h-screen">
      {/* Fixed top bar */}
      <header
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] h-16 bg-white border-b flex justify-between items-center px-4 z-50"
        style={{ borderBottomColor: 'rgba(104,106,108,0.25)' }}
      >
        {/* Nardo grey wordmark — NOT black */}
        <span
          className="text-[12px] font-semibold uppercase tracking-wider-15"
          style={{ color: NARDO }}
        >
          FORCE AI
        </span>
        <LocaleToggle />
      </header>

      <main className="max-w-[420px] mx-auto px-4 pt-32 pb-16 flex flex-col items-center">
        {/* Hero avatar — Nardo circle bg (6% opacity) + 1.5px solid Nardo border */}
        <div
          className="relative w-24 h-24 mb-6 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgba(104,106,108,0.06)', border: `1.5px solid ${NARDO}` }}
        >
          <Image
            src={card.photo}
            alt={c.name}
            width={96}
            height={96}
            className="w-full h-full object-cover"
            priority
          />
        </div>

        {/* Name — serif italic large */}
        <h1 className="font-serif italic text-[48px] leading-[1.05] tracking-[-0.02em] text-ink mb-2 text-center">
          {c.name}
        </h1>

        {/* Subtitle — Nardo grey, 0.12em letter-spacing inline to bypass any missing Tailwind token */}
        <p
          className="font-medium text-[12px] uppercase mb-8 text-center"
          style={{ color: NARDO, letterSpacing: '0.12em' }}
        >
          {c.title}
        </p>

        {/* Primary CTA — save to contacts */}
        <div className="w-full mb-3">
          <ActionButton
            variant="primary"
            template="lux"
            label={t('SAVE_TO_CONTACTS', locale)}
            icon={<DownloadIcon />}
            href={`/${card.slug}/contact.vcf`}
          />
        </div>

        {/* Secondary action buttons */}
        <div className="w-full flex flex-col gap-3 mb-10">
          {tel && (
            <ActionButton
              variant="secondary"
              template="lux"
              label={`${t('CALL', locale)} ${card.contact.phoneDisplay ?? tel}`}
              icon={<PhoneIcon />}
              href={`tel:${tel}`}
            />
          )}
          {wa && (
            <ActionButton
              variant="secondary"
              template="lux"
              label={t('WHATSAPP', locale)}
              icon={<WhatsAppIcon />}
              href={`https://wa.me/${wa.replace(/\D/g, '')}`}
            />
          )}
          {email && (
            <ActionButton
              variant="secondary"
              template="lux"
              label={email}
              icon={<MailIcon />}
              href={`mailto:${email}`}
            />
          )}
          {tel && (
            <ActionButton
              variant="secondary"
              template="lux"
              label={t('SEND_SMS', locale)}
              icon={<SMSIcon />}
              href={`sms:${tel}`}
            />
          )}
        </div>

        {/* Hairline divider — Nardo 40% opacity */}
        <hr
          className="w-[88%] border-0 h-px mb-8"
          style={{ backgroundColor: 'rgba(104,106,108,0.40)' }}
        />

        {/* Social icons — stroke color = Nardo */}
        <div className="mb-10">
          <SocialIconRow socials={card.socials} color={NARDO} />
        </div>

        {/* Share + QR pill row */}
        <div className="w-full grid grid-cols-2 gap-3 mb-12">
          <ShareButton url={url} title={c.name} template="lux" label={t('SHARE', locale)} />
          <QRModal url={url} template="lux" label={t('QR_CODE', locale)} />
        </div>

        {/* Footer — Nardo grey text */}
        <footer className="flex flex-col items-center gap-1 text-[11px]" style={{ color: NARDO }}>
          <span>© {card.copyrightYear} {c.name}</span>
          <span className="text-[10px] font-medium uppercase tracking-wider-15">{t('BY_FORCE_AI', locale)}</span>
        </footer>
      </main>
    </div>
  );
}
