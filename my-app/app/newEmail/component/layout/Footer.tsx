import * as React from 'react';
import { Section, Row, Column, Img, Text, Link } from '@react-email/components';

export const Footer = () => (
  <Section className="bg-brand-primary px-8 py-8 w-full rounded-b-xl border-t border-brand-primary">
    <Row>
      {/* LEFT SIDE: Logo and Title */}
      <Column align="center" className="w-[40%] align-center">
        <Img
          src={"https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/logo/logo_transparent.png"}
          width="100"
          height="auto"
          alt="HUB Logo"
          className="block"
        />
        <Text className="m-0 mt-2 text-white font-serif text-[20px] font-bold tracking-wide leading-none">
          HUB INTERIOR
        </Text>
        <Text className="m-0 mt-1 text-white opacity-90 font-sans text-[12px] tracking-widest uppercase leading-none">
          HOMES UNIQUELY BUILT
        </Text>
      </Column>

      {/* RIGHT SIDE: Socials, Address, Email */}
      <Column align="center" className="w-[60%] align-middle">
        <table align="center" cellPadding={0} cellSpacing={0} border={0}>
          <tr>
            <td className="px-2">
              <Link href="" target="_blank">
                <Img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" width="24" height="24" alt="Facebook" />
              </Link>
            </td>
            <td className="px-2">
              <Link href="#" target="_blank">
                <Img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png" width="24" height="24" alt="Instagram" />
              </Link>
            </td>
            <td className="px-2">
              <Link href="https://hubinterior.com/" target="_blank">
                <Img src="https://img.icons8.com/ios-filled/50/ffffff/domain.png" width="24" height="24" alt="Website" />
              </Link>
            </td>
          </tr>
        </table>
        <Text className="m-0 mt-4 text-white opacity-90 font-sans text-[12px] leading-[20px] font-semibold text-center">
          1st Floor, 6th Cross Rd, 1st Stage,<br/>
          HBR Layout 4th Block,<br/>
          Bengaluru, Karnataka 560044
        </Text>
        <Text className="m-0 mt-2 font-sans text-[12px] leading-[20px] font-semibold text-center">
          <Link href="mailto:hello@hubinterior.com" className="text-white opacity-90 underline">
            hello@hubinterior.com
          </Link>
        </Text>
      </Column>
    </Row>
  </Section>
);