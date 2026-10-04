import { app } from "./http/app";

const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});