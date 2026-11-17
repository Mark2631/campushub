type BrandMarkProps = { size?: number; className?: string; title?: string };

export default function BrandMark({ size = 44, className, title }: BrandMarkProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      {title ? <title>{title}</title> : null}
      <rect x="1" y="1" width="46" height="46" rx="14" fill="#125B47" />
      <path d="M14.5 19.5h19l-1.4 17.2c-.1 1.2-1.1 2.1-2.3 2.1H18.2c-1.2 0-2.2-.9-2.3-2.1l-1.4-17.2Z" fill="#F7F7F1" />
      <path d="M18.5 20v-3.6a5.5 5.5 0 0 1 11 0V20" fill="none" stroke="#F7F7F1" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M18.8 27.2c2.2 2.1 8.2 2.1 10.4 0" fill="none" stroke="#125B47" strokeWidth="2" strokeLinecap="round" />
      <circle cx="34.4" cy="13.2" r="4.3" fill="#E6A641" />
      <circle cx="34.4" cy="13.2" r="1.4" fill="#125B47" />
    </svg>
  );
}
