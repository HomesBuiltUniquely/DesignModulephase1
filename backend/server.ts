import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

let lastSalesClosure: any = null;
let lastChecklist: any = null;
let lastDesignFreezeChecklist: any = null;
let lastColorSelectionChecklist: any = null;
let lastDesignSignOffChecklist: any = null;

app.post("/api/sales-closure", (req: Request, res: Response) => {
  lastSalesClosure = req.body;
  console.log("Received:", lastSalesClosure);

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
