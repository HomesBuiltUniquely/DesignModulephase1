'use client';

import { useState } from 'react';
import { QuoteExperienceView } from '@/app/quote/QuoteExperienceView';
import type { QuoteRoom } from '@/app/quote/quoteTypes';
import type { QuoteDiscountBreakdownRow } from '@/app/quote/quoteDiscountBreakdown';

const DEMO_ROOMS: QuoteRoom[] = [
  {
    key: 'living',
    roomName: 'Living Room',
    optionName: 'Option A — Modern Minimal',
    totalPrice: 385000,
    totalPriceOld: 420000,
    unitsPrice: 280000,
    loftsPrice: 45000,
    servicesPrice: 35000,
    appliancesPrice: 0,
    skirtingsPrice: 12000,
    worktopsPrice: 0,
    additionalHWPrice: 13000,
    roomRev: '1',
    matlInfo:
      'Core: BWP plywood\nFinish: SF 2109 (High Gloss)\nHardware: Hettich soft-close\nEdge band: 2mm PVC matching laminate',
    units: [
      {
        label: 'TV Unit',
        cabinetClass: 'Storage',
        description: 'Wall-mounted TV unit with open shelf and closed storage below',
        dimensions: '2400 × 450 × 350 mm',
        price: 95000,
      },
      {
        label: 'Shoe Rack',
        cabinetClass: 'Storage',
        description: 'Slim profile shoe rack with ventilated slots',
        dimensions: '900 × 350 × 1100 mm',
        price: 32000,
      },
      {
        label: 'Display Unit',
        cabinetClass: 'Display',
        description: 'Open display with LED strip provision and glass shelves',
        dimensions: '1200 × 300 × 1800 mm',
        price: 68000,
      },
      {
        label: 'Side Console',
        cabinetClass: 'Storage',
        description: 'Compact console with drawer and open niche',
        dimensions: '800 × 400 × 750 mm',
        price: 45000,
      },
    ],
    lofts: [
      { description: 'TV unit loft storage', dimensions: '2400 × 450 × 350 mm', price: 28000 },
      { description: 'Display unit top loft', dimensions: '1200 × 300 × 350 mm', price: 17000 },
    ],
    servicesList: [
      {
        category: 'Electrical Points',
        description: 'Provision for TV, set-top box, and ambient lighting',
        qty: 4,
        uom: 'Nos',
        price: 12000,
      },
      {
        category: 'False Ceiling',
        description: 'Gypsum board ceiling with cove lighting in living area',
        qty: 1,
        uom: 'Lump sum',
        price: 23000,
      },
    ],
  },
  {
    key: 'kitchen',
    roomName: 'Kitchen',
    optionName: 'Option B — L-Shaped Modular',
    totalPrice: 520000,
    totalPriceOld: 565000,
    unitsPrice: 340000,
    loftsPrice: 62000,
    servicesPrice: 48000,
    appliancesPrice: 35000,
    skirtingsPrice: 15000,
    worktopsPrice: 42000,
    additionalHWPrice: 18000,
    roomRev: '1',
    matlInfo:
      'Core: BWR plywood (wet area)\nFinish: SF 1847 (Matte)\nHardware: Hafele tandem + soft-close\nCountertop: Quartz — Statuario White',
    units: [
      {
        label: 'Base Units',
        cabinetClass: 'Base',
        description: 'L-shaped base cabinets with tandem drawers and pull-out pantry',
        dimensions: '4200 × 600 × 820 mm',
        price: 185000,
      },
      {
        label: 'Wall Units',
        cabinetClass: 'Wall',
        description: 'Overhead wall cabinets with lift-up shutters',
        dimensions: '3800 × 350 × 720 mm',
        price: 98000,
      },
      {
        label: 'Tall Unit',
        cabinetClass: 'Tall',
        description: 'Full-height pantry with internal organisers',
        dimensions: '600 × 600 × 2100 mm',
        price: 57000,
      },
    ],
    lofts: [
      { description: 'Wall unit loft boxes', dimensions: '3800 × 350 × 350 mm', price: 42000 },
      { description: 'Tall unit top loft', dimensions: '600 × 600 × 350 mm', price: 20000 },
    ],
    servicesList: [
      {
        category: 'Plumbing',
        description: 'Sink, RO, and dishwasher point connections',
        qty: 1,
        uom: 'Lump sum',
        price: 18000,
      },
      {
        category: 'Chimney & Hob',
        description: 'Chimney ducting and hob cut-out in quartz',
        qty: 1,
        uom: 'Set',
        price: 30000,
      },
    ],
  },
  {
    key: 'master',
    roomName: 'Master Bedroom',
    optionName: 'Option A — Walk-in Wardrobe',
    totalPrice: 340000,
    totalPriceOld: 368000,
    unitsPrice: 265000,
    loftsPrice: 38000,
    servicesPrice: 22000,
    appliancesPrice: 0,
    skirtingsPrice: 8000,
    worktopsPrice: 0,
    additionalHWPrice: 7000,
    roomRev: '1',
    matlInfo:
      'Core: MR plywood\nFinish: SF 2109 + SF 1847 combo\nHardware: Hettich sliding + soft-close hinges\nMirror: 5mm clear with safety backing',
    units: [
      {
        label: 'Wardrobe — Sliding',
        cabinetClass: 'Wardrobe',
        description: 'Full-height sliding wardrobe with internal drawers and hanging',
        dimensions: '2700 × 650 × 2400 mm',
        price: 145000,
      },
      {
        label: 'Dresser Unit',
        cabinetClass: 'Storage',
        description: 'Dresser with mirror, drawers, and open niche',
        dimensions: '1200 × 450 × 900 mm',
        price: 62000,
      },
      {
        label: 'Bedside Units',
        cabinetClass: 'Storage',
        description: 'Pair of floating bedside tables with drawer',
        dimensions: '500 × 400 × 450 mm (×2)',
        price: 58000,
      },
    ],
    lofts: [
      { description: 'Wardrobe top loft storage', dimensions: '2700 × 650 × 400 mm', price: 38000 },
    ],
    servicesList: [
      {
        category: 'Electrical',
        description: 'Bedside reading lights and wardrobe interior LED',
        qty: 1,
        uom: 'Lump sum',
        price: 22000,
      },
    ],
  },
];

