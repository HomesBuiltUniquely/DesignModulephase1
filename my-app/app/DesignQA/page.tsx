import React from 'react';

export default function DesignQAPage() {
    
    type Images = {
        id: number;
        css: string | undefined;
        src: string;
        alt: string;
        text: string;
    }

    const img: Images[] = [
        {
            id: 1,      
            src: "scandanavian.png",
            alt: "A beautiful view of Paris",
            css:  "w-full h-64",
            text: "Scandinavian"
        },
        {
            id: 2,
            src: "Industrial.png",
            alt: " European Classic",
            css: "w-full h-64",
            text: "Industrial"
        },
        {
            id: 3,
            src: "farmhouse.png",
            alt: "A beautiful view of Paris",
            css: "w-full h-64",
            text: "Farmhouse"
        },
        {
            id: 4,
            src: "bohemian.png",
            alt: "A beautiful view of Paris",
            css: "w-full h-64",
            text: "Bohemian"
        },
        {
            id: 5,
            src: "modernContemporary.png",
            alt: "A beautiful view of Paris",
            css: "w-full h-64",
            text: "Modern Contemporary"
        },
        {
            id: 6,
            src: "Minimalistic.png",
            alt: "A beautiful view of Paris",
            css: "w-full h-64",
            text: "Minimalistic"
        },
        {
            id: 7,
            src: "WabiSabi.png",
            alt: "A beautiful view of Paris",
            css: "w-full h-64",
            text: " Wabi-Sabi"
        },
        {
            id: 8,
            src: "Europeanclassic.png",
            alt: "A beautiful view of Paris",
            css: "w-full h-64",
            text: "European Classic"
        }
    ];

    return (
        <div className="bg-white min-h-screen">
            <main>
               {/* Main Outer Container */}
               <div className='xl:w-[16%] xl:z-10 xl:-ml-16'><img src="/LOGOHOWs.png" alt="" /></div>
               <div className="xl:mx-auto xl:w-[75%] xl:bg-[#f1f2f6] xl:rounded-4xl xl:border-3 xl:border-green-900 xl:shadow-2xl xl:overflow-hidden">
               <h1 className='xl:text-black xl:text-2xl xl:font-bold xl:text-center pt-10'>Choose the living room you’d love to walk into</h1>
                    {/* Grid Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 p-12 text-center">

                            
                            
                            {img.map((image) => (
                                /* 'group' allows children to react when this div is hovered */
                                <div key={image.id} className="group relative flex flex-col items-center cursor-pointer">
                                    
                                    {/* Image Section */}
                                    <div className="overflow-hidden rounded-4xl border-3 border-transparent transition-all duration-300 group-hover:border-blue-500 group-hover:shadow-lg">
                                        <img 
                                            src={image.src} 
                                            alt={image.alt} 
                                            className={`${image.css} object-cover transition-transform duration-500 group-hover:scale-110`}
                                        />
                                    </div>

                                    {/* Animated Text Box */}
                                    <p className="
                                        /* Basic Styling */
                                        w-[80%] bg-white py-4 px-2 rounded-2xl text-black font-bold text-sm shadow-xl
                                        border-b-1 border-green-900
                                        
                                        /* Positioning: Pull it up over the image */
                                        absolute -bottom-4
                                        
                                        /* Hover Animation logic */
                                         transition-all duration-300 ease-out
                                        group-hover:opacity-100 
                                    ">
                                        {image.text}
                                    </p>
                                </div>
                            ))}
                    </div>
               </div>
            </main>
        </div>
    );
}