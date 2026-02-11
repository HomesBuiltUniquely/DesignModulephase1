export type MilestoneItem = {
    id: number;
    name: string;
    taskList: string[];
    Css?: string;
};

export type MileStonesTypes = {
    MilestonesName: MilestoneItem[];
}