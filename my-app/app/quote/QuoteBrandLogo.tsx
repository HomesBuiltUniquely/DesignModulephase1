import { HUB_LOGO_ASPECT, HUB_LOGO_SRC } from './quoteBrand';

type Props = {
  className?: string;
  height?: number;
};

/** Native img — Next/Image optimizer fails on the S3 URL in dev/production. */
export function QuoteBrandLogo({ className = 'h-8 w-auto', height = 32 }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={HUB_LOGO_SRC}
      alt="HUB Interior"
      height={height}
      width={Math.round(height * HUB_LOGO_ASPECT)}
      className={className}
      decoding="async"
    />
  );
}
