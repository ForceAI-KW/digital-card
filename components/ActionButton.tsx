import React from 'react';
import type { Template } from '@/data/cards/_types';

type Variant = 'primary' | 'secondary' | 'small';

type CommonProps = {
  variant: Variant;
  template: Template;
  label: string;
  ariaLabel?: string;
  icon?: React.ReactNode;
  className?: string;
};

type LinkProps  = CommonProps & { href: string; onClick?: never };
type BtnProps   = CommonProps & { onClick: () => void; href?: never };
type Props      = LinkProps | BtnProps;

const STYLES: Record<Template, Record<Variant, string>> = {
  lux: {
    primary:   'h-14 bg-ink text-white font-semibold hover:font-bold uppercase tracking-wider-12 text-[14px]',
    secondary: 'h-14 bg-[rgba(104,106,108,0.02)] border border-ink text-ink font-medium hover:font-semibold text-[14px]',
    small:     'h-12 bg-[rgba(104,106,108,0.02)] border border-ink text-ink font-medium hover:font-semibold uppercase tracking-[0.08em] text-[13px]',
  },
  force: {
    primary:   'h-14 bg-orange text-wine font-bold hover:font-black uppercase tracking-wider-12 text-[14px] hover:bg-orange-hover',
    secondary: 'h-14 bg-transparent border border-orange text-cream font-medium hover:font-semibold text-[14px] hover:bg-wine-elev/60',
    small:     'h-12 bg-transparent border border-cream/30 text-cream font-medium hover:font-semibold uppercase tracking-[0.08em] text-[13px]',
  },
};

export function ActionButton(props: Props) {
  const { variant, template, label, ariaLabel, icon, className = '' } = props;
  const cls = `w-full rounded-pill flex items-center justify-center gap-3 px-6 transition-all duration-[180ms] ease-in-out active:scale-[0.98] ${STYLES[template][variant]} ${className}`;
  const accessibleLabel = ariaLabel ?? label;

  const content = (
    <>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="leading-none">{label}</span>
    </>
  );

  if ('href' in props && props.href) {
    return <a href={props.href} className={cls} aria-label={accessibleLabel}>{content}</a>;
  }
  return <button type="button" onClick={props.onClick} className={cls} aria-label={accessibleLabel}>{content}</button>;
}
