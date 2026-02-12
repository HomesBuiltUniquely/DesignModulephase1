'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

type ImageOption = {
    id: number;
    src: string;
    alt: string;
    css: string;
    text: string;
};

// Order A–H: Scandinavian, European Classic, Industrial, Farmhouse, Bohemian, Modern Contemporary, Minimalistic, Wabi-Sabi
const IMAGE_OPTIONS: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+1/scandanavian.png", alt: "Scandinavian", css: "w-full h-64", text: "Scandinavian" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+1/European+classic.png", alt: "European Classic", css: "w-full h-64", text: "European Classic" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+1/Industrial.png", alt: "Industrial", css: "w-full h-64", text: "Industrial" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+1/farmhouse.png", alt: "Farmhouse", css: "w-full h-64", text: "Farmhouse" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+1/bohemian.png", alt: "Bohemian", css: "w-full h-64", text: "Bohemian" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+1/modern+contemporary.png", alt: "Modern Contemporary", css: "w-full h-64", text: "Modern Contemporary" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+1/Minimalistic.png", alt: "Minimalistic", css: "w-full h-64", text: "Minimalistic" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+1/Wabi+Sabi.png", alt: "Wabi-Sabi", css: "w-full h-64", text: "Wabi-Sabi" },
];

// Question 2: chair images from public folder (filenames with spaces → URL-encoded)
const QUESTION_2_IMAGES: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+2/A.+A+soft+oak+Scandinavian+lounge+chair.png", alt: "A soft oak Scandinavian lounge chair", css: "w-full h-64", text: "A soft oak Scandinavian lounge chair" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+2/B.+A+tufted+European+armchair+with+carved+details.png", alt: "A tufted European armchair with carved details", css: "w-full h-64", text: "A tufted European armchair with carved details" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+2/C.+A+metal-frame+industrial+accent+chair.png", alt: "A metal-frame industrial accent chair", css: "w-full h-64", text: "A metal-frame industrial accent chair" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+2/D.+A+rustic+wooden+farmhouse+rocking+chair.png", alt: "A rustic wooden farmhouse rocking chair", css: "w-full h-64", text: "A rustic wooden farmhouse rocking chair" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+2/E.+A+rattan+bohemian+papasan+chair.png", alt: "A rattan bohemian papasan chair", css: "w-full h-64", text: "A rattan bohemian papasan chair" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+2/F.+A+sleek+modern+contemporary+accent+chair.png", alt: "A sleek modern contemporary accent chair", css: "w-full h-64", text: "A sleek modern contemporary accent chair" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+2/G.+A+clean+minimalistic+low-profile+chair.png", alt: "A clean minimalistic low-profile chair", css: "w-full h-64", text: "A clean minimalistic low-profile chair" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+2/H.+A+raw%2C+imperfect+Wabi-Sabi+wooden+chair.png", alt: "A raw, imperfect Wabi-Sabi wooden chair", css: "w-full h-64", text: "A raw, imperfect Wabi-Sabi wooden chair" },
];

// Question 3: fabric texture images from public folder
const QUESTION_3_IMAGES: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+3/A.+Soft+cotton-weave+neutrals.png", alt: "Soft cotton-weave neutrals (Scandinavian)", css: "w-full h-64", text: "Soft cotton-weave neutrals (Scandinavian)" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+3/B.+Velvet+or+brocade+(European+Classic).png", alt: "Velvet or brocade (European Classic)", css: "w-full h-64", text: "Velvet or brocade (European Classic)" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+3/C.+Distressed+leather+(Industrial).png", alt: "Distressed leather (Industrial)", css: "w-full h-64", text: "Distressed leather (Industrial)" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+3/D.+Natural+jutelinen+(Farmhouse).png", alt: "Natural jute/linen (Farmhouse)", css: "w-full h-64", text: "Natural jute/linen (Farmhouse)" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+3/E.+Colorful+patterned+textiles+(Bohemian).png", alt: "Colorful patterned textiles (Bohemian)", css: "w-full h-64", text: "Colorful patterned textiles (Bohemian)" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+3/F.+Smooth+matte+upholstery+(Modern+Contemporary).png", alt: "Smooth matte upholstery (Modern Contemporary)", css: "w-full h-64", text: "Smooth matte upholstery (Modern Contemporary)" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+3/G.+Ultra-smooth+monochrome+fabrics+(Minimalistic).png", alt: "Ultra-smooth monochrome fabrics (Minimalistic)", css: "w-full h-64", text: "Ultra-smooth monochrome fabrics (Minimalistic)" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+3/H.+Raw%2C+organic%2C+unprocessed+textures+(Wabi-Sabi).png", alt: "Raw, organic, unprocessed textures (Wabi-Sabi)", css: "w-full h-64", text: "Raw, organic, unprocessed textures (Wabi-Sabi)" },
];