const DEMO_DISCOUNT_ROWS: QuoteDiscountBreakdownRow[] = [
  {
    key: 'woodwork',
    label: 'Woodwork',
    price: 885000,
    discountedPrice: 796500,
    discountPct: 10,
    discountAmount: 88500,
    factor: 0.9,
    alwaysShow: true,
  },
  {
    key: 'accessories',
    label: 'Accessories',
    price: 45000,
    discountedPrice: 40500,
    discountPct: 10,
    discountAmount: 4500,
    factor: 0.9,
    alwaysShow: true,
  },
  {
    key: 'constructionHw',
    label: 'Construction Hardware',
    price: 38000,
    discountedPrice: 34200,
    discountPct: 10,
    discountAmount: 3800,
    factor: 0.9,
    alwaysShow: true,
  },
  {
    key: 'services',
    label: 'Services',
    price: 105000,
    discountedPrice: 94500,
    discountPct: 10,
    discountAmount: 10500,
    factor: 0.9,
    alwaysShow: true,
  },
];

const DEMO_META: Record<string, string> = {
  customerName: 'Rahul Sharma',
  refId: 'HUB-BLR-2026-0142',
  city: 'Bangalore',
  quoteNum: 'Q-78432',
  bhkType: '3 BHK',
  projectType: 'Full Home Interiors',
  projectId: 'PRJ-9821',
  date: '28 Jun 2026',
};

export default function QuoteDemoPage() {
  const [metaDraft, setMetaDraft] = useState(DEMO_META);
  const [summaryTab, setSummaryTab] = useState<'overall' | 'roomwise' | 'terms'>('overall');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ living: true });
  const [productTab, setProductTab] = useState<Record<string, string>>({});
  const [linkCopiedState, setLinkCopiedState] = useState<'customer' | 'internal' | null>(null);

  const quote = {
    quotationId: '78432',
    quoteNum: 'Q-78432',
    customerName: 'Rahul Sharma',
    refId: 'HUB-BLR-2026-0142',
    city: 'Bangalore',
    bhkType: '3 BHK',
    projectType: 'Full Home Interiors',
    projectId: 'PRJ-9821',
    totalPayableAmount: 1245000,
    interiorProjectAmount: 1187500,
    designAndManagementFees: 87500,
    discount: 107300,
    discountBreakdown: DEMO_DISCOUNT_ROWS,
    lineItems: [
      { roomKey: 'living', name: 'Living Room', amount: 420000, discountedAmount: 385000 },
      { roomKey: 'kitchen', name: 'Kitchen', amount: 565000, discountedAmount: 520000 },
      { roomKey: 'master', name: 'Master Bedroom', amount: 368000, discountedAmount: 340000 },
    ],
    rooms: DEMO_ROOMS,
  };

  return (
    <QuoteExperienceView
      quote={quote}
      metaDraft={metaDraft}
      setMetaDraft={setMetaDraft}
      customerFirstName="Rahul"
      isInternalMode
      customerShareLink="http://127.0.0.1:3000/quote/demo"
      internalShareLink="http://127.0.0.1:3000/quote/demo?internal=1"
      linkCopiedState={linkCopiedState}
      setLinkCopiedState={setLinkCopiedState}
      summaryTab={summaryTab}
      setSummaryTab={setSummaryTab}
      expanded={expanded}
      setExpanded={setExpanded}
      productTab={productTab}
      setProductTab={setProductTab}
      quoteVersions={[
        { quoteId: 78430, createdAt: '2026-06-20T10:30:00.000Z' },
        { quoteId: 78432, createdAt: '2026-06-28T09:15:00.000Z' },
      ]}
      quoteVersionsLoading={false}
      quoteVersionsError={null}
      versionFetchId="78432"
      internalVersionSuffix="?internal=1"
    />
  );
}
