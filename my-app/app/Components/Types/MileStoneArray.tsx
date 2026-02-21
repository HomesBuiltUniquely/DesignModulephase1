import { MileStonesTypes } from "./milestones";


const MileStonesArray: MileStonesTypes = {
    MilestonesName: [
        {
            id:1,
            name:"D1 SITE MEASUREMENT",
            taskList: ["Group Description","Mail loop chain 2 initiate","D1 for MMT request","D1 files upload"],
            Css: 'xl:w-75 xl:mt-8 xl:mx-auto xl:my-10  xl:border-2 xl:border-dashed xl:border-red-300 xl:hover:bg-blue-50  xl:cursor-pointer xl:overflow-y-auto xl:rounded-2xl'
        },
        {
            id:2,
            name:"DQC1",
            taskList: ["First cut design + quotation discussion meeting request","meeting completed","Design finalisation meeting request","DQC 1 submission - dwg + quotation","DQC 1 approval"],
            Css: 'xl:w-75 xl:mt-6 xl:mx-auto  border-2 border-dashed border-red-300 hover:bg-blue-50  cursor-pointer overflow-y-auto xl:rounded-2xl'
        },
        {
            id:3,
            name:"10% PAYMENT",
            taskList: ["10% payment collection","10% payment approval"],
            Css: 'xl:w-75  xl:mx-auto xl:mt-20  xl:border-2 xl:border-dashed xl:border-red-300 xl:hover:bg-blue-50  xl:cursor-pointer xl:overflow-y-auto xl:rounded-2xl xl:my-30'
        },
        {
            id:4,
            name:"D2 SITE MASKING",
            taskList: ["D2 - masking request raise","D2 - files upload"],
            Css: 'xl:w-75 xl:mt-5 xl:mx-auto xl:mt-12  border-2 border-dashed border-red-300 hover:bg-blue-50  cursor-pointer overflow-y-auto xl:rounded-2xl xl:my-20'
        },
        {
            id:5,
            name:"DQC2",
            taskList: ["Material selection meeting + quotation discussion","Material selection meeting completed ","DQC 2 submission","DQC 2 approval "],
            Css: 'xl:w-75  xl:mx-auto xl:mt-20  xl:border-2 xl:border-dashed xl:border-red-300 xl:hover:bg-blue-50  xl:cursor-pointer xl:overflow-y-auto xl:rounded-2xl xl:my-30'
        },
        {
            id:6,
            name:"40% PAYMENT",
            taskList: ["Design sign off","meeting completed & 40% payment request","40% payment approval"],
            Css: 'xl:w-75  xl:mx-auto xl:mt-20  xl:border-2 xl:border-dashed xl:border-red-300 xl:hover:bg-blue-50  xl:cursor-pointer xl:overflow-y-auto xl:rounded-2xl xl:my-30'
        },
        {
            id:7,
            name:"PUSH TO PRODUCTION",
            taskList: ["Cx approval for production","POC mail & Timeline submission "],
            Css: 'xl:w-75 xl:mt-5 xl:mx-auto xl:mt-12  border-2 border-dashed border-red-300 hover:bg-blue-50  cursor-pointer overflow-y-auto xl:rounded-2xl xl:my-20'
        }
    ]
};

export default MileStonesArray;