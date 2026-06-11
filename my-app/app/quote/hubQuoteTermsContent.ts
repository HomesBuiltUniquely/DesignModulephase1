export type QuoteTermsRow = {
  label?: string;
  value?: string;
  valueCenter?: boolean;
  /** Full-width row (banner or note inside the table). */
  fullWidth?: string;
  bold?: boolean;
};

export type QuoteTermsSection = {
  title: string;
  intro?: string;
  rows: QuoteTermsRow[];
  footnotes?: string[];
  bullets?: string[];
};

export const HUB_QUOTE_TERMS_SECTIONS: QuoteTermsSection[] = [
  {
    title: 'CORE MATERIALS',
    rows: [
      {
        label: 'Core Materials (Kitchen base unit, Bathroom Vanity Carcass, etc.)',
        value: 'Century BWP (IS-710 Grade)',
      },
      {
        label: 'Dry Areas (Wardrobe & Lofts, TV units,etc)',
        value: 'Century Sainik MR (ISI-303)',
      },
      {
        fullWidth: 'ALL MODULES CAN BE CUSTOMIZED AS PER REQUIREMENT / ACTUAL SIZE',
        bold: true,
      },
      {
        fullWidth:
          'Note: Plywood is not suggested for shutters, as they bend over the time, HDHMR Pro is a better alternative & Recommended',
      },
    ],
  },
  {
    title: 'Material Thickness',
    rows: [
      { label: 'Front Shutters, Doors, Exterior Frame', value: '18mm (Including laminate)' },
      { label: 'Back panels & below drawer panel', value: '8mm ( Including Laminate)' },
    ],
  },
  {
    title: 'Core Material Brands',
    rows: [
      { label: 'BWP (Boiling water proof)', value: 'Century Club Prime' },
      { label: 'MR (Moisture Resistance)', value: 'Century Sainik' },
      { label: 'HDHMR Pro', value: 'Action Tesa' },
      { label: 'MDF', value: 'Action Tesa / Green Panel' },
      { label: 'Edge Banding (Outside)', value: 'Rehau ( 2mm Exterior)' },
      { label: 'Edge Banding (Inside)', value: 'Rehau ( 0.8mm Exterior)' },
      {
        fullWidth:
          'We recommend checking physical samples of all finish options at our experience centers',
      },
    ],
  },
  {
    title: 'FINISH OPTIONS',
    rows: [
      {
        label: 'Outside Laminates',
        value:
          '1 mm thickness, Choose from 200+ options. Price may vary as per laminate price range. Request our designer to share the designs available.',
      },
      {
        label: 'Brand Options',
        value:
          'Our laminates are shortlisted from Merino, Greenlam, Royale Touche and Dorby and have a pre-matched edge band. Certain laminates are not having 100% matching edge band. Request our designer to share the options accordingly.',
      },
      {
        label: 'Additional laminate options',
        value:
          'Additional laminate options can be provided, Slight higher price and timeline will be applicable due to non-optimization/uncertainty of availability.',
      },
      { label: 'Other finishes', value: 'Veneer/Membrane/Acrylic/Duco/ PU, can be provided at extra cost' },
      {
        label: 'Inside Laminates',
        value:
          '0.72 mm of white colour as default. Choose from 30+ options. Price may vary as per laminate price range. Request our designer to share the designs available.',
      },
    ],
  },
  {
    title: 'ADHESIVE',
    rows: [{ label: 'Brand', value: 'Fevicol' }],
  },
  {
    title: 'ACCESSORIES INCLUDED',
    rows: [
      { label: 'Shutter Hinges', value: 'Hettich, Ebco, Haffele', valueCenter: true },
      { label: 'Drawer Channels', value: 'Hettich, Ebco, Haffele', valueCenter: true },
      {
        label: 'Other options',
        value: 'Soft-close hinges and channels can be used at extra cost',
        valueCenter: true,
      },
      {
        label: 'Glass, Mirror',
        value: 'Available from brands like Saint Gobain or Modi Guard. Charges additional.',
        valueCenter: true,
      },
    ],
    footnotes: [
      '* Hettich brand is used by Default across project, You can choose any other brand, prices vary accordingly',
    ],
  },
  {
    title: 'DESIGN INFO',
    intro: 'Manufacturing Type: All units are fully modular by default, which can be customized during design phase',
    rows: [
      {
        label: 'Wardrobe Internal Design',
        value:
          'By default wardrobe internal is provided which includes 1 drawer and two full shelves. Final price would be as per the selected internal.',
      },
      {
        label: 'Wardrobe Internal Presets',
        value: 'We offers 70+ pre-designed and optimized internal designs.',
      },
      {
        label: 'Custom Wardrobe Internal',
        value:
          'Custom(non-optimized) designs can be provided with additional timeline. Pricing may be higher due to wastage and manual manufacturing process.',
      },
      { label: 'Mirror', value: 'Mirrors are chargeable ( If needed extra)' },
      {
        label: 'Modular Kitchen Skirting',
        value:
          'Detachable skirting can be provided, depending on site conditions. By default wooden skirting is considered.',
      },
      {
        label: 'Design',
        value:
          'All designs can be customized in dimensions. New design options that are not already available with HUB will require additional timeline.',
      },
      {
        label: 'Manual Works',
        value:
          'Any non-standard or non-factory work like strip laminate design, etc will be charged extra.',
      },
    ],
  },
  {
    title: 'FLAT USAGE',
    rows: [
      {
        fullWidth:
          'Our workers will require electrical and water connections and one bathroom during the project schedule.',
      },
    ],
  },
  {
    title: 'DESIGN SIGN-OFF TERMS',
    rows: [
      {
        fullWidth:
          'Actual color of laminates/finishes may vary from 3D view. Customers are required to check actual laminate samples before finalizing.',
      },
      {
        fullWidth:
          'For wood grain laminates customer is required to check the full laminate sheet before production begins if required.',
      },
      {
        fullWidth:
          'The closest matching edge banding from Rehau brand will be used by HUB. If no nearest match exists, HUB may use grey or cream color edge banding depending on the laminate color. Edge banding cannot be customized.',
      },
      {
        fullWidth:
          'No design changes can be made after design sign-off & material procurement.',
      },
    ],
  },
  {
    title: 'CLEANING',
    rows: [
      {
        fullWidth:
          'HUB will engage professional cleaning services for cleaning of furniture, full home including bathrooms and removable of debris. Cleaning service will be provided only once at the end of the project, cleaning due to Pooja, etc in between the project to be borne by customer. Cleaning is to be completed before Handover of the project and involvement of Third-party vendors.',
      },
    ],
  },
  {
    title: 'FINAL COAT OF PAINT',
    rows: [
      {
        fullWidth:
          'Its recommended to do a final coat of paint after completion of interior work. Since, its not possible to avoid handmarks, scratches during installation and civil works.',
      },
      { fullWidth: 'Cost for final coat of paint is not included unless mentioned in the detailed quote.' },
      { fullWidth: 'Painting for false ceiling will be included, if opted.' },
    ],
  },
  {
    title: 'POST HANDOVER SERVICE',
    rows: [
      { fullWidth: 'Post handover issues shall be raised by emailing at care@hubinterior.com' },
      {
        fullWidth:
          'We provide upto two free of cost service visits post 12 months of the handover. Service visits cover routine maintenance related to moving parts like hinges, channels, accessories etc and general alignment fixes for all shutters, lofts, etc.',
      },
      {
        fullWidth:
          'Since the products have a lot of moving parts, our product may need occasional re-alignments and servicing. Any service and maintenance requests after the free service period will be done on a chargeable basis. The current service visit fee is a sum of ₹499 per visit. Visiting fee includes re-alignment of all products, but do not cover any replacements. Replacements will be charged as per actuals. To raise a service request please email us at care@hubinterior.com',
      },
      {
        fullWidth:
          'During this visit, if an item is found to be faulty, the same will be replaced based on the below scenarios:',
      },
      {
        fullWidth:
          'a. If work involved is only replacement of items covered under warranty, and no other realignment/replacement, the sum of Rs 499 will be waived off',
      },
      {
        fullWidth:
          'b. If the work includes re-alignment of units and/or replacement of items not covered under warranty (due to physical damage, continuous water leakage, rusting, etc), the cost of replacement will be over and above Rs 499 and the appropriate cost for the item to be replaced.',
      },
    ],
  },
  {
    title: 'WARRANTY',
    rows: [
      {
        fullWidth:
          'Modular Units: 10 years product warranty against any manufacturing defects for woodwork. Please refer works contract.',
      },
      { fullWidth: 'Hardware, Accessories and Appliances: As per manufacturers warranty.' },
      { fullWidth: 'Mirrors & Glass materials are void from warranty post handover.' },
      { fullWidth: 'Warranty is void under the following conditions:', bold: true },
    ],
    bullets: [
      'On any components supplied or installed by third-party vendors.',
      'Damages due to "Acts of God" like earthquakes, floods, cyclone, lightning, etc.',
      'Physical damages due to continous contact with water or foreign substances, negligence, accidents, misuse, tampering, fire, scratches, etc.',
      'Warranty does not cover any solid wood furniture, wallpapers, civil work like tiling, false ceiling, plumbing, etc, electrical appliances or electrical fittings, glass/mirrors, paint/polish or any non-branded accessories.',
      'HUB shall not be liable for loss or damage arising due to Force Majeure event.',
    ],
  },
  {
    title: 'PAYMENT',
    rows: [
      {
        label: 'Design Start Stage',
        value: '10% of the total amount is required to book your order and start designing.',
      },
      {
        label: 'Before Masking',
        value: '10% of the total amount is required to freeze your designs and start site masking.',
      },
      {
        label: 'Production Start',
        value: '40% of the total amount is required after design sign off for pushing the project to production',
      },
      {
        label: 'Before Dispatch',
        value: '30% of the total amount is due before material dispatch from factory to site',
      },
      {
        label: 'Post carcass',
        value: '10% final amount post carcass installation and before shutter installation.',
      },
      {
        fullWidth:
          'Works like electrical, plumbing, painting, countertops, tiling, false ceiling, etc are considered under Civil Work.',
      },
      {
        fullWidth:
          'Products of Non modular includes electrical appliances and fixtures, lighting fixtures, decor items, wallpapers, wooden flooring, blinds, curtains, readymade furniture, etc.',
      },
    ],
    footnotes: [
      '* NEFT/IMPS can be used for payments. Card/Netbanking transactions available with 2% convenience fees (Waived off for first 10% trench only).',
    ],
  },
  {
    title: 'Cancellation and Scope Change Policy',
    rows: [
      {
        label: 'Booking',
        value:
          '100% design advance will be refunded if a valid modular competitor quote is shared within 24 hours and HUB is unable to match the pricing.',
      },
      { label: 'Design Stage', value: 'No refunds' },
      {
        label: 'Production Stage',
        value: 'No refunds can be provided as we have already ordered materials specific to your project.',
      },
      {
        label: 'Refund Terms',
        value:
          'Any refund, if applicable, will be processed only upon execution of a standard Refund Deed. 21 working days is applicable post the finance team send the mail.',
      },
      {
        label: 'Decrease in scope of work',
        value:
          'Descoping during design stage will result in descoping charges applied through discount reduction, based on the project scope and work done by the team',
      },
      {
        label: 'Decrease in scope of work',
        value:
          'No descoping is allowed once project is pushed to production (P2P) stage, nor during the installation stage. Client is obliged to pay 100% payment.',
      },
    ],
  },
  {
    title: 'Delivery and Installation',
    rows: [
      {
        fullWidth:
          'The delivery and installation of Customer\'s Order shall be on or before the delivery date prescribed in the Timeline via mail, and at the address given by the Customer.',
      },
      {
        fullWidth:
          'Delivery Date will be calculated from the date of completion of the following requirements ("All-Set-Go"):',
      },
    ],
    bullets: [
      'Both Parties (Customer and HUB) have signed off on the final designs and specifications.',
      'If there is no lift in property then additional/ floor unloading charges is applicable. Request our designer to share the charges details accordingly.',
      'Customer has made all payments as per the agreed milestones and HUB has confirmed receipt via email.',
      'Customer has handed over the site meeting all conditions of the Site Readiness Checklist as per the Works Contract.',
      'Non-Solicitation - Customer shall not approach any Vendors undertaking the Custom Scope of Work, directly or indirectly, without the explicit written consent of HUB.',
    ],
    footnotes: [
      '* Disclaiming of Liability: HUB shall not be liable in any manner for any products or services provided by Vendors, contractors, or agencies who are referred to the Customer by any individual (whether associated with HUB or otherwise) but are not formally registered as approved Vendors with HUB, or where such approved Vendors act outside the scope of work allocated by HUB, i.e. in their personal capacity. Any quotations, negotiations, payments, commitments, or financial arrangements made by the Customer with such third-party vendors shall be entirely at the Customer\'s own risk, and HUB shall not be responsible for the quality, workmanship, finish, delivery, timelines, or any commitments given by such vendors. The Company\'s warranty and service obligations shall not extend to or cover any such products or services, and no statement or referral by any individual shall be construed as binding on HUB.',
    ],
  },
];