// Question 4: kitchen images from public folder
const QUESTION_4_IMAGES: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+4/A.+Light-toned+Scandinavian+kitchen.png", alt: "Light-toned Scandinavian kitchen", css: "w-full h-64", text: "Light-toned Scandinavian kitchen" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+4/B.+Elegant+European+Classic+kitchen+with+molding.png", alt: "Elegant European Classic kitchen with molding", css: "w-full h-64", text: "Elegant European Classic kitchen with molding" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+4/C.+Industrial+kitchen+with+metal+and+concrete.png", alt: "Industrial kitchen with metal and concrete", css: "w-full h-64", text: "Industrial kitchen with metal and concrete" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+4/D.+Warm+farmhouse+kitchen+with+wooden+cabinets.png", alt: "Warm farmhouse kitchen with wooden cabinets", css: "w-full h-64", text: "Warm farmhouse kitchen with wooden cabinets" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+4/E.+Bohemian+kitchen+with+mixed+patterns.png", alt: "Bohemian kitchen with mixed patterns", css: "w-full h-64", text: "Bohemian kitchen with mixed patterns" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+4/F.+Modern+contemporary+kitchen+with+clean+lines.png", alt: "Modern contemporary kitchen with clean lines", css: "w-full h-64", text: "Modern contemporary kitchen with clean lines" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+4/G.+Minimalistic+all-white+clutter-free+kitchen.png", alt: "Minimalistic all-white clutter-free kitchen", css: "w-full h-64", text: "Minimalistic all-white clutter-free kitchen" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+4/H.+Wabi-Sabi+kitchen+with+imperfect+ceramics.png", alt: "Wabi-Sabi kitchen with imperfect ceramics", css: "w-full h-64", text: "Wabi-Sabi kitchen with imperfect ceramics" },
];

// Question 5: artwork images from public folder
const QUESTION_5_IMAGES: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+5/A.+Minimal+abstract+Scandinavian+prints.png", alt: "Minimal abstract Scandinavian prints", css: "w-full h-64", text: "Minimal abstract Scandinavian prints" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+5/B.+Classical+European+paintings.png", alt: "Classical European paintings", css: "w-full h-64", text: "Classical European paintings" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+5/C.+Industrial+metal+wall+art.png", alt: "Industrial metal wall art", css: "w-full h-64", text: "Industrial metal wall art" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+5/D.+Rustic+botanical+farmhouse+illustrations.png", alt: "Rustic botanical farmhouse illustrations", css: "w-full h-64", text: "Rustic botanical farmhouse illustrations" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+5/E.+Eclectic+boho+collage.png", alt: "Eclectic boho collage", css: "w-full h-64", text: "Eclectic boho collage" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+5/F.+Modern+geometric+contemporary+art.png", alt: "Modern geometric contemporary art", css: "w-full h-64", text: "Modern geometric contemporary art" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+5/G.+Minimalistic+line+drawings.png", alt: "Minimalistic line drawings", css: "w-full h-64", text: "Minimalistic line drawings" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+5/H.+Wabi-Sabi+handmade+imperfect+art.png", alt: "Wabi-Sabi handmade imperfect art", css: "w-full h-64", text: "Wabi-Sabi handmade imperfect art" },
];

