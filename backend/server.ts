import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

let lastSalesClosure: any = null;

// In-memory leads queue so Dashboard can show sales-closure submissions
interface LeadRow {
  id: number;
  pid: string;
  projectName: string;
  projectStage: string;
  createAt: string;
  updateAt: string;
  contactNo?: string;
  clientEmail?: string;
  // hold / resume
  isOnHold?: boolean;
  resumeAt?: string | null;
  raw?: any; // full payload for GET /api/leads/:id
}
const leadsQueue: LeadRow[] = [];
let nextLeadId = 1;

function toLeadRow(payload: any): LeadRow {
  const now = new Date().toISOString();
  const id = nextLeadId++;
  const fetched = payload?.fetchedData || {};
  const formData = payload?.formData || {};
  const projectName = fetched.customer_name || fetched.sales_lead_name || "Unnamed";
  // Payment dropdown: FULL_10% → 10-20%, PARTIAL/TOKEN → Pre 10%
  const payment = formData.payment_received || "";
  const stage =
    payment === "FULL_10%"
      ? "10-20%"
      : payment === "PARTIAL" || payment === "TOKEN"
        ? "Pre 10%"
        : formData.status_of_project || "Active";
  return {
    id,
    pid: `P${String(id).padStart(3, "0")}`,
    projectName,
    projectStage: stage,
    createAt: now,
    updateAt: now,
    contactNo: fetched.co_no,
    clientEmail: fetched.email,
    raw: payload,
  };
}

app.post("/api/sales-closure", (req: Request, res: Response) => {
  const payload = req.body;
  lastSalesClosure = payload;
  console.log("Received:", payload);

  const lead = toLeadRow(payload);
  leadsQueue.push(lead);

  res.status(201).json({
    success: true,
    message: "Sales closure received",
  });
});

app.get("/api/sales-closure/last", (req: Request, res: Response) => {
  if (!lastSalesClosure) {
    return res.status(404).json({
      message: "No data yet",
    });
  }

  res.json(lastSalesClosure);
});

// Dashboard: list all leads (sales closure submissions)
app.get("/api/leads/queue", (req: Request, res: Response) => {
  const now = new Date();
  // auto-resume any leads whose resume date has passed
  leadsQueue.forEach((lead) => {
    if (lead.isOnHold && lead.resumeAt) {
      const resumeDate = new Date(lead.resumeAt);
      if (!Number.isNaN(resumeDate.getTime()) && resumeDate <= now) {
        lead.isOnHold = false;
        lead.resumeAt = null;
      }
    }
  });
  const list = leadsQueue.map(({ raw, ...rest }) => rest);
  res.json(list);
});

// Lead detail by id (for /Leads/[id])
app.get("/api/leads/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const lead = leadsQueue.find((l) => l.id === id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });

  // auto-resume if date is reached
  if (lead.isOnHold && lead.resumeAt) {
    const now = new Date();
    const resumeDate = new Date(lead.resumeAt);
    if (!Number.isNaN(resumeDate.getTime()) && resumeDate <= now) {
      lead.isOnHold = false;
      lead.resumeAt = null;
    }
  }

  const { raw, ...rest } = lead;
  res.json(rest);
});

// Put project on hold until a given date
app.post("/api/leads/:id/hold", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const lead = leadsQueue.find((l) => l.id === id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });

  const { resumeAt } = req.body as { resumeAt?: string };
  if (!resumeAt) return res.status(400).json({ message: "resumeAt is required" });

  const date = new Date(resumeAt);
  if (Number.isNaN(date.getTime())) return res.status(400).json({ message: "Invalid resumeAt date" });

  lead.isOnHold = true;
  lead.resumeAt = date.toISOString();
  lead.updateAt = new Date().toISOString();

  res.json({ success: true, message: "Project put on hold", resumeAt: lead.resumeAt });
});

// Resume project immediately (override any hold)
app.post("/api/leads/:id/resume", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const lead = leadsQueue.find((l) => l.id === id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });

  lead.isOnHold = false;
  lead.resumeAt = null;
  lead.updateAt = new Date().toISOString();

  res.json({ success: true, message: "Project resumed" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
