import {
  PropertyConfig,
  OrderBookingMonth,
  BookingType,
  PaymentMode,
  StatusOfProject,
  PaymentReceived,
} from "./Enums";

import { z } from "zod";

export type FetchData = {
  sales_lead_name: string;
  sales_spoc: string;
  sales_email: string;
  customer_name: string;
  co_no: string;
  email: string;
  property_name: string;
  possession: string;
  lead_source: string;
};

export const salesClosureSchema = z.object({
  property_configuration: z.union([
    z.nativeEnum(PropertyConfig),
    z.literal(""),
  ]),

  experience_center: z.string().min(1, "Experience center is required"),

  site_address: z.string().min(1, "Site address is required"),

  booking_date: z.string().min(1, "Booking date is required"),

  booking_month: z.number(),

  booking_year: z.number(),

  order_booking_month: z.union([
    z.nativeEnum(OrderBookingMonth),
    z.literal(""),
  ]),

  booking_type: z.union([z.nativeEnum(BookingType), z.literal("")]),

  spot_booking: z.boolean(),

  designer_name: z.string().min(1, "Designer name is required"),

  designer_lead: z.string().optional(),

  order_value: z.number(),

  dis_on_woodwork: z.number(),

  dis_on_service: z.number(),

  dis_on_accessories: z.number(),

  hub_coins: z.number().optional(),

  complimentary_offer: z.number().optional(),

  payment_received: z.union([z.nativeEnum(PaymentReceived), z.literal("")]),

  amount_paid: z.union([z.enum(["YES", "NO"]), z.literal("")]),

  mode_of_payment: z.union([z.nativeEnum(PaymentMode), z.literal("")]),

  payment_screenshot: z.string().min(1, "Payment screenshot is required"),

  status_of_project: z.union([z.nativeEnum(StatusOfProject), z.literal("")]),

  special_offer: z.string(),

  custom_commitments: z.string(),

  timeline_promise_by_sales: z.string(),

  scope_frozen: z.union([z.enum(["YES", "NO"]), z.literal("")]),

  approval_proof: z.string().optional(),
});

export type SalesClosureFormType = z.infer<typeof salesClosureSchema>;
