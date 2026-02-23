import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

let lastSalesClosure: any = null;

app.post("/api/sales-closure", (req: Request, res: Response) => {
  lastSalesClosure = req.body;
  console.log("Received:", lastSalesClosure);

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