// Question 6: flooring images from public folder
const QUESTION_6_IMAGES: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+6/A.+Light+ash+Scandinavian+wood+flooring.png", alt: "Light ash Scandinavian wood flooring", css: "w-full h-64", text: "Light ash Scandinavian wood flooring" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+6/B.+European+herringbone+parquet.png", alt: "European herringbone parquet", css: "w-full h-64", text: "European herringbone parquet" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+6/C.+Industrial+concrete.png", alt: "Industrial concrete", css: "w-full h-64", text: "Industrial concrete" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+6/D.+Warm+farmhouse+oak+planks.png", alt: "Warm farmhouse oak planks", css: "w-full h-64", text: "Warm farmhouse oak planks" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+6/E.+Patterned+bohemian+rugs.png", alt: "Patterned bohemian rugs", css: "w-full h-64", text: "Patterned bohemian rugs" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+6/F.+Sleek+stone+or+tile+flooring.png", alt: "Sleek stone or tile flooring", css: "w-full h-64", text: "Sleek stone or tile flooring" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+6/G.+Polished+minimalistic+whitegray.png", alt: "Polished minimalistic white/gray", css: "w-full h-64", text: "Polished minimalistic white/gray" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+6/H.+Wabi-Sabi+raw+textured+cement.png", alt: "Wabi-Sabi raw textured cement", css: "w-full h-64", text: "Wabi-Sabi raw textured cement" },
];

// Question 7: bedroom images from public folder
const QUESTION_7_IMAGES: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+7/A.+Cozy+Scandinavian+bedroom.png", alt: "Cozy Scandinavian bedroom", css: "w-full h-64", text: "Cozy Scandinavian bedroom" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+7/B.+Soft+pastel+European+Classic+bedroom.png", alt: "Soft pastel European Classic bedroom", css: "w-full h-64", text: "Soft pastel European Classic bedroom" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+7/C.+Dark-toned+Industrial+bedroom.png", alt: "Dark-toned Industrial bedroom", css: "w-full h-64", text: "Dark-toned Industrial bedroom" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+7/D.+Warm+and+rustic+farmhouse+bedroom.png", alt: "Warm and rustic farmhouse bedroom", css: "w-full h-64", text: "Warm and rustic farmhouse bedroom" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+7/E.+Colorful+and+layered+bohemian+bedroom.png", alt: "Colorful and layered bohemian bedroom", css: "w-full h-64", text: "Colorful and layered bohemian bedroom" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+7/F.+Clean-lined+modern+contemporary+bedroom.png", alt: "Clean-lined modern contemporary bedroom", css: "w-full h-64", text: "Clean-lined modern contemporary bedroom" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+7/G.+Neutral%2C+clutter-free+minimalistic+bedroom.png", alt: "Neutral, clutter-free minimalistic bedroom", css: "w-full h-64", text: "Neutral, clutter-free minimalistic bedroom" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+7/H.+Zen-like+Wabi-Sabi+bedroom+with+natural+imperfections.png", alt: "Zen-like Wabi-Sabi bedroom with natural imperfections", css: "w-full h-64", text: "Zen-like Wabi-Sabi bedroom with natural imperfections" },
];

// Question 8: lighting images from public folder
const QUESTION_8_IMAGES: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+8/A.+Soft+warm+Scandinavian+pendants.png", alt: "Soft warm Scandinavian pendants", css: "w-full h-64", text: "Soft warm Scandinavian pendants" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+8/B.+Classic+chandeliers.png", alt: "Classic chandeliers", css: "w-full h-64", text: "Classic chandeliers" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+8/C.+Industrial+cage+lights.png", alt: "Industrial cage lights", css: "w-full h-64", text: "Industrial cage lights" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+8/D.+Farmhouse+lantern.png", alt: "Farmhouse lantern lights", css: "w-full h-64", text: "Farmhouse lantern lights" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+8/E.+Bohemian+string+lights++woven+fixtures.png", alt: "Bohemian string lights / woven fixtures", css: "w-full h-64", text: "Bohemian string lights / woven fixtures" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+8/F.+Sleek+linear+modern+lighting.png", alt: "Sleek linear modern lighting", css: "w-full h-64", text: "Sleek linear modern lighting" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+8/G.+Minimalistic+recessed+lighting.png", alt: "Minimalistic recessed lighting", css: "w-full h-64", text: "Minimalistic recessed lighting" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+8/H.+Handmade+organic+ceramic+lamps+(Wabi-Sabi).png", alt: "Handmade organic ceramic lamps (Wabi-Sabi)", css: "w-full h-64", text: "Handmade organic ceramic lamps (Wabi-Sabi)" },
];

