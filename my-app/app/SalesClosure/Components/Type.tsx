import {
  PropertyConfig,
  BookingType,
  PaymentMode,
  PaymentReceived,
} from "./Enums";

import { z } from "zod";

export const salesClosureSchema = z.object({
  sales_lead_name: z.string().min(1, "Sales lead name is required"),

  sales_spoc: z.string().min(1, "Sales SPOC is required"),

  sales_email: z
    .string()
    .min(1, "Sales email is required")
    .email("Enter a valid sales email")
    .refine(
      (value) => value.toLowerCase().endsWith("@hubinterior.com"),
      "Sales email must end with @hubinterior.com",
    ),

  customer_name: z.string().min(1, "Customer name is required"),

  co_no: z
    .string()
    .min(1, "Contact number is required")
    .regex(/^\d{10}$/, "Contact number must be exactly 10 digits"),

  email: z
    .string()
    .min(1, "Customer email is required")
    .email("Enter a valid customer email"),

  property_name: z.string().min(1, "Property name is required"),

  possession: z.string().min(1, "Possession is required"),

  lead_source: z.string().min(1, "Lead source is required"),

  property_configuration: z.union([
    z.nativeEnum(PropertyConfig),
    z.literal(""),
  ]),

  experience_center: z.string(),

  site_address: z.string().min(1, "Site address is required"),

  booking_date: z.string().min(1, "Booking date is required"),

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

  mode_of_payment: z.union([z.nativeEnum(PaymentMode), z.literal("")]),

  payment_screenshot: z.string().min(1, "Payment screenshot is required"),

  status_of_project: z.string(),

  special_offer: z.string(),

  custom_commitments: z.string(),

  timeline_promise_by_sales: z.string(),

  scope_frozen: z.union([z.enum(["YES", "NO"]), z.literal("")]),

  approval_proof: z.string().optional(),
});

export type SalesClosureFormType = z.infer<typeof salesClosureSchema>;
