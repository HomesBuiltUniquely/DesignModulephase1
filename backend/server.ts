import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ----- Auth (so login returns JSON and frontend does not show "Invalid response from server") -----
const ADMIN_EMAIL = "admin@hubinterior.com";
const ADMIN_PASSWORD = "admin123";
const ADMIN_USER = {
  id: 1,
  email: ADMIN_EMAIL,
  name: "Admin",
  role: "admin",
  profileImage: null as string | null,
  phone: "",
};
const sessions = new Map<string, typeof ADMIN_USER>();

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const sessionId = "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    sessions.set(sessionId, ADMIN_USER);
    return res.status(200).json({ user: ADMIN_USER, sessionId });
  }
  return res.status(401).json({ message: "Invalid credentials" });
});

app.post("/api/auth/logout", (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  const token = auth?.replace(/^Bearer\s+/i, "");
  if (token) sessions.delete(token);
  return res.status(200).json({ ok: true });
});

app.get("/api/auth/me", (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  const token = auth?.replace(/^Bearer\s+/i, "");
  const user = token ? sessions.get(token) : null;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  return res.json(user);
});

let lastSalesClosure: any = null;
let lastChecklist: any = null;
let lastDesignFreezeChecklist: any = null;
let lastColorSelectionChecklist: any = null;
let lastDesignSignOffChecklist: any = null;

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

// checklist endpoints
app.post("/api/checklist", (req: Request, res: Response) => {
  lastChecklist = req.body;
  console.log("Checklist received:", lastChecklist);

  res.status(201).json({
    success: true,
    message: "Checklist received",
  });
});

app.get("/api/checklist/last", (req: Request, res: Response) => {
  if (!lastChecklist) {
    return res.status(404).json({ message: "No checklist data yet" });
  }
  res.json(lastChecklist);
});

// design-freeze-checklist endpoints
app.post("/api/design-freeze-checklist", (req: Request, res: Response) => {
  lastDesignFreezeChecklist = req.body;
  console.log("Design Freeze Checklist received:", lastDesignFreezeChecklist);

  res.status(201).json({
    success: true,
    message: "Design Freeze Checklist received",
  });
});

app.get("/api/design-freeze-checklist/last", (req: Request, res: Response) => {
  if (!lastDesignFreezeChecklist) {
    return res.status(404).json({ message: "No design freeze checklist data yet" });
  }
  res.json(lastDesignFreezeChecklist);
});

// color-selection-checklist endpoints
app.post("/api/color-selection-checklist", (req: Request, res: Response) => {
  lastColorSelectionChecklist = req.body;
  console.log("Color Selection Checklist received:", lastColorSelectionChecklist);

  res.status(201).json({
    success: true,
    message: "Color Selection Checklist received",
  });
});

app.get("/api/color-selection-checklist/last", (req: Request, res: Response) => {
  if (!lastColorSelectionChecklist) {
    return res.status(404).json({ message: "No color selection checklist data yet" });
  }
  res.json(lastColorSelectionChecklist);
});


// sign-off meeting-checklist endpoints
app.post("/api/design-signoff-checklist", (req: Request, res: Response) => {
  lastDesignSignOffChecklist = req.body;
  console.log("Design Sign Off Checklist received:", lastDesignSignOffChecklist);

  res.status(201).json({
    success: true,
    message: "Design Sign Off Checklist received",
  });
});

app.get("/api/design-signoff-checklist/last", (req: Request, res: Response) => {
  if (!lastDesignSignOffChecklist) {
    return res.status(404).json({ message: "No design sign off checklist data yet" });
  }
  res.json(lastDesignSignOffChecklist);
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