// Question 9: bathroom images from public folder
const QUESTION_9_IMAGES: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+9/A.+Scandinavian+bright+bathroom.png", alt: "Scandinavian bright bathroom", css: "w-full h-64", text: "Scandinavian bright bathroom" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+9/B.+European+marble+bathroom.png", alt: "European marble bathroom", css: "w-full h-64", text: "European marble bathroom" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+9/C.+Industrial+metal+%2B+stone+bathroom.png", alt: "Industrial metal + stone bathroom", css: "w-full h-64", text: "Industrial metal + stone bathroom" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+9/D.+Farmhouse+white+rustic+bathroom.png", alt: "Farmhouse white rustic bathroom", css: "w-full h-64", text: "Farmhouse white rustic bathroom" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+9/E.+Bohemian+colorful+tiles.png", alt: "Bohemian colorful tiles", css: "w-full h-64", text: "Bohemian colorful tiles" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+9/F.+Modern+monochrome+bathroom.png", alt: "Modern monochrome bathroom", css: "w-full h-64", text: "Modern monochrome bathroom" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+9/G.+Minimalistic+all-neutral+bathroom.png", alt: "Minimalistic all-neutral bathroom", css: "w-full h-64", text: "Minimalistic all-neutral bathroom" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+9/H.+Wabi-Sabi+stone+%2B+raw+wood+bathroom.png", alt: "Wabi-Sabi stone + raw wood bathroom", css: "w-full h-64", text: "Wabi-Sabi stone + raw wood bathroom" },
];

// Question 10: outdoor seating images from public folder
const QUESTION_10_IMAGES: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+10/A.+Nordic+wooden+balcony.png", alt: "Nordic wooden balcony", css: "w-full h-64", text: "Nordic wooden balcony" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+10/B.+European+garden+patio+please+imagine.png", alt: "European garden patio", css: "w-full h-64", text: "European garden patio" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+10/C.+Industrial+rooftop.png", alt: "Industrial rooftop", css: "w-full h-64", text: "Industrial rooftop" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+10/D.+Farmhouse+porch+with+rocking+chairs.png", alt: "Farmhouse porch with rocking chairs", css: "w-full h-64", text: "Farmhouse porch with rocking chairs" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+10/E.+Bohemian+cushioned+outdoor+lounge.png", alt: "Bohemian cushioned outdoor lounge", css: "w-full h-64", text: "Bohemian cushioned outdoor lounge" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+10/F.+Modern+clean-lined+patio.png", alt: "Modern clean-lined patio", css: "w-full h-64", text: "Modern clean-lined patio" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+10/G.+Minimalistic+zen-balcony.png", alt: "Minimalistic zen-balcony", css: "w-full h-64", text: "Minimalistic zen-balcony" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+10/H.+Wabi-Sabi+natural+stone+garden+corner.png", alt: "Wabi-Sabi natural stone garden corner", css: "w-full h-64", text: "Wabi-Sabi natural stone garden corner" },
];

// Question 11: décor accent images from public folder (é encoded as %C3%A9 in filenames)
const QUESTION_11_IMAGES: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+11/A.+Scandinavian+ceramics.png", alt: "Scandinavian ceramics", css: "w-full h-64", text: "Scandinavian ceramics" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+11/B.+European+candle+stands.png", alt: "European candle stands", css: "w-full h-64", text: "European candle stands" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+11/C.+Industrial+metal+de%CC%81cor.png", alt: "Industrial metal décor", css: "w-full h-64", text: "Industrial metal décor" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+11/D.+Farmhouse+baskets.png", alt: "Farmhouse baskets", css: "w-full h-64", text: "Farmhouse baskets" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+11/E.+Boho+macrame%CC%81.png    ", alt: "Boho macramé", css: "w-full h-64", text: "Boho macramé" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+11/F.+Modern+sculptural+de%CC%81cor+pieces.png", alt: "Modern sculptural décor pieces", css: "w-full h-64", text: "Modern sculptural décor pieces" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+11/G.+Minimalistic+mono-color+vases.png", alt: "Minimalistic mono-color vases", css: "w-full h-64", text: "Minimalistic mono-color vases" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+11/H.+Wabi-Sabi+raw+clay+artifacts.png", alt: "Wabi-Sabi raw clay artifacts", css: "w-full h-64", text: "Wabi-Sabi raw clay artifacts" },
];

