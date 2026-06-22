export type QuoteRoom = {
  key: string;
  roomName: string;
  optionName: string;
  totalPrice: number | null;
  totalPriceOld: number | null;
  unitsPrice: number | null;
  loftsPrice: number | null;
  servicesPrice: number | null;
  appliancesPrice: number | null;
  skirtingsPrice: number | null;
  worktopsPrice: number | null;
  additionalHWPrice: number | null;
  roomRev: string;
  matlInfo: string;
  units: Array<{ label: string; cabinetClass: string; description: string; dimensions: string; price: number | null }>;
  lofts: Array<{ description: string; dimensions: string; price: number | null }>;
  servicesList: Array<{ category: string; description: string; qty: number | null; uom: string; price: number | null }>;
};
