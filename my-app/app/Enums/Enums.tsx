enum SideDashboard {
    All_Projects="All Projects (10-60%)",
    Pre_10="Pre 10%",
    Ten_50="10-20%",
    Fifty_above="20-60%",
    In_Execution="In Execution",
}

/** Sidebar filters for hold + sales stage (Active vs cancelled queue) */
enum SideDashboardStatus {
    All_Statuses = "All statuses",
    On_Hold = "On hold",
    Active = "Active",
    Cancelled = "Cancelled",
}

export { SideDashboard, SideDashboardStatus };