// Question 12: color palette images from public folder
const QUESTION_12_IMAGES: ImageOption[] = [
    { id: 1, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+12/A.+Soft+neutrals+%2B+muted+tones+(Scandinavian).png", alt: "Soft neutrals + muted tones (Scandinavian)", css: "w-full h-64", text: "Soft neutrals + muted tones (Scandinavian)" },
    { id: 2, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+12/B.+Pastels+%2B+warm+creams+(European+Classic).png", alt: "Pastels + warm creams (European Classic)", css: "w-full h-64", text: "Pastels + warm creams (European Classic)" },
    { id: 3, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+12/C.+Dark+greys+%2B+brick+tones+(Industrial).png", alt: "Dark greys + brick tones (Industrial)", css: "w-full h-64", text: "Dark greys + brick tones (Industrial)" },
    { id: 4, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+12/D.+Earthy+browns+%2B+greens+(Farmhouse).png", alt: "Earthy browns + greens (Farmhouse)", css: "w-full h-64", text: "Earthy browns + greens (Farmhouse)" },
    { id: 5, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+12/E.+Vibrant+warm+hues+(Bohemian).png", alt: "Vibrant warm hues (Bohemian)", css: "w-full h-64", text: "Vibrant warm hues (Bohemian)" },
    { id: 6, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+12/F.+Black+%2B+beige+%2B+muted+contrasts+(Modern+Contemporary).png", alt: "Black + beige + muted contrasts (Modern Contemporary)", css: "w-full h-64", text: "Black + beige + muted contrasts (Modern Contemporary)" },
    { id: 7, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+12/G.+Pure+whites+%2B+monotones+(Minimalistic).png", alt: "Pure whites + monotones (Minimalistic)", css: "w-full h-64", text: "Pure whites + monotones (Minimalistic)" },
    { id: 8, src: "https://hubinterior-quote-2026.s3.ap-south-2.amazonaws.com/DesignQa/Question+12/H.+Earth+%2B+sand+%2B+stone+(Wabi-Sabi).png", alt: "Earth + sand + stone (Wabi-Sabi)", css: "w-full h-64", text: "Earth + sand + stone (Wabi-Sabi)" },
];

/** For text-only steps (13–16), build a synthetic option so we can reuse handleSelect and result page. */
function getTextOption(stepIndex: number, optionIndex: number): ImageOption {
    const text = OPTION_LABELS[stepIndex]?.[optionIndex] ?? '';
    return { id: optionIndex + 1, src: '', alt: text, css: '', text };
}

function getImagesForStep(step: number): ImageOption[] {
    switch (step) {
        case 2: return QUESTION_2_IMAGES;
        case 3: return QUESTION_3_IMAGES;
        case 4: return QUESTION_4_IMAGES;
        case 5: return QUESTION_5_IMAGES;
        case 6: return QUESTION_6_IMAGES;
        case 7: return QUESTION_7_IMAGES;
        case 8: return QUESTION_8_IMAGES;
        case 9: return QUESTION_9_IMAGES;
        case 10: return QUESTION_10_IMAGES;
        case 11: return QUESTION_11_IMAGES;
        case 12: return QUESTION_12_IMAGES;
        default: return IMAGE_OPTIONS; // step 1: living room
    }
}

const QUESTIONS: string[] = [
    "Choose the living room you'd love to walk into",
    "Pick a chair you feel naturally drawn to",
    "Choose a fabric texture that feels most \"you\"",
    "Pick the kitchen you'd enjoy cooking in",
    "Choose the artwork you'd hang in your home",
    "Pick a flooring style you prefer",
    "Choose the bedroom that feels peaceful to you",
    "Pick a lighting style you prefer",
    "Pick the bathroom vibe you'd enjoy",
    "Choose an outdoor seating area",
    "Select a décor accent you naturally gravitate towards",
    "Choose a color palette that feels like home",
    "What matters MOST to you in a home?",
    "How do you prefer your home to feel when guests walk in?",
    "Which statement describes your lifestyle best?",
    "What is your relationship with \"things\" at home?",
];

// For each question, option labels A–H (same order as IMAGE_OPTIONS)
const OPTION_LABELS: string[][] = [
    ["Scandinavian", "European Classic", "Industrial", "Farmhouse", "Bohemian", "Modern Contemporary", "Minimalistic", "Wabi-Sabi"],
    ["A soft oak Scandinavian lounge chair", "A tufted European armchair with carved details", "A metal-frame industrial accent chair", "A rustic wooden farmhouse rocking chair", "A rattan bohemian papasan chair", "A sleek modern contemporary accent chair", "A clean minimalistic low-profile chair", "A raw, imperfect Wabi-Sabi wooden chair"],
    ["Soft cotton-weave neutrals (Scandinavian)", "Velvet or brocade (European Classic)", "Distressed leather (Industrial)", "Natural jute/linen (Farmhouse)", "Colorful patterned textiles (Bohemian)", "Smooth matte upholstery (Modern Contemporary)", "Ultra-smooth monochrome fabrics (Minimalistic)", "Raw, organic, unprocessed textures (Wabi-Sabi)"],
    ["Light-toned Scandinavian kitchen", "Elegant European Classic kitchen with molding", "Industrial kitchen with metal and concrete", "Warm farmhouse kitchen with wooden cabinets", "Bohemian kitchen with mixed patterns", "Modern contemporary kitchen with clean lines", "Minimalistic all-white clutter-free kitchen", "Wabi-Sabi kitchen with imperfect ceramics"],
    ["Minimal abstract Scandinavian prints", "Classical European paintings", "Industrial metal wall art", "Rustic botanical farmhouse illustrations", "Eclectic boho collage", "Modern geometric contemporary art", "Minimalistic line drawings", "Wabi-Sabi handmade imperfect art"],
    ["Light ash Scandinavian wood flooring", "European herringbone parquet", "Industrial concrete", "Warm farmhouse oak planks", "Patterned bohemian rugs", "Sleek stone or tile flooring", "Polished minimalistic white/gray", "Wabi-Sabi raw textured cement"],
    ["Cozy Scandinavian bedroom", "Soft pastel European Classic bedroom", "Dark-toned Industrial bedroom", "Warm and rustic farmhouse bedroom", "Colorful and layered bohemian bedroom", "Clean-lined modern contemporary bedroom", "Neutral, clutter-free minimalistic bedroom", "Zen-like Wabi-Sabi bedroom with natural imperfections"],
    ["Soft warm Scandinavian pendants", "Classic chandeliers", "Industrial cage lights", "Farmhouse lantern lights", "Bohemian string lights / woven fixtures", "Sleek linear modern lighting", "Minimalistic recessed lighting", "Handmade organic ceramic lamps (Wabi-Sabi)"],
    ["Scandinavian bright bathroom", "European marble bathroom", "Industrial metal + stone bathroom", "Farmhouse white rustic bathroom", "Bohemian colorful tiles", "Modern monochrome bathroom", "Minimalistic all-neutral bathroom", "Wabi-Sabi stone + raw wood bathroom"],
    ["Nordic wooden balcony", "European garden patio", "Industrial rooftop", "Farmhouse porch with rocking chairs", "Bohemian cushioned outdoor lounge", "Modern clean-lined patio", "Minimalistic zen-balcony", "Wabi-Sabi natural stone garden corner"],
    ["Scandinavian ceramics", "European candle stands", "Industrial metal décor", "Farmhouse baskets", "Boho macramé", "Modern sculptural décor pieces", "Minimalistic mono-color vases", "Wabi-Sabi raw clay artifacts"],
    ["Soft neutrals + muted tones (Scandinavian)", "Pastels + warm creams (European Classic)", "Dark greys + brick tones (Industrial)", "Earthy browns + greens (Farmhouse)", "Vibrant warm hues (Bohemian)", "Black + beige + muted contrasts (Modern Contemporary)", "Pure whites + monotones (Minimalistic)", "Earth + sand + stone (Wabi-Sabi)"],
    // Q13–Q16: text-only options (no images)
    ["Calmness and simplicity (Minimalistic)", "Timeless elegance (European Classic)", "Functionality and clean lines (Modern Contemporary)", "Natural textures and grounding elements (Wabi-Sabi)", "Warmth and comfort (Farmhouse)", "Creativity and self-expression (Bohemian)", "Practicality and strong materials (Industrial)", "Soft, cozy, balanced aesthetics (Scandinavian)"],
    ["Peaceful and uncluttered", "Grand and impressive", "Sleek and stylish", "Natural and earthy", "Warm and welcoming", "Vibrant and full of personality", "Bold and modern", "Cozy, soft, and home-like"],
    ["I like things minimal — no excess.", "I appreciate classics and structure.", "I enjoy modern living and efficiency.", "I embrace imperfections and nature.", "I prefer slow, warm living with comfort.", "I love colours, patterns, and artistic vibes.", "I'm practical and prefer functional spaces.", "I love calm, neutral, airy spaces."],
    ["I keep only what I need (Minimalistic)", "I cherish heirlooms/artifacts (European Classic)", "I buy quality, sleek items (Modern Contemporary)", "I love handmade, raw, imperfect objects (Wabi-Sabi)", "I enjoy rustic, lived-in objects (Farmhouse)", "I love collecting expressive, colourful décor (Bohemian)", "I prioritise durability over aesthetics (Industrial)", "I prefer functional, simple, soft décor (Scandinavian)"],
];

const TOTAL_STEPS = 16;

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

type AnswerEntry = {
    question: string;
    selected: ImageOption | null;
    optionLabel?: string; // label shown for this question (e.g. "A soft oak Scandinavian lounge chair")
};

export default function DesignQAPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [answers, setAnswers] = useState<AnswerEntry[]>(() =>
        QUESTIONS.map((q) => ({ question: q, selected: null }))
    );
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const currentQuestion = QUESTIONS[currentStep - 1];
    const currentAnswer = answers[currentStep - 1];
    const isLastStep = currentStep === TOTAL_STEPS;

    const handleSelect = async (image: ImageOption, optionIndex: number) => {
        const newAnswers = [...answers];
        const optionLabel = OPTION_LABELS[currentStep - 1]?.[optionIndex] ?? image.text;
        newAnswers[currentStep - 1] = { ...newAnswers[currentStep - 1], selected: image, optionLabel };
        setAnswers(newAnswers);
        setSubmitError(null);

        if (isLastStep) {
            setSubmitting(true);
            const apiUrl = process.env.NEXT_PUBLIC_DESIGN_QA_API_URL || 'http://192.168.68.121:8081/api/design-qa';
            try {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ answers: newAnswers }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    setSubmitError(data?.error || 'Submission failed. Please try again.');
                    setSubmitting(false);
                    return;
                }
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('designQASubmitted', 'true');
                }
                router.push('/DesignQA/result');
            } catch {
                setSubmitError('Something went wrong. Please try again.');
                setSubmitting(false);
            }
        } else {
            setCurrentStep((s) => s + 1);
        }
    };

    const handleBack = () => {
        setCurrentStep((s) => Math.max(1, s - 1));
    };

    return (
        <div className="bg-white min-h-screen min-h-dvh overflow-x-hidden flex flex-col items-center relative pb-4">
            {/* Header: logo left end, quiz title right end - aligned, minimal top gap */}
            <div className="w-full flex-shrink-0 flex flex-row items-center justify-between gap-4 px-3 sm:px-4 md:px-6 pt-1 pb-1 sm:pt-2 sm:pb-2 z-10">
                <img src="/LOGOHOWs.png" alt="Logo" className="h-14 sm:h-16 md:h-20 xl:h-24 xl:max-h-24  xl:w-auto xl:max-w-[280px] object-contain align-middle block" />
                <span className="text-black font-bold text-sm sm:text-base md:text-lg align-middle leading-none">
                    Interior Personality Quiz ?
                </span>
            </div>

            <main className="w-full flex-1 flex flex-col items-center justify-start px-3 pt-1 pb-3 sm:px-4 sm:pt-2 sm:pb-4 md:px-6 xl:w-[75%] xl:max-w-5xl">
                {/* Progress bar */}
                <div className="w-full max-w-2xl mx-auto mb-2 sm:mb-3 md:mb-4">
                    <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
                        <span>Steps {currentStep} of {TOTAL_STEPS}</span>
                        <span>{Math.round((currentStep / TOTAL_STEPS) * 100)}%</span>
                    </div>
                    <p className="text-base sm:text-lg xl:text-xl text-black font-bold mb-2 sm:mb-3">Define your space</p>
                    <div className="h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-700 transition-all duration-300"
                            style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="w-full max-w-2xl xl:max-w-none bg-[#f1f2f6] rounded-2xl sm:rounded-3xl xl:rounded-4xl border-2 sm:border-[3px] border-green-900 shadow-xl xl:shadow-2xl overflow-hidden flex flex-col max-h-[75vh] sm:max-h-[80vh] xl:max-h-[85vh]">
                    <h1 className="text-black text-base sm:text-lg xl:text-xl 2xl:text-2xl font-bold text-center pt-3 pb-1 sm:pt-4 sm:pb-2 flex-shrink-0 px-3 sm:px-4">
                        {currentQuestion}
                    </h1>

                    {submitError && (
                        <p className="mx-3 sm:mx-6 mt-1 sm:mt-2 text-red-600 text-xs sm:text-sm font-medium text-center flex-shrink-0">{submitError}</p>
                    )}

                    {currentStep >= 13 ? (
                        /* Text-only options for Q13–Q16 */
                        <div className="flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 md:p-6 xl:p-8 flex-1 min-h-0 overflow-auto">
                            {OPTION_LETTERS.map((letter, index) => {
                                const option = getTextOption(currentStep - 1, index);
                                const label = OPTION_LABELS[currentStep - 1]?.[index] ?? option.text;
                                const isSelected = currentAnswer?.selected?.id === option.id;
                                return (
                                    <div
                                        key={letter}
                                        onClick={() => !submitting && handleSelect(option, index)}
                                        className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 ${
                                            submitting ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                                        } ${
                                            isSelected
                                                ? 'border-green-600 bg-green-50 ring-2 ring-green-600 ring-offset-1 sm:ring-offset-2'
                                                : 'border-gray-200 bg-white hover:border-green-400 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm ${isSelected ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                                            {letter}
                                        </span>
                                        <p className="text-black font-medium text-xs sm:text-sm xl:text-base">{label}</p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 xl:gap-6 p-3 sm:p-4 md:p-6 xl:p-8 text-center flex-1 min-h-0 overflow-auto">
                            {getImagesForStep(currentStep).map((image, index) => {
                                const isSelected = currentAnswer?.selected?.id === image.id;
                                const optionLabel = OPTION_LABELS[currentStep - 1]?.[index] ?? image.text;
                                return (
                                    <div
                                        key={image.id}
                                        onClick={() => !submitting && handleSelect(image, index)}
                                        className={`group relative flex flex-col items-center rounded-2xl sm:rounded-3xl transition-all duration-300 ${
                                            submitting ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                                        } ${
                                            isSelected
                                                ? 'ring-2 sm:ring-4 ring-green-600 ring-offset-1 sm:ring-offset-2 scale-[1.02]'
                                                : ''
                                        }`}
                                    >
                                        <div className={`overflow-hidden rounded-2xl sm:rounded-3xl border-2 sm:border-[3px] transition-all duration-300 w-full ${
                                            isSelected ? 'border-green-600 shadow-lg' : 'border-transparent group-hover:border-blue-500 group-hover:shadow-lg'
                                        }`}>
                                            <img
                                                src={image.src}
                                                alt={image.alt}
                                                className="w-full h-36 sm:h-44 md:h-52 xl:h-56 2xl:h-72 object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                        </div>
                                        <p className="w-[85%] bg-white py-1.5 px-1.5 sm:py-2 sm:px-2 rounded-lg sm:rounded-xl text-black font-bold text-[10px] sm:text-xs xl:text-sm shadow-lg border-b border-green-900 absolute -bottom-2 sm:-bottom-3 transition-all duration-300 group-hover:opacity-100">
                                            {OPTION_LETTERS[index]}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Back button */}
                    <div className="flex items-center px-3 sm:px-6 xl:px-8 pb-4 sm:pb-6 pt-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={currentStep === 1}
                            className="px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl border-2 border-gray-300 font-semibold text-gray-700 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
