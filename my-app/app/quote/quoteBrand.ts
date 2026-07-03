import { theme } from '@/app/newEmail/theme';

/** Canonical S3 asset. Quotation UI serves the same file from `/public/logo/`. */
export const HUB_LOGO_S3_URL =
  'https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/logo/LOGO+MAINPNG-01.png';

/** Local copy — avoids Next.js image optimizer / remote fetch issues in the browser. */
export const HUB_LOGO_SRC = '/logo/logo-main.png';

/** Logo aspect ratio (3138×878) for width/height on the header img. */
export const HUB_LOGO_ASPECT = 3138 / 878;

/** Same font stacks as `app/newEmail/theme` — Manrope body, Wulkan headings. */
export const QUOTE_FONTS = {
  body: theme.fonts.body,
  heading: theme.fonts.heading,
} as const;

export const WULKAN_FONT_FILES = {
  regular:
    'https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/fonts/Wulkan-Regular.woff2',
  bold: 'https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/fonts/Wulkan-Bold.woff2',
} as const;